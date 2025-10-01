/**
 * Training Dataset Validation Script for ML Early Signal Detection
 *
 * Task 1.6: Data Validation
 * Estimated Time: 1h
 * Purpose: Validate training dataset quality before model training
 *
 * Validation Checks:
 * 1. Completeness: >90% features populated
 * 2. Label balance: 10-50% positive labels (earnings beats)
 * 3. No extreme outliers (cap at 99th percentile)
 * 4. No temporal leakage
 * 5. All symbols represented
 *
 * Usage:
 *   npx tsx scripts/ml/validate-training-data.ts
 *   npx tsx scripts/ml/validate-training-data.ts --input data/training/early-signal-v1.csv
 */

import * as fs from 'fs'
import * as path from 'path'

/**
 * Training example interface (matches TrainingExample from types.ts)
 */
interface TrainingExample {
  symbol: string
  date: Date
  price_change_5d: number
  price_change_10d: number
  price_change_20d: number
  volume_ratio: number
  volume_trend: number
  sentiment_news_delta: number
  sentiment_reddit_accel: number
  sentiment_options_shift: number
  earnings_surprise: number
  revenue_growth_accel: number
  analyst_coverage_change: number
  rsi_momentum: number
  macd_histogram_trend: number
  label: number
}

/**
 * Validation result interface
 */
interface ValidationResult {
  checkName: string
  passed: boolean
  details: string
  severity: 'CRITICAL' | 'WARNING' | 'INFO'
}

/**
 * Parse CSV file into training examples
 */
function parseCSV(filepath: string): TrainingExample[] {
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.trim().split('\n')

  // Skip header
  const dataLines = lines.slice(1)

  return dataLines.map(line => {
    const parts = line.split(',')

    return {
      symbol: parts[0],
      date: new Date(parts[1]),
      price_change_5d: parseFloat(parts[2]),
      price_change_10d: parseFloat(parts[3]),
      price_change_20d: parseFloat(parts[4]),
      volume_ratio: parseFloat(parts[5]),
      volume_trend: parseFloat(parts[6]),
      sentiment_news_delta: parseFloat(parts[7]),
      sentiment_reddit_accel: parseFloat(parts[8]),
      sentiment_options_shift: parseFloat(parts[9]),
      earnings_surprise: parseFloat(parts[10]),
      revenue_growth_accel: parseFloat(parts[11]),
      analyst_coverage_change: parseFloat(parts[12]),
      rsi_momentum: parseFloat(parts[13]),
      macd_histogram_trend: parseFloat(parts[14]),
      label: parseInt(parts[15], 10)
    }
  })
}

/**
 * Check 1: Completeness - >90% features populated (no NaN/null)
 */
function validateCompleteness(dataset: TrainingExample[]): ValidationResult {
  const featureNames = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend'
  ]

  let totalValues = 0
  let validValues = 0

  dataset.forEach(example => {
    featureNames.forEach(feature => {
      totalValues++
      const value = (example as any)[feature]
      if (!isNaN(value) && value !== null && value !== undefined) {
        validValues++
      }
    })
  })

  const completeness = (validValues / totalValues) * 100
  const passed = completeness >= 90

  return {
    checkName: 'Completeness',
    passed,
    details: `${completeness.toFixed(2)}% features populated (${validValues}/${totalValues}). Target: >90%`,
    severity: passed ? 'INFO' : 'CRITICAL'
  }
}

/**
 * Check 2: Label balance - 10-50% positive labels
 */
function validateLabelBalance(dataset: TrainingExample[]): ValidationResult {
  const positiveLabels = dataset.filter(ex => ex.label === 1).length
  const totalLabels = dataset.length
  const positivePercentage = (positiveLabels / totalLabels) * 100

  const passed = positivePercentage >= 10 && positivePercentage <= 50

  return {
    checkName: 'Label Balance',
    passed,
    details: `${positivePercentage.toFixed(2)}% positive labels (${positiveLabels}/${totalLabels}). Target: 10-50%`,
    severity: passed ? 'INFO' : 'WARNING'
  }
}

/**
 * Check 3: No extreme outliers (cap at 99th percentile)
 */
function validateOutliers(dataset: TrainingExample[]): ValidationResult {
  const featureNames = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend'
  ]

  const outlierDetails: string[] = []
  let totalOutliers = 0

  featureNames.forEach(feature => {
    const values = dataset.map(ex => (ex as any)[feature]).filter(v => !isNaN(v))
    values.sort((a, b) => a - b)

    const p99Index = Math.floor(values.length * 0.99)
    const p99Value = values[p99Index]

    const p1Index = Math.floor(values.length * 0.01)
    const p1Value = values[p1Index]

    const outliers = values.filter(v => v > p99Value || v < p1Value).length

    if (outliers > 0) {
      totalOutliers += outliers
      outlierDetails.push(`${feature}: ${outliers} outliers (range: ${p1Value.toFixed(2)} to ${p99Value.toFixed(2)})`)
    }
  })

  const outlierPercentage = (totalOutliers / (dataset.length * featureNames.length)) * 100
  const passed = outlierPercentage < 5

  return {
    checkName: 'Outlier Detection',
    passed,
    details: `${outlierPercentage.toFixed(2)}% outliers detected. ${passed ? 'Within acceptable range.' : outlierDetails.slice(0, 3).join('; ')}`,
    severity: passed ? 'INFO' : 'WARNING'
  }
}

/**
 * Check 4: No temporal leakage (dates in chronological order within symbol)
 */
function validateTemporalLeakage(dataset: TrainingExample[]): ValidationResult {
  const symbolGroups = new Map<string, Date[]>()

  dataset.forEach(example => {
    if (!symbolGroups.has(example.symbol)) {
      symbolGroups.set(example.symbol, [])
    }
    symbolGroups.get(example.symbol)!.push(example.date)
  })

  let leakageCount = 0
  const leakageSymbols: string[] = []

  symbolGroups.forEach((dates, symbol) => {
    // Check if dates are in chronological order
    for (let i = 1; i < dates.length; i++) {
      if (dates[i] < dates[i - 1]) {
        leakageCount++
        if (!leakageSymbols.includes(symbol)) {
          leakageSymbols.push(symbol)
        }
      }
    }
  })

  const passed = leakageCount === 0

  return {
    checkName: 'Temporal Leakage',
    passed,
    details: passed
      ? 'No temporal leakage detected. Dates are in chronological order.'
      : `${leakageCount} instances of temporal leakage in ${leakageSymbols.length} symbols: ${leakageSymbols.slice(0, 5).join(', ')}`,
    severity: passed ? 'INFO' : 'CRITICAL'
  }
}

/**
 * Check 5: All symbols represented (min 1 example per symbol)
 */
function validateSymbolRepresentation(dataset: TrainingExample[], expectedSymbols?: string[]): ValidationResult {
  const symbolCounts = new Map<string, number>()

  dataset.forEach(example => {
    symbolCounts.set(example.symbol, (symbolCounts.get(example.symbol) || 0) + 1)
  })

  const uniqueSymbols = symbolCounts.size
  const missingSymbols: string[] = []

  if (expectedSymbols) {
    expectedSymbols.forEach(symbol => {
      if (!symbolCounts.has(symbol)) {
        missingSymbols.push(symbol)
      }
    })
  }

  const passed = missingSymbols.length === 0 && uniqueSymbols > 0

  return {
    checkName: 'Symbol Representation',
    passed: expectedSymbols ? passed : uniqueSymbols > 0,
    details: expectedSymbols
      ? `${uniqueSymbols} unique symbols. ${missingSymbols.length > 0 ? `Missing: ${missingSymbols.slice(0, 10).join(', ')}` : 'All symbols represented.'}`
      : `${uniqueSymbols} unique symbols represented`,
    severity: passed || !expectedSymbols ? 'INFO' : 'WARNING'
  }
}

/**
 * Additional check: Feature statistics summary
 */
function calculateFeatureStatistics(dataset: TrainingExample[]): string {
  const featureNames = [
    'price_change_5d', 'price_change_10d', 'price_change_20d',
    'volume_ratio', 'volume_trend',
    'sentiment_news_delta', 'sentiment_reddit_accel', 'sentiment_options_shift',
    'earnings_surprise', 'revenue_growth_accel', 'analyst_coverage_change',
    'rsi_momentum', 'macd_histogram_trend'
  ]

  const stats: string[] = []

  featureNames.forEach(feature => {
    const values = dataset.map(ex => (ex as any)[feature]).filter(v => !isNaN(v))

    if (values.length === 0) {
      stats.push(`${feature}: No valid values`)
      return
    }

    const sum = values.reduce((a, b) => a + b, 0)
    const mean = sum / values.length
    const sortedValues = [...values].sort((a, b) => a - b)
    const median = sortedValues[Math.floor(sortedValues.length / 2)]
    const min = sortedValues[0]
    const max = sortedValues[sortedValues.length - 1]

    stats.push(`  ${feature}: mean=${mean.toFixed(3)}, median=${median.toFixed(3)}, range=[${min.toFixed(3)}, ${max.toFixed(3)}]`)
  })

  return stats.join('\n')
}

/**
 * Main validation function
 */
async function validateTrainingData(inputPath: string): Promise<void> {
  console.log('🔍 ML Early Signal - Training Dataset Validation')
  console.log('Task 1.6: Data Validation')
  console.log('='.repeat(80))

  // Check if file exists
  if (!fs.existsSync(inputPath)) {
    console.error(`\n❌ ERROR: Input file not found: ${inputPath}`)
    console.log('\n💡 Generate training data first:')
    console.log('   npx tsx scripts/ml/generate-training-data.ts --test')
    process.exit(1)
  }

  console.log(`\nInput file: ${inputPath}`)
  console.log(`File size: ${(fs.statSync(inputPath).size / 1024).toFixed(2)} KB`)

  // Parse dataset
  console.log('\nLoading dataset...')
  const dataset = parseCSV(inputPath)
  console.log(`✓ Loaded ${dataset.length} training examples`)

  // Run validation checks
  console.log('\n' + '='.repeat(80))
  console.log('Running validation checks...')
  console.log('='.repeat(80))

  const results: ValidationResult[] = [
    validateCompleteness(dataset),
    validateLabelBalance(dataset),
    validateOutliers(dataset),
    validateTemporalLeakage(dataset),
    validateSymbolRepresentation(dataset)
  ]

  // Display results
  let allPassed = true
  let criticalFailed = false

  results.forEach((result, idx) => {
    const statusIcon = result.passed ? '✅' : (result.severity === 'CRITICAL' ? '❌' : '⚠️')
    console.log(`\n${idx + 1}. ${result.checkName}: ${statusIcon}`)
    console.log(`   ${result.details}`)

    if (!result.passed) {
      allPassed = false
      if (result.severity === 'CRITICAL') {
        criticalFailed = true
      }
    }
  })

  // Display feature statistics
  console.log('\n' + '='.repeat(80))
  console.log('Feature Statistics:')
  console.log('='.repeat(80))
  console.log(calculateFeatureStatistics(dataset))

  // Final summary
  console.log('\n' + '='.repeat(80))
  console.log('Validation Summary')
  console.log('='.repeat(80))

  const passedCount = results.filter(r => r.passed).length
  const warningCount = results.filter(r => !r.passed && r.severity === 'WARNING').length
  const criticalCount = results.filter(r => !r.passed && r.severity === 'CRITICAL').length

  console.log(`\n✅ Passed: ${passedCount}/${results.length} checks`)
  if (warningCount > 0) {
    console.log(`⚠️  Warnings: ${warningCount}`)
  }
  if (criticalCount > 0) {
    console.log(`❌ Critical failures: ${criticalCount}`)
  }

  if (allPassed) {
    console.log('\n🎉 All validation checks passed! Dataset is ready for model training.')
    console.log('\n💡 Next step: Create train/val/test splits (Task 1.7)')
    console.log('   npx tsx scripts/ml/split-training-data.ts')
  } else if (criticalFailed) {
    console.log('\n❌ Critical validation failures detected. Please fix issues before training.')
    console.log('\n💡 Suggestions:')
    if (results[0].severity === 'CRITICAL' && !results[0].passed) {
      console.log('   - Re-generate training data with better error handling')
    }
    if (results[3].severity === 'CRITICAL' && !results[3].passed) {
      console.log('   - Check data collection logic for temporal ordering')
    }
    process.exit(1)
  } else {
    console.log('\n⚠️  Some warnings detected. Review above and decide if acceptable for MVP.')
    console.log('\n💡 You can proceed to next step or re-generate data:')
    console.log('   npx tsx scripts/ml/split-training-data.ts (proceed)')
    console.log('   npx tsx scripts/ml/generate-training-data.ts --full (re-generate)')
  }

  console.log('\n' + '='.repeat(80))
}

/**
 * Parse command-line arguments
 */
function parseArguments(): string {
  const args = process.argv.slice(2)
  let inputPath = 'data/training/early-signal-v1.csv'

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && i + 1 < args.length) {
      inputPath = args[++i]
    }
  }

  return path.resolve(inputPath)
}

/**
 * Main execution
 */
async function main() {
  try {
    const inputPath = parseArguments()
    await validateTrainingData(inputPath)
  } catch (error: any) {
    console.error('\n❌ Validation failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { validateTrainingData, parseCSV }
