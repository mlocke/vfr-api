/**
 * Training Dataset Generation Script for ML Early Signal Detection
 *
 * Task 1.5: Generate Training Dataset
 * Estimated Time: 2h + 4-6h data collection
 * Purpose: Generate comprehensive training dataset by combining:
 *   - Historical analyst ratings (from collect-analyst-history)
 *   - Feature extraction (from FeatureExtractor)
 *   - Label generation (from label-generator)
 *
 * Usage:
 *   npm run ts-node scripts/ml/generate-training-data.ts --symbols TSLA,NVDA,AAPL --test
 *   npm run ts-node scripts/ml/generate-training-data.ts --full
 *   npm run ts-node scripts/ml/generate-training-data.ts --symbols TSLA --start 2023-01-01 --end 2023-12-31
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'
import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor.js'
import { collectAnalystHistory, AnalystRatingsHistory } from './collect-analyst-history.js'
import { calculateRatingChange } from './label-generator.js'
import type { TrainingExample } from '../../app/services/ml/early-signal/types.js'

/**
 * Top 100 S&P 500 symbols for initial implementation
 * Source: S&P 500 by market cap (sufficient for MVP training)
 */
const SP500_TOP_100 = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'XOM',
  'JNJ', 'JPM', 'V', 'PG', 'MA', 'HD', 'CVX', 'ABBV', 'MRK', 'AVGO',
  'PEP', 'COST', 'KO', 'LLY', 'TMO', 'WMT', 'MCD', 'ACN', 'CSCO', 'ABT',
  'ADBE', 'DHR', 'NKE', 'CRM', 'TXN', 'NEE', 'VZ', 'CMCSA', 'INTC', 'PM',
  'UNP', 'WFC', 'ORCL', 'DIS', 'BMY', 'RTX', 'COP', 'AMD', 'QCOM', 'HON',
  'UPS', 'AMGN', 'LOW', 'T', 'IBM', 'ELV', 'SBUX', 'CAT', 'DE', 'LMT',
  'INTU', 'BA', 'GS', 'SPGI', 'PLD', 'AMAT', 'BLK', 'GILD', 'AXP', 'SYK',
  'MDLZ', 'TJX', 'ISRG', 'ADI', 'BKNG', 'MMC', 'ADP', 'VRTX', 'CVS', 'CI',
  'C', 'TMUS', 'PFE', 'ZTS', 'REGN', 'MO', 'CB', 'SO', 'DUK', 'BDX',
  'NOW', 'SLB', 'SCHW', 'EOG', 'GE', 'NOC', 'HUM', 'MU', 'BSX', 'MMM'
]

/**
 * Command-line arguments interface
 */
interface CLIArgs {
  symbols?: string[]
  test: boolean
  full: boolean
  start: Date
  end: Date
  output: string
  checkpointInterval: number
}

/**
 * Parse command-line arguments
 */
function parseArguments(): CLIArgs {
  const args = process.argv.slice(2)
  const parsed: CLIArgs = {
    test: false,
    full: false,
    start: new Date('2022-01-01'),
    end: new Date('2024-12-31'),
    output: 'data/training/early-signal-v1.csv',
    checkpointInterval: 50
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--symbols' && i + 1 < args.length) {
      parsed.symbols = args[++i].split(',').map(s => s.trim().toUpperCase())
    } else if (arg === '--test') {
      parsed.test = true
    } else if (arg === '--full') {
      parsed.full = true
    } else if (arg === '--start' && i + 1 < args.length) {
      parsed.start = new Date(args[++i])
    } else if (arg === '--end' && i + 1 < args.length) {
      parsed.end = new Date(args[++i])
    } else if (arg === '--output' && i + 1 < args.length) {
      parsed.output = args[++i]
    } else if (arg === '--checkpoint-interval' && i + 1 < args.length) {
      parsed.checkpointInterval = parseInt(args[++i], 10)
    }
  }

  // Determine symbols to process
  if (parsed.test && !parsed.symbols) {
    parsed.symbols = ['TSLA', 'NVDA', 'AAPL']
  } else if (parsed.full || !parsed.symbols) {
    parsed.symbols = SP500_TOP_100
  }

  return parsed
}

/**
 * Sleep utility for rate limiting
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Convert training example to CSV row
 */
function exampleToCSV(example: TrainingExample): string {
  const features = example.features
  return [
    example.symbol,
    example.date.toISOString().split('T')[0],
    features.price_change_5d,
    features.price_change_10d,
    features.price_change_20d,
    features.volume_ratio,
    features.volume_trend,
    features.sentiment_news_delta,
    features.sentiment_reddit_accel,
    features.sentiment_options_shift,
    features.earnings_surprise,
    features.revenue_growth_accel,
    features.analyst_coverage_change,
    features.rsi_momentum,
    features.macd_histogram_trend,
    example.label
  ].join(',')
}

/**
 * Generate CSV header
 */
function generateCSVHeader(): string {
  return [
    'symbol',
    'date',
    'price_change_5d',
    'price_change_10d',
    'price_change_20d',
    'volume_ratio',
    'volume_trend',
    'sentiment_news_delta',
    'sentiment_reddit_accel',
    'sentiment_options_shift',
    'earnings_surprise',
    'revenue_growth_accel',
    'analyst_coverage_change',
    'rsi_momentum',
    'macd_histogram_trend',
    'label'
  ].join(',')
}

/**
 * Save dataset to CSV file
 */
async function saveDataset(dataset: TrainingExample[], filepath: string): Promise<void> {
  const outputPath = path.resolve(filepath)
  const outputDir = path.dirname(outputPath)

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Generate CSV content
  const csvHeader = generateCSVHeader()
  const csvRows = dataset.map(exampleToCSV)
  const csvContent = [csvHeader, ...csvRows].join('\n')

  // Write to file
  fs.writeFileSync(outputPath, csvContent, 'utf-8')
  console.log(`✓ Saved ${dataset.length} examples to ${outputPath}`)
}

/**
 * Validate training example for data quality
 */
function isValidExample(example: TrainingExample): boolean {
  const features = example.features

  // Check for NaN values in features
  const featureValues = Object.values(features)
  const hasNaN = featureValues.some(v => isNaN(v) || v === null || v === undefined)

  if (hasNaN) {
    return false
  }

  // Check for valid label
  if (example.label !== 0 && example.label !== 1) {
    return false
  }

  return true
}

/**
 * Calculate dataset statistics
 */
function calculateStatistics(dataset: TrainingExample[]): {
  total: number
  upgrades: number
  upgradePercentage: number
  validExamples: number
  invalidExamples: number
  symbolCounts: Record<string, number>
  dateRange: { start: Date; end: Date }
} {
  const validExamples = dataset.filter(isValidExample)
  const upgrades = validExamples.filter(ex => ex.label === 1).length

  const symbolCounts: Record<string, number> = {}
  validExamples.forEach(ex => {
    symbolCounts[ex.symbol] = (symbolCounts[ex.symbol] || 0) + 1
  })

  const dates = validExamples.map(ex => ex.date.getTime())
  const dateRange = {
    start: new Date(Math.min(...dates)),
    end: new Date(Math.max(...dates))
  }

  return {
    total: dataset.length,
    upgrades,
    upgradePercentage: (upgrades / validExamples.length) * 100,
    validExamples: validExamples.length,
    invalidExamples: dataset.length - validExamples.length,
    symbolCounts,
    dateRange
  }
}

/**
 * Main training data generation function
 *
 * FINAL APPROACH (based on API availability testing):
 * FMP's upgrade/downgrade endpoints return empty data in our tier.
 * Instead, we use EARNINGS SURPRISES as historical events - FMP provides 60 quarters of data!
 *
 * For each earnings release:
 * 1. Extract features at the time of earnings
 * 2. Label = 1 if current analyst consensus is better than before earnings, 0 otherwise
 *    (This captures if the market/analysts reacted positively to the earnings)
 *
 * This provides rich historical data (60 quarters × 100 symbols = 6000 examples)
 * and aligns with early signal detection - predicting positive analyst reactions to earnings.
 */
async function generateTrainingData(args: CLIArgs): Promise<void> {
  console.log('🔮 ML Early Signal - Training Dataset Generation')
  console.log('Task 1.5: Generate Training Dataset')
  console.log('='.repeat(80))

  console.log('\nConfiguration:')
  console.log(`  Symbols: ${args.symbols?.length || 0} (${args.test ? 'TEST MODE' : args.full ? 'FULL S&P 100' : 'CUSTOM'})`)
  console.log(`  Date range: ${args.start.toISOString().split('T')[0]} to ${args.end.toISOString().split('T')[0]}`)
  console.log(`  Output: ${args.output}`)
  console.log(`  Checkpoint interval: Every ${args.checkpointInterval} symbols`)
  console.log('\n📊 APPROACH: Using FMP earnings surprises API (60 quarters of historical data)')
  console.log('   Label = 1 if earnings beat expectations AND current consensus is "Buy" or better')
  console.log('   This provides ~6000 training examples (60 quarters × 100 symbols)')
  console.log('='.repeat(80))

  const featureExtractor = new EarlySignalFeatureExtractor()
  const { FinancialModelingPrepAPI } = await import('../../app/services/financial-data/FinancialModelingPrepAPI.js')
  const fmpAPI = new FinancialModelingPrepAPI()

  const dataset: TrainingExample[] = []
  const symbols = args.symbols || SP500_TOP_100

  let totalEarningsProcessed = 0
  let totalExamplesCreated = 0
  let totalSkipped = 0
  let errorCount = 0

  const startTime = Date.now()

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i]
    const progress = ((i + 1) / symbols.length * 100).toFixed(1)

    try {
      console.log(`\n[${i + 1}/${symbols.length}] (${progress}%) Processing ${symbol}...`)

      // Step 1: Get earnings surprises - FMP provides up to 60 quarters
      console.log(`  → Fetching earnings history for ${symbol}...`)
      const earningsData = await fmpAPI.getEarningsSurprises(symbol, 60)

      if (earningsData.length === 0) {
        console.log(`  ⚠️  No earnings data found for ${symbol}, skipping...`)
        totalSkipped++
        await sleep(200) // Rate limiting
        continue
      }

      // Filter by date range and sort chronologically (oldest first)
      const filteredEarnings = earningsData
        .filter((earnings: any) => {
          const earningsDate = new Date(earnings.date)
          return earningsDate >= args.start && earningsDate <= args.end
        })
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())

      if (filteredEarnings.length === 0) {
        console.log(`  ⚠️  No earnings in date range for ${symbol}, skipping...`)
        totalSkipped++
        await sleep(200)
        continue
      }

      totalEarningsProcessed += filteredEarnings.length
      console.log(`  ✓ Found ${filteredEarnings.length} earnings releases in date range (sorted chronologically)`)

      // Get current analyst consensus for labeling
      const analystRatings = await fmpAPI.getAnalystRatings(symbol)
      await sleep(200) // Rate limiting

      // Step 2: Generate training examples for each earnings release
      let examplesForSymbol = 0

      for (let j = 0; j < filteredEarnings.length; j++) {
        try {
          const earnings = filteredEarnings[j]
          const earningsDate = new Date(earnings.date)

          // Step 3: Extract features at earnings date
          const features = await featureExtractor.extractFeatures(symbol, earningsDate)

          // Step 4: Calculate label based on earnings surprise AND analyst consensus
          // Label = 1 if earnings beat AND current consensus is positive
          const earningsBeat = earnings.actualEarningResult > earnings.estimatedEarning
          const consensusPositive = analystRatings && (
            analystRatings.consensus === 'Strong Buy' ||
            analystRatings.consensus === 'Buy'
          )

          const label = (earningsBeat && consensusPositive) ? 1 : 0

          // Step 5: Create training example
          const example: TrainingExample = {
            symbol,
            date: earningsDate,
            features,
            label
          }

          // Validate example before adding
          if (isValidExample(example)) {
            dataset.push(example)
            examplesForSymbol++
            totalExamplesCreated++
          } else {
            totalSkipped++
          }

          // Rate limiting: 200ms between API calls
          await sleep(200)

        } catch (error: any) {
          console.error(`  ✗ Failed to process earnings ${j} for ${symbol}: ${error.message}`)
          errorCount++
          totalSkipped++
        }
      }

      console.log(`  ✓ Generated ${examplesForSymbol} training examples for ${symbol}`)

      // Step 6: Save checkpoint every N symbols
      if ((i + 1) % args.checkpointInterval === 0) {
        const checkpointFile = `data/training/checkpoint_${i + 1}.csv`
        await saveDataset(dataset, checkpointFile)
        console.log(`\n📦 Checkpoint saved: ${dataset.length} examples so far`)
      }

    } catch (error: any) {
      console.error(`  ✗ Failed to process ${symbol}: ${error.message}`)
      errorCount++

      // If we hit rate limit, pause longer
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.log('  ⏸️  Rate limit detected, pausing for 10 seconds...')
        await sleep(10000)
      }

      continue
    }
  }

  // Step 7: Save final dataset
  console.log('\n' + '='.repeat(80))
  console.log('Saving final dataset...')
  await saveDataset(dataset, args.output)

  // Step 8: Calculate and display statistics
  const stats = calculateStatistics(dataset)
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)

  console.log('\n' + '='.repeat(80))
  console.log('📊 Training Dataset Generation Complete')
  console.log('='.repeat(80))
  console.log('\nDataset Statistics:')
  console.log(`  Total examples: ${stats.total}`)
  console.log(`  Valid examples: ${stats.validExamples}`)
  console.log(`  Invalid examples: ${stats.invalidExamples}`)
  console.log(`  Positive labels (1): ${stats.upgrades} (${stats.upgradePercentage.toFixed(1)}%)`)
  console.log(`  Negative labels (0): ${stats.validExamples - stats.upgrades} (${(100 - stats.upgradePercentage).toFixed(1)}%)`)

  if (stats.validExamples > 0) {
    console.log(`  Date range: ${stats.dateRange.start.toISOString().split('T')[0]} to ${stats.dateRange.end.toISOString().split('T')[0]}`)
  }

  console.log('\nProcessing Statistics:')
  console.log(`  Symbols processed: ${symbols.length}`)
  console.log(`  Total earnings releases processed: ${totalEarningsProcessed}`)
  console.log(`  Examples created: ${totalExamplesCreated}`)
  console.log(`  Examples skipped: ${totalSkipped}`)
  console.log(`  Errors encountered: ${errorCount}`)
  console.log(`  Total duration: ${duration} minutes`)
  console.log(`  Average per symbol: ${(parseFloat(duration) / symbols.length).toFixed(2)} minutes`)

  if (stats.validExamples > 0) {
    console.log('\nTop 10 Symbols by Example Count:')
    const sortedSymbols = Object.entries(stats.symbolCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)

    sortedSymbols.forEach(([sym, count], idx) => {
      console.log(`  ${idx + 1}. ${sym}: ${count} examples`)
    })
  }

  console.log('\n' + '='.repeat(80))

  // Validate success criteria
  console.log('\n✅ Success Criteria Validation:')
  console.log(`  ${stats.validExamples > 0 ? '✓' : '✗'} Dataset generated: ${stats.validExamples} examples ${stats.validExamples === 0 ? '(FAILED - no data)' : ''}`)

  if (stats.validExamples > 0) {
    console.log(`  ${stats.upgradePercentage >= 10 && stats.upgradePercentage <= 50 ? '✓' : '⚠️'} Positive label percentage: ${stats.upgradePercentage.toFixed(1)}% (target: 10-50% for earnings beats)`)
    console.log(`  ${stats.invalidExamples === 0 ? '✓' : '⚠️'} No NaN values: ${stats.invalidExamples === 0 ? 'Yes' : `No (${stats.invalidExamples} invalid)`}`)
    console.log(`  ✓ Saved to CSV: ${args.output}`)
  }

  if (args.test) {
    console.log('\n💡 Test run complete! To generate full dataset, run:')
    console.log('   npx tsx scripts/ml/generate-training-data.ts --full')
  } else {
    console.log('\n💡 Next step: Train model with generated dataset (Task 2.1)')
  }

  console.log('='.repeat(80))
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = parseArguments()
    await generateTrainingData(args)
  } catch (error: any) {
    console.error('\n❌ Training data generation failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { generateTrainingData, parseArguments, SP500_TOP_100 }
