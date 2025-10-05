/**
 * Update Macro Features in Existing Dataset
 *
 * Purpose: Update only the 5 macro feature columns (21-25) in the existing 1051-example
 * dataset with newly fixed values from the corrected FeatureExtractor.
 *
 * Context:
 * - Existing dataset: early-signal-combined-1051-v2.csv has 1051 examples
 * - Old macro features are mostly zeros (4 out of 5)
 * - FeatureExtractor has been fixed to return real macro values from FRED/BLS APIs
 * - Need to update only columns 21-25 without changing other features
 *
 * Columns to update:
 * - Column 22 (index 21): fed_rate_change_30d
 * - Column 23 (index 22): unemployment_rate_change
 * - Column 24 (index 23): cpi_inflation_rate
 * - Column 25 (index 24): gdp_growth_rate
 * - Column 26 (index 25): treasury_yield_10y
 *
 * Usage:
 *   npx tsx scripts/ml/update-macro-features.ts
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { EarlySignalFeatureExtractor } from '../../app/services/ml/early-signal/FeatureExtractor.js';

interface DatasetRow {
	symbol: string;
	date: string;
	values: string[];
	label: string;
}

// Paths
const INPUT_CSV = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/data/training/early-signal-combined-1051-v2.csv';
const OUTPUT_CSV = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/data/training/early-signal-v2-fixed-macro.csv';

// Macro feature column indices (0-indexed in the VALUES array, which excludes symbol/date)
// Pandas DataFrame indices: fed(21), unemp(22), cpi(23), gdp(24), treasury(25)
// Values array index = DataFrame index - 2 (to exclude symbol/date)
const MACRO_FEATURE_INDICES = {
	fed_rate_change_30d: 19,    // DataFrame index 21 - 2
	unemployment_rate_change: 20,  // DataFrame index 22 - 2
	cpi_inflation_rate: 21,     // DataFrame index 23 - 2
	gdp_growth_rate: 22,        // DataFrame index 24 - 2
	treasury_yield_10y: 23      // DataFrame index 25 - 2
};

async function updateMacroFeatures() {
	console.log('========================================');
	console.log('Update Macro Features Script');
	console.log('========================================\n');

	// Initialize feature extractor
	const featureExtractor = new EarlySignalFeatureExtractor();
	console.log('✓ Initialized FeatureExtractor\n');

	// Read existing CSV
	console.log(`Reading dataset: ${INPUT_CSV}`);
	const csvContent = fs.readFileSync(INPUT_CSV, 'utf-8');
	const lines = csvContent.trim().split('\n');

	if (lines.length === 0) {
		throw new Error('Empty CSV file');
	}

	const header = lines[0];
	const dataRows = lines.slice(1);

	console.log(`✓ Loaded ${dataRows.length} examples\n`);

	// Parse CSV rows
	const parsedRows: DatasetRow[] = dataRows.map(line => {
		const values = line.split(',');
		return {
			symbol: values[0],
			date: values[1],
			values: values.slice(2, -1), // All feature values (exclude symbol, date, label)
			label: values[values.length - 1]
		};
	});

	// Process each row and update macro features
	const updatedRows: string[] = [];
	let successCount = 0;
	let errorCount = 0;
	let cachedMacroData = new Map<string, any>(); // Cache by date to avoid redundant API calls

	console.log('Processing rows...\n');

	for (let i = 0; i < parsedRows.length; i++) {
		const row = parsedRows[i];
		const { symbol, date, values, label } = row;

		// Progress indicator
		if ((i + 1) % 100 === 0) {
			console.log(`Progress: ${i + 1}/${parsedRows.length} (${((i + 1) / parsedRows.length * 100).toFixed(1)}%)`);
		}

		try {
			// Get macro data for this date (use cache to avoid redundant API calls)
			let macroData;
			if (cachedMacroData.has(date)) {
				macroData = cachedMacroData.get(date);
			} else {
				const dateObj = new Date(date);
				// Access the private method using type assertion
				macroData = await (featureExtractor as any).getMacroeconomicData(dateObj);

				if (!macroData) {
					console.warn(`  Warning: No macro data for ${date}, using zeros`);
					macroData = {
						fedRateChange30d: 0,
						unemploymentRateChange: 0,
						cpiInflationRate: 0,
						gdpGrowthRate: 0,
						treasuryYield10y: 0
					};
				}

				cachedMacroData.set(date, macroData);
			}

			// Update only the 5 macro feature columns
			const updatedValues = [...values];
			updatedValues[MACRO_FEATURE_INDICES.fed_rate_change_30d] = String(macroData.fedRateChange30d || 0);
			updatedValues[MACRO_FEATURE_INDICES.unemployment_rate_change] = String(macroData.unemploymentRateChange || 0);
			updatedValues[MACRO_FEATURE_INDICES.cpi_inflation_rate] = String(macroData.cpiInflationRate || 0);
			updatedValues[MACRO_FEATURE_INDICES.gdp_growth_rate] = String(macroData.gdpGrowthRate || 0);
			updatedValues[MACRO_FEATURE_INDICES.treasury_yield_10y] = String(macroData.treasuryYield10y || 0);

			// Reconstruct CSV row
			const updatedRow = `${symbol},${date},${updatedValues.join(',')},${label}`;
			updatedRows.push(updatedRow);

			successCount++;
		} catch (error) {
			console.error(`  Error processing ${symbol} on ${date}:`, error);

			// Keep original values on error
			const originalRow = `${symbol},${date},${values.join(',')},${label}`;
			updatedRows.push(originalRow);

			errorCount++;
		}
	}

	console.log('\n========================================');
	console.log('Processing Complete');
	console.log('========================================');
	console.log(`Total rows: ${parsedRows.length}`);
	console.log(`Successful updates: ${successCount}`);
	console.log(`Errors: ${errorCount}`);
	console.log(`Unique dates cached: ${cachedMacroData.size}`);
	console.log('');

	// Log sample of updated macro values
	console.log('Sample of updated macro values:');
	const sampleSize = Math.min(5, updatedRows.length);
	for (let i = 0; i < sampleSize; i++) {
		const row = parsedRows[i];
		const updatedRowValues = updatedRows[i].split(',');
		console.log(`\n${row.symbol} (${row.date}):`);
		console.log(`  fed_rate_change_30d:       ${updatedRowValues[MACRO_FEATURE_INDICES.fed_rate_change_30d + 2]}`); // +2 for symbol, date
		console.log(`  unemployment_rate_change:  ${updatedRowValues[MACRO_FEATURE_INDICES.unemployment_rate_change + 2]}`);
		console.log(`  cpi_inflation_rate:        ${updatedRowValues[MACRO_FEATURE_INDICES.cpi_inflation_rate + 2]}`);
		console.log(`  gdp_growth_rate:           ${updatedRowValues[MACRO_FEATURE_INDICES.gdp_growth_rate + 2]}`);
		console.log(`  treasury_yield_10y:        ${updatedRowValues[MACRO_FEATURE_INDICES.treasury_yield_10y + 2]}`);
	}
	console.log('');

	// Write updated CSV
	console.log(`Writing updated dataset to: ${OUTPUT_CSV}`);
	const outputContent = header + '\n' + updatedRows.join('\n');
	fs.writeFileSync(OUTPUT_CSV, outputContent, 'utf-8');
	console.log('✓ Dataset written successfully\n');

	// Verify output
	const outputLines = fs.readFileSync(OUTPUT_CSV, 'utf-8').trim().split('\n');
	console.log(`✓ Verified: ${outputLines.length - 1} examples in output file\n`);

	console.log('========================================');
	console.log('Next Steps:');
	console.log('========================================');
	console.log('1. Split the dataset:');
	console.log('   python3 scripts/ml/split-new-dataset.py');
	console.log('');
	console.log('2. Train the model:');
	console.log('   python3 scripts/ml/train-lightgbm.py');
	console.log('');
	console.log('3. Evaluate the model:');
	console.log('   python3 scripts/ml/evaluate-test-set.py');
	console.log('');
	console.log('4. Check feature importance to verify macro features have non-zero importance');
	console.log('========================================\n');
}

// Run the script
updateMacroFeatures()
	.then(() => {
		console.log('✓ Script completed successfully');
		process.exit(0);
	})
	.catch(error => {
		console.error('✗ Script failed:', error);
		process.exit(1);
	});
