/**
 * Train/Val/Test Split Script for ML Early Signal Detection
 *
 * Task 1.7: Train/Val/Test Split
 * Estimated Time: 30min
 * Purpose: Split training dataset into temporal train/validation/test sets
 *
 * Split Strategy (Temporal - no data leakage):
 *   - Train: 2022-01-01 to 2024-06-30 (80%)
 *   - Validation: 2024-07-01 to 2024-09-30 (10%)
 *   - Test: 2024-10-01 to 2024-12-31 (10%)
 *
 * Usage:
 *   npx tsx scripts/ml/split-training-data.ts
 *   npx tsx scripts/ml/split-training-data.ts --input data/training/custom.csv
 */

import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Command-line arguments interface
 */
interface CLIArgs {
  input: string
  outputDir: string
  trainStart: Date
  trainEnd: Date
  valStart: Date
  valEnd: Date
  testStart: Date
  testEnd: Date
}

/**
 * Parse command-line arguments
 */
function parseArguments(): CLIArgs {
  const args = process.argv.slice(2)
  const parsed: CLIArgs = {
    input: 'data/training/early-signal-v1.csv',
    outputDir: 'data/training',
    trainStart: new Date('2022-01-01'),
    trainEnd: new Date('2024-06-30'),
    valStart: new Date('2024-07-01'),
    valEnd: new Date('2024-09-30'),
    testStart: new Date('2024-10-01'),
    testEnd: new Date('2024-12-31')
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--input' && i + 1 < args.length) {
      parsed.input = args[++i]
    } else if (arg === '--output-dir' && i + 1 < args.length) {
      parsed.outputDir = args[++i]
    }
  }

  return parsed
}

/**
 * Split dataset by date ranges
 */
function splitDataset(args: CLIArgs): void {
  console.log('📊 ML Early Signal - Train/Val/Test Split')
  console.log('Task 1.7: Train/Val/Test Split')
  console.log('='.repeat(80))

  // Read input CSV
  const inputPath = path.resolve(args.input)
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`)
  }

  console.log(`\nReading dataset from: ${inputPath}`)
  const csvContent = fs.readFileSync(inputPath, 'utf-8')
  const lines = csvContent.split('\n').filter(line => line.trim())

  if (lines.length < 2) {
    throw new Error('Dataset is empty or contains only header')
  }

  const header = lines[0]
  const dataRows = lines.slice(1)

  console.log(`✓ Loaded ${dataRows.length} examples`)

  // Initialize split arrays
  const trainRows: string[] = []
  const valRows: string[] = []
  const testRows: string[] = []
  let skippedRows = 0

  // Process each row and assign to appropriate split
  dataRows.forEach((row, idx) => {
    try {
      const columns = row.split(',')
      if (columns.length < 2) {
        skippedRows++
        return
      }

      const dateStr = columns[1] // date is second column
      const rowDate = new Date(dateStr)

      // Validate date
      if (isNaN(rowDate.getTime())) {
        console.warn(`Warning: Invalid date on row ${idx + 2}: ${dateStr}`)
        skippedRows++
        return
      }

      // Assign to split based on date range
      if (rowDate >= args.trainStart && rowDate <= args.trainEnd) {
        trainRows.push(row)
      } else if (rowDate >= args.valStart && rowDate <= args.valEnd) {
        valRows.push(row)
      } else if (rowDate >= args.testStart && rowDate <= args.testEnd) {
        testRows.push(row)
      } else {
        skippedRows++
      }
    } catch (error: any) {
      console.warn(`Warning: Failed to process row ${idx + 2}: ${error.message}`)
      skippedRows++
    }
  })

  console.log('\nSplit Results:')
  console.log(`  Train: ${trainRows.length} examples (${args.trainStart.toISOString().split('T')[0]} to ${args.trainEnd.toISOString().split('T')[0]})`)
  console.log(`  Validation: ${valRows.length} examples (${args.valStart.toISOString().split('T')[0]} to ${args.valEnd.toISOString().split('T')[0]})`)
  console.log(`  Test: ${testRows.length} examples (${args.testStart.toISOString().split('T')[0]} to ${args.testEnd.toISOString().split('T')[0]})`)
  console.log(`  Skipped: ${skippedRows} examples (outside date ranges or invalid)`)

  // Calculate percentages
  const totalValid = trainRows.length + valRows.length + testRows.length
  const trainPct = (trainRows.length / totalValid * 100).toFixed(1)
  const valPct = (valRows.length / totalValid * 100).toFixed(1)
  const testPct = (testRows.length / totalValid * 100).toFixed(1)

  console.log('\nSplit Percentages:')
  console.log(`  Train: ${trainPct}%`)
  console.log(`  Validation: ${valPct}%`)
  console.log(`  Test: ${testPct}%`)

  // Save splits
  const outputDir = path.resolve(args.outputDir)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  const trainPath = path.join(outputDir, 'train.csv')
  const valPath = path.join(outputDir, 'val.csv')
  const testPath = path.join(outputDir, 'test.csv')

  console.log('\nSaving splits...')

  // Write train set
  const trainContent = [header, ...trainRows].join('\n')
  fs.writeFileSync(trainPath, trainContent, 'utf-8')
  console.log(`  ✓ Train set saved: ${trainPath}`)

  // Write validation set
  const valContent = [header, ...valRows].join('\n')
  fs.writeFileSync(valPath, valContent, 'utf-8')
  console.log(`  ✓ Validation set saved: ${valPath}`)

  // Write test set
  const testContent = [header, ...testRows].join('\n')
  fs.writeFileSync(testPath, testContent, 'utf-8')
  console.log(`  ✓ Test set saved: ${testPath}`)

  // Validation checks
  console.log('\n' + '='.repeat(80))
  console.log('✅ Success Criteria Validation:')

  const hasAllSplits = trainRows.length > 0 && valRows.length > 0 && testRows.length > 0
  console.log(`  ${hasAllSplits ? '✓' : '✗'} All splits created: ${hasAllSplits ? 'Yes' : 'No'}`)

  const trainPctNum = parseFloat(trainPct)
  const valPctNum = parseFloat(valPct)
  const testPctNum = parseFloat(testPct)
  const splitRatioOk = trainPctNum >= 70 && trainPctNum <= 90 && valPctNum >= 5 && testPctNum >= 5
  console.log(`  ${splitRatioOk ? '✓' : '⚠️'} Split ratio appropriate: Train ${trainPct}%, Val ${valPct}%, Test ${testPct}%`)

  const noTemporalOverlap = args.trainEnd < args.valStart && args.valEnd < args.testStart
  console.log(`  ${noTemporalOverlap ? '✓' : '✗'} No temporal overlap: ${noTemporalOverlap ? 'Yes' : 'No'}`)

  const allFilesSaved = fs.existsSync(trainPath) && fs.existsSync(valPath) && fs.existsSync(testPath)
  console.log(`  ${allFilesSaved ? '✓' : '✗'} All files saved: ${allFilesSaved ? 'Yes' : 'No'}`)

  console.log('\n' + '='.repeat(80))
  console.log('✅ Phase 1 Complete - Ready for Phase 2: Feature Engineering')
  console.log('='.repeat(80))
  console.log('\nNext Steps:')
  console.log('  1. Review split statistics above')
  console.log('  2. Begin Phase 2, Task 2.1: Feature Implementation Refinement')
  console.log('  3. Use train.csv for model training')
  console.log('  4. Use val.csv for hyperparameter tuning')
  console.log('  5. Use test.csv for final evaluation only')
  console.log('='.repeat(80))
}

/**
 * Main execution function
 */
async function main() {
  try {
    const args = parseArguments()
    splitDataset(args)
  } catch (error: any) {
    console.error('\n❌ Train/val/test split failed:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error)
}

export { splitDataset, parseArguments }
