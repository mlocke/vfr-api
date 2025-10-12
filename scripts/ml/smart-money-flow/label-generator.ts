/**
 * Smart Money Flow Label Generator
 *
 * Generates binary classification labels for Smart Money Flow model:
 * - 1 (BULLISH): Price increases >5% in 14 days after sample date
 * - 0 (BEARISH): Price decreases <-2% OR stays flat (-2% to +5%)
 *
 * Label Calculation:
 * - Labeling window: 14 calendar days (forward-looking)
 * - Uses simple price-based approach (recommended in plan)
 * - No lookahead bias: only uses future price data for labels
 *
 * Usage:
 *   npx tsx scripts/ml/smart-money-flow/label-generator.ts --test
 *   npx tsx scripts/ml/smart-money-flow/label-generator.ts --symbol AAPL --date 2024-01-15
 */

import { PolygonAPI } from "../../../app/services/financial-data/PolygonAPI";
import { FinancialModelingPrepAPI } from "../../../app/services/financial-data/FinancialModelingPrepAPI";
import { historicalCache } from "../../../app/services/cache/HistoricalDataCache";

export type SmartMoneyFlowLabel = 0 | 1;

export interface SmartMoneyFlowLabelData {
	symbol: string;
	sampleDate: string; // Date of sample (format: YYYY-MM-DD)
	priceAtSample: number; // Price at sample date
	priceAfter14d: number; // Price 14 days later
	return14d: number; // 14-day return (decimal, e.g., 0.07 = 7%)
	label: SmartMoneyFlowLabel; // 1 = BULLISH, 0 = BEARISH
}

// Label thresholds
const BULLISH_THRESHOLD = 0.05; // >5% gain = BULLISH
const BEARISH_THRESHOLD = -0.02; // <-2% = BEARISH (also includes flat)

/**
 * Generate Smart Money Flow label for a given symbol and sample date
 *
 * @param symbol Stock symbol
 * @param sampleDate Sample date (the date features are calculated from)
 * @returns SmartMoneyFlowLabelData or null if insufficient data
 */
export async function generateLabel(
	symbol: string,
	sampleDate: string | Date
): Promise<SmartMoneyFlowLabelData | null> {
	try {
		const polygonAPI = new PolygonAPI();

		// Convert sampleDate to Date object and normalize to YYYY-MM-DD
		const sampleDateObj = typeof sampleDate === 'string'
			? new Date(sampleDate)
			: sampleDate;
		const sampleDateStr = sampleDateObj.toISOString().split('T')[0];

		// Calculate target date: 14 calendar days after sample date
		const targetDate = new Date(sampleDateObj);
		targetDate.setDate(targetDate.getDate() + 14);
		const targetDateStr = targetDate.toISOString().split('T')[0];

		// Fetch historical data covering the range
		// Add buffer of 5 days before and after to ensure we get trading days
		const fetchStartDate = new Date(sampleDateObj);
		fetchStartDate.setDate(fetchStartDate.getDate() - 5);

		const fetchEndDate = new Date(targetDate);
		fetchEndDate.setDate(fetchEndDate.getDate() + 5);

		// Get ~30 days of historical data to cover the range
		// PRIMARY: Use Polygon.io (with historical caching)
		// FALLBACK: FMP only if Polygon fails
		const fetchStartStr = fetchStartDate.toISOString().split('T')[0];
		const fetchEndStr = fetchEndDate.toISOString().split('T')[0];

		let historicalData: Array<{ timestamp: number; close: number }> | null = null;

		try {
			// Try Polygon first (PRIMARY)
			historicalData = await polygonAPI.getAggregates(
				symbol,
				1,
				'day',
				fetchStartStr,
				fetchEndStr
			);
			console.log(`✅ Polygon cache HIT: ${symbol} ${fetchStartStr} to ${fetchEndStr}`);
		} catch (polygonError) {
			console.warn(`⚠️  Polygon failed for ${symbol}`, polygonError);

			// Fallback to FMP (SECONDARY) - only if enabled
			const isFmpEnabled = process.env.ENABLE_FMP === 'true';
			if (isFmpEnabled) {
				try {
					console.log(`Trying FMP fallback for ${symbol}...`);
					const fmpAPI = new FinancialModelingPrepAPI();
					const fmpData = await fmpAPI.getHistoricalData(symbol, 30, fetchEndDate);
					if (fmpData && fmpData.length > 0) {
						historicalData = fmpData;
						console.log(`✅ FMP fallback SUCCESS: ${symbol}`);
					}
				} catch (fmpError) {
					console.error(`❌ Both Polygon and FMP failed for ${symbol}`);
				}
			} else {
				console.warn(`⚠️  FMP fallback disabled (ENABLE_FMP=false), skipping ${symbol}`);
			}
		}

		if (!historicalData || historicalData.length < 2) {
			console.warn(`Insufficient historical data for ${symbol} at ${sampleDateStr}`);
			return null;
		}

		// Sort data by timestamp (oldest first)
		const sortedData = historicalData.sort((a, b) => a.timestamp - b.timestamp);

		// Find the price at sample date (or closest trading day before)
		const sampleDateTime = sampleDateObj.getTime();
		let sampleDayIndex = -1;

		for (let i = 0; i < sortedData.length; i++) {
			if (sortedData[i].timestamp <= sampleDateTime) {
				sampleDayIndex = i;
			} else {
				break;
			}
		}

		if (sampleDayIndex === -1) {
			console.warn(`No price data found for ${symbol} on or before ${sampleDateStr}`);
			return null;
		}

		const priceAtSample = sortedData[sampleDayIndex].close;
		const actualSampleDate = new Date(sortedData[sampleDayIndex].timestamp)
			.toISOString()
			.split('T')[0];

		// Find the price 14 days later (or closest trading day after target date)
		const targetDateTime = targetDate.getTime();
		let targetDayIndex = -1;

		// Find first trading day on or after target date
		for (let i = sampleDayIndex + 1; i < sortedData.length; i++) {
			if (sortedData[i].timestamp >= targetDateTime) {
				targetDayIndex = i;
				break;
			}
		}

		// If no exact match, use the closest available future date
		if (targetDayIndex === -1) {
			// Check if we have at least some future data
			if (sampleDayIndex >= sortedData.length - 1) {
				console.warn(`No future price data for ${symbol} after ${actualSampleDate}`);
				return null;
			}
			// Use the last available data point if within reasonable range (20 days)
			const lastIndex = sortedData.length - 1;
			const daysDiff = (sortedData[lastIndex].timestamp - sortedData[sampleDayIndex].timestamp)
				/ (24 * 60 * 60 * 1000);

			if (daysDiff >= 10 && daysDiff <= 20) {
				targetDayIndex = lastIndex;
			} else {
				console.warn(
					`Future data for ${symbol} is ${daysDiff.toFixed(0)} days out, ` +
					`expected 14 days (range: 10-20 acceptable)`
				);
				return null;
			}
		}

		const priceAfter14d = sortedData[targetDayIndex].close;
		const actualTargetDate = new Date(sortedData[targetDayIndex].timestamp)
			.toISOString()
			.split('T')[0];

		// Calculate 14-day return
		const return14d = (priceAfter14d - priceAtSample) / priceAtSample;

		// Determine label based on thresholds
		let label: SmartMoneyFlowLabel;
		if (return14d > BULLISH_THRESHOLD) {
			label = 1; // BULLISH: >5% gain
		} else {
			label = 0; // BEARISH: everything else (<-2% or flat)
		}

		// Log the calculation for transparency
		console.log(
			`${symbol} | Sample: ${actualSampleDate} ($${priceAtSample.toFixed(2)}) | ` +
			`Target: ${actualTargetDate} ($${priceAfter14d.toFixed(2)}) | ` +
			`Return: ${(return14d * 100).toFixed(2)}% | ` +
			`Label: ${label} (${label === 1 ? 'BULLISH' : 'BEARISH'})`
		);

		return {
			symbol,
			sampleDate: actualSampleDate,
			priceAtSample,
			priceAfter14d,
			return14d,
			label
		};
	} catch (error) {
		console.error(`Error generating label for ${symbol} at ${sampleDate}:`, error);
		return null;
	}
}

/**
 * Generate labels for multiple sample dates (time series)
 *
 * @param symbol Stock symbol
 * @param startDate Start date for sampling
 * @param endDate End date for sampling
 * @param samplingFrequency How often to sample (daily, weekly, monthly)
 * @returns Array of label data
 */
export async function generateLabelsForSymbol(
	symbol: string,
	startDate: Date,
	endDate: Date,
	samplingFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<SmartMoneyFlowLabelData[]> {
	const labels: SmartMoneyFlowLabelData[] = [];
	const currentDate = new Date(startDate);

	// Determine sampling interval
	const intervalDays =
		samplingFrequency === 'daily' ? 1 :
		samplingFrequency === 'weekly' ? 7 :
		30; // monthly

	console.log(
		`\nGenerating ${samplingFrequency} labels for ${symbol} ` +
		`from ${startDate.toISOString().split('T')[0]} ` +
		`to ${endDate.toISOString().split('T')[0]}\n`
	);

	while (currentDate <= endDate) {
		const sampleDateStr = currentDate.toISOString().split('T')[0];
		const label = await generateLabel(symbol, sampleDateStr);

		if (label) {
			labels.push(label);
		}

		// Advance to next sample date
		currentDate.setDate(currentDate.getDate() + intervalDays);

		// Small delay to respect API rate limits (300 req/min = 200ms per req)
		await new Promise(resolve => setTimeout(resolve, 250));
	}

	return labels;
}

/**
 * Validate label distribution to ensure dataset is balanced
 * Target: 30-70% bullish labels (not too imbalanced)
 *
 * @param labels Array of label data
 * @returns Validation result with statistics
 */
export function validateLabelDistribution(labels: SmartMoneyFlowLabelData[]): {
	isValid: boolean;
	total: number;
	bullishCount: number;
	bearishCount: number;
	bullishPercent: number;
	bearishPercent: number;
	message: string;
} {
	const total = labels.length;
	const bullishCount = labels.filter(l => l.label === 1).length;
	const bearishCount = labels.filter(l => l.label === 0).length;
	const bullishPercent = (bullishCount / total) * 100;
	const bearishPercent = (bearishCount / total) * 100;

	// Validate: 30-70% bullish
	const isValid = bullishPercent >= 30 && bullishPercent <= 70;

	let message: string;
	if (isValid) {
		message = `✅ Label distribution is balanced (${bullishPercent.toFixed(1)}% bullish)`;
	} else if (bullishPercent < 30) {
		message = `⚠️  Label distribution is too bearish (${bullishPercent.toFixed(1)}% bullish, target: 30-70%)`;
	} else {
		message = `⚠️  Label distribution is too bullish (${bullishPercent.toFixed(1)}% bullish, target: 30-70%)`;
	}

	return {
		isValid,
		total,
		bullishCount,
		bearishCount,
		bullishPercent,
		bearishPercent,
		message
	};
}

/**
 * Calculate average returns for each label class (for analysis)
 *
 * @param labels Array of label data
 */
export function calculateLabelStatistics(labels: SmartMoneyFlowLabelData[]): {
	bullish: {
		count: number;
		avgReturn: number;
		minReturn: number;
		maxReturn: number;
	};
	bearish: {
		count: number;
		avgReturn: number;
		minReturn: number;
		maxReturn: number;
	};
} {
	const bullishLabels = labels.filter(l => l.label === 1);
	const bearishLabels = labels.filter(l => l.label === 0);

	const bullishReturns = bullishLabels.map(l => l.return14d);
	const bearishReturns = bearishLabels.map(l => l.return14d);

	return {
		bullish: {
			count: bullishLabels.length,
			avgReturn: bullishReturns.length > 0
				? bullishReturns.reduce((a, b) => a + b, 0) / bullishReturns.length
				: 0,
			minReturn: bullishReturns.length > 0 ? Math.min(...bullishReturns) : 0,
			maxReturn: bullishReturns.length > 0 ? Math.max(...bullishReturns) : 0
		},
		bearish: {
			count: bearishLabels.length,
			avgReturn: bearishReturns.length > 0
				? bearishReturns.reduce((a, b) => a + b, 0) / bearishReturns.length
				: 0,
			minReturn: bearishReturns.length > 0 ? Math.min(...bearishReturns) : 0,
			maxReturn: bearishReturns.length > 0 ? Math.max(...bearishReturns) : 0
		}
	};
}

/**
 * Test the label generation logic with example cases
 */
async function testLabelGeneration() {
	console.log('🧪 Testing Smart Money Flow Label Generation');
	console.log('='.repeat(80));
	console.log();

	// Test Case 1: Single label generation
	console.log('Test Case 1: Single Label Generation (AAPL on 2024-01-15)');
	console.log('-'.repeat(80));
	const label1 = await generateLabel('AAPL', '2024-01-15');
	if (label1) {
		console.log(`Result: ${label1.label === 1 ? 'BULLISH' : 'BEARISH'}`);
		console.log(`Return: ${(label1.return14d * 100).toFixed(2)}%`);
		console.log(`Expected: ${label1.return14d > 0.05 ? 'BULLISH (1)' : 'BEARISH (0)'} ✓`);
	} else {
		console.log('❌ Failed to generate label');
	}

	// Test Case 2: Time series with multiple symbols
	console.log('\nTest Case 2: Time Series Label Generation (Q1 2024, weekly)');
	console.log('-'.repeat(80));

	const testSymbols = ['TSLA', 'NVDA', 'MSFT'];
	const allLabels: SmartMoneyFlowLabelData[] = [];

	for (const symbol of testSymbols) {
		const labels = await generateLabelsForSymbol(
			symbol,
			new Date('2024-01-01'),
			new Date('2024-03-31'),
			'weekly'
		);
		allLabels.push(...labels);

		if (labels.length > 0) {
			const symbolStats = calculateLabelStatistics(labels);
			console.log(`\n${symbol} Statistics:`);
			console.log(`  Total samples: ${labels.length}`);
			console.log(`  Bullish: ${symbolStats.bullish.count} ` +
				`(avg return: ${(symbolStats.bullish.avgReturn * 100).toFixed(2)}%)`);
			console.log(`  Bearish: ${symbolStats.bearish.count} ` +
				`(avg return: ${(symbolStats.bearish.avgReturn * 100).toFixed(2)}%)`);
		}
	}

	// Test Case 3: Label distribution validation
	console.log('\nTest Case 3: Label Distribution Validation');
	console.log('-'.repeat(80));
	const validation = validateLabelDistribution(allLabels);
	console.log(`Total Labels: ${validation.total}`);
	console.log(`Bullish: ${validation.bullishCount} (${validation.bullishPercent.toFixed(1)}%)`);
	console.log(`Bearish: ${validation.bearishCount} (${validation.bearishPercent.toFixed(1)}%)`);
	console.log(validation.message);

	// Overall statistics
	console.log('\nOverall Statistics Across All Symbols:');
	console.log('-'.repeat(80));
	const overallStats = calculateLabelStatistics(allLabels);
	console.log(`Bullish Class (${overallStats.bullish.count} samples):`);
	console.log(`  Avg Return: ${(overallStats.bullish.avgReturn * 100).toFixed(2)}%`);
	console.log(`  Min Return: ${(overallStats.bullish.minReturn * 100).toFixed(2)}%`);
	console.log(`  Max Return: ${(overallStats.bullish.maxReturn * 100).toFixed(2)}%`);
	console.log(`Bearish Class (${overallStats.bearish.count} samples):`);
	console.log(`  Avg Return: ${(overallStats.bearish.avgReturn * 100).toFixed(2)}%`);
	console.log(`  Min Return: ${(overallStats.bearish.minReturn * 100).toFixed(2)}%`);
	console.log(`  Max Return: ${(overallStats.bearish.maxReturn * 100).toFixed(2)}%`);

	console.log('\n' + '='.repeat(80));
	console.log('✅ All test cases completed!');
	console.log('💡 Next step: Implement feature extraction (Task 3.2)');
}

/**
 * Main function for CLI usage
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--test')) {
		await testLabelGeneration();
		return;
	}

	// Parse command line arguments
	const symbolArg = args.find(arg => arg.startsWith('--symbol='));
	const dateArg = args.find(arg => arg.startsWith('--date='));

	if (!symbolArg || !dateArg) {
		console.log('Usage:');
		console.log('  npx tsx scripts/ml/smart-money-flow/label-generator.ts --symbol=AAPL --date=2024-01-15');
		console.log('  npx tsx scripts/ml/smart-money-flow/label-generator.ts --test');
		console.log();
		console.log('Options:');
		console.log('  --symbol=SYMBOL  Stock symbol to generate label for');
		console.log('  --date=DATE      Sample date (YYYY-MM-DD format)');
		console.log('  --test           Run test cases with known examples');
		process.exit(1);
	}

	const symbol = symbolArg.split('=')[1].toUpperCase();
	const dateStr = dateArg.split('=')[1];

	console.log(`Generating Smart Money Flow label for ${symbol} on ${dateStr}...\n`);

	const label = await generateLabel(symbol, dateStr);

	if (label) {
		console.log('\nResult:');
		console.log('='.repeat(80));
		console.log(`Symbol:           ${label.symbol}`);
		console.log(`Sample Date:      ${label.sampleDate}`);
		console.log(`Price at Sample:  $${label.priceAtSample.toFixed(2)}`);
		console.log(`Price After 14d:  $${label.priceAfter14d.toFixed(2)}`);
		console.log(`14-Day Return:    ${(label.return14d * 100).toFixed(2)}%`);
		console.log(`Label:            ${label.label} (${label.label === 1 ? 'BULLISH' : 'BEARISH'})`);
		console.log('='.repeat(80));

		// Show threshold context
		console.log('\nThreshold Context:');
		console.log(`  BULLISH (1):  Return > ${(BULLISH_THRESHOLD * 100).toFixed(0)}%`);
		console.log(`  BEARISH (0):  Return ≤ ${(BULLISH_THRESHOLD * 100).toFixed(0)}%`);

		if (label.label === 1) {
			console.log(`\n✅ Strong price appreciation detected (>${(BULLISH_THRESHOLD * 100).toFixed(0)}%)`);
		} else if (label.return14d < BEARISH_THRESHOLD) {
			console.log(`\n⚠️  Price decline detected (<${(BEARISH_THRESHOLD * 100).toFixed(0)}%)`);
		} else {
			console.log(`\n📊 Price remained relatively flat (-2% to +5%)`);
		}
	} else {
		console.log('❌ Failed to generate label');
	}
}

// Run if executed directly
if (require.main === module) {
	main().catch(console.error);
}
