/**
 * Price Movement Label Generator
 *
 * Generates classification labels for price prediction model:
 * - UP: Price increased >2% in next 7 days
 * - DOWN: Price decreased <-2% in next 7 days
 * - NEUTRAL: Price change between -2% and +2%
 *
 * Usage:
 *   npx tsx scripts/ml/generate-price-labels.ts --symbol AAPL --date 2024-01-15
 *   npx tsx scripts/ml/generate-price-labels.ts --test
 */

import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI";

export type PriceLabel = 'UP' | 'DOWN' | 'NEUTRAL';

export interface PriceLabelData {
	symbol: string;
	date: string;
	currentPrice: number;
	futurePrice7d: number;
	priceChangePct: number;
	label: PriceLabel;
}

const PRICE_THRESHOLD = 2.0; // 2% threshold for UP/DOWN classification

/**
 * Generate price movement label for a given symbol and date
 */
export async function generatePriceLabel(
	symbol: string,
	asOfDate: Date
): Promise<PriceLabelData | null> {
	try {
		const fmpAPI = new FinancialModelingPrepAPI();

		// Get current price (at asOfDate)
		const endDate = new Date(asOfDate.getTime() + 10 * 24 * 60 * 60 * 1000); // 10 days after (to get 7 trading days)

		// Get 20 days of data (enough to cover 7 trading days forward + some buffer)
		const historicalData = await fmpAPI.getHistoricalData(symbol, 20, endDate);

		if (!historicalData || historicalData.length < 2) {
			console.warn(`Insufficient data for ${symbol} at ${asOfDate.toISOString()}`);
			return null;
		}

		// Sort data by timestamp (oldest first)
		const sortedData = historicalData.sort((a, b) => a.timestamp - b.timestamp);

		// Find the index of the date closest to (but not after) asOfDate
		const asOfDateTime = asOfDate.getTime();
		let currentDayIndex = -1;

		for (let i = 0; i < sortedData.length; i++) {
			if (sortedData[i].timestamp <= asOfDateTime) {
				currentDayIndex = i;
			} else {
				break; // Stop when we pass the target date
			}
		}

		if (currentDayIndex === -1) {
			console.warn(`No data found for ${symbol} on or before ${asOfDate.toISOString().split('T')[0]}`);
			return null;
		}

		const currentPrice = sortedData[currentDayIndex].close;
		const actualDate = new Date(sortedData[currentDayIndex].timestamp).toISOString().split('T')[0];

		// Find price 7 trading days later
		const futureDayIndex = currentDayIndex + 7;

		if (futureDayIndex >= sortedData.length) {
			console.warn(`Not enough future data for ${symbol} at ${actualDate}`);
			return null;
		}

		const futurePrice7d = sortedData[futureDayIndex].close;

		// Calculate price change percentage
		const priceChangePct = ((futurePrice7d - currentPrice) / currentPrice) * 100;

		// Generate label based on threshold
		let label: PriceLabel;
		if (priceChangePct > PRICE_THRESHOLD) {
			label = 'UP';
		} else if (priceChangePct < -PRICE_THRESHOLD) {
			label = 'DOWN';
		} else {
			label = 'NEUTRAL';
		}

		return {
			symbol,
			date: actualDate, // Use actual date from data, not requested date
			currentPrice,
			futurePrice7d,
			priceChangePct,
			label
		};
	} catch (error) {
		console.error(`Error generating label for ${symbol}:`, error);
		return null;
	}
}

/**
 * Generate labels for multiple dates (time series)
 */
export async function generateLabelsForSymbol(
	symbol: string,
	startDate: Date,
	endDate: Date,
	samplingFrequency: 'daily' | 'weekly' | 'monthly' = 'weekly'
): Promise<PriceLabelData[]> {
	const labels: PriceLabelData[] = [];
	const currentDate = new Date(startDate);

	// Determine sampling interval
	const intervalDays =
		samplingFrequency === 'daily' ? 1 :
		samplingFrequency === 'weekly' ? 7 :
		30; // monthly

	while (currentDate <= endDate) {
		const label = await generatePriceLabel(symbol, new Date(currentDate));

		if (label) {
			labels.push(label);
			console.log(
				`${symbol} ${label.date}: ${label.priceChangePct.toFixed(2)}% => ${label.label}`
			);
		}

		// Advance to next sample date
		currentDate.setDate(currentDate.getDate() + intervalDays);

		// Small delay to respect API rate limits
		await new Promise(resolve => setTimeout(resolve, 100));
	}

	return labels;
}

/**
 * Calculate label distribution statistics
 */
export function calculateLabelDistribution(labels: PriceLabelData[]): {
	total: number;
	upCount: number;
	downCount: number;
	neutralCount: number;
	upPercent: number;
	downPercent: number;
	neutralPercent: number;
} {
	const total = labels.length;
	const upCount = labels.filter(l => l.label === 'UP').length;
	const downCount = labels.filter(l => l.label === 'DOWN').length;
	const neutralCount = labels.filter(l => l.label === 'NEUTRAL').length;

	return {
		total,
		upCount,
		downCount,
		neutralCount,
		upPercent: (upCount / total) * 100,
		downPercent: (downCount / total) * 100,
		neutralPercent: (neutralCount / total) * 100
	};
}

/**
 * Main function for CLI usage
 */
async function main() {
	const args = process.argv.slice(2);

	if (args.includes('--test')) {
		console.log('🧪 Testing Price Label Generation\n');

		// Test with a few known examples
		const testCases = [
			{ symbol: 'AAPL', date: new Date('2024-01-15') },
			{ symbol: 'TSLA', date: new Date('2024-02-01') },
			{ symbol: 'NVDA', date: new Date('2024-03-01') }
		];

		for (const testCase of testCases) {
			const label = await generatePriceLabel(testCase.symbol, testCase.date);
			if (label) {
				console.log(`\n${label.symbol} on ${label.date}:`);
				console.log(`  Current Price: $${label.currentPrice.toFixed(2)}`);
				console.log(`  Future Price (7d): $${label.futurePrice7d.toFixed(2)}`);
				console.log(`  Price Change: ${label.priceChangePct.toFixed(2)}%`);
				console.log(`  Label: ${label.label}`);
			}
		}

		// Test time series
		console.log('\n📊 Testing Time Series Label Generation for AAPL (Jan-Feb 2024)\n');
		const timeSeries = await generateLabelsForSymbol(
			'AAPL',
			new Date('2024-01-01'),
			new Date('2024-02-28'),
			'weekly'
		);

		const distribution = calculateLabelDistribution(timeSeries);
		console.log('\n📈 Label Distribution:');
		console.log(`  Total: ${distribution.total}`);
		console.log(`  UP: ${distribution.upCount} (${distribution.upPercent.toFixed(1)}%)`);
		console.log(`  DOWN: ${distribution.downCount} (${distribution.downPercent.toFixed(1)}%)`);
		console.log(`  NEUTRAL: ${distribution.neutralCount} (${distribution.neutralPercent.toFixed(1)}%)`);

		return;
	}

	// Parse command line arguments
	const symbolArg = args.find(arg => arg.startsWith('--symbol='));
	const dateArg = args.find(arg => arg.startsWith('--date='));

	if (!symbolArg || !dateArg) {
		console.log('Usage:');
		console.log('  npx tsx scripts/ml/generate-price-labels.ts --symbol=AAPL --date=2024-01-15');
		console.log('  npx tsx scripts/ml/generate-price-labels.ts --test');
		process.exit(1);
	}

	const symbol = symbolArg.split('=')[1];
	const dateStr = dateArg.split('=')[1];
	const date = new Date(dateStr);

	console.log(`Generating price label for ${symbol} on ${dateStr}...\n`);

	const label = await generatePriceLabel(symbol, date);

	if (label) {
		console.log('Result:');
		console.log(`  Symbol: ${label.symbol}`);
		console.log(`  Date: ${label.date}`);
		console.log(`  Current Price: $${label.currentPrice.toFixed(2)}`);
		console.log(`  Future Price (7d): $${label.futurePrice7d.toFixed(2)}`);
		console.log(`  Price Change: ${label.priceChangePct.toFixed(2)}%`);
		console.log(`  Label: ${label.label}`);
	} else {
		console.log('❌ Failed to generate label');
	}
}

// Run if executed directly
if (require.main === module) {
	main().catch(console.error);
}
