/**
 * Smart Money Flow Dataset Generation - LEAN VERSION
 * Uses LeanSmartMoneyFeatureExtractor with ZERO PLACEHOLDERS
 *
 * Features: 20 real features from verified working data sources
 * Data Sources: Polygon (price/volume), Congressional Trading, SEC EDGAR (Form 4/13F), EODHD (options)
 * NO FALLBACKS - Gracefully handles sparse data with zeros
 */

import { LeanSmartMoneyFeatureExtractor } from '../../../app/services/ml/smart-money-flow/LeanSmartMoneyFeatureExtractor';
import { PolygonAPI } from '../../../app/services/financial-data/PolygonAPI';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_DIR = path.join(process.cwd(), 'data/training/smart-money-flow-lean');
const CHECKPOINT_INTERVAL = 50;

interface DatasetSample {
	symbol: string;
	date: string;
	price_at_sample: number;
	price_after_14d: number;
	return_14d: number;
	label: number;
	// Original 10 features
	congress_buy_count_90d: number;
	congress_sell_count_90d: number;
	congress_net_sentiment: number;
	congress_recent_activity_7d: number;
	institutional_volume_ratio: number;
	volume_concentration: number;
	dark_pool_volume_30d: number;
	price_momentum_20d: number;
	volume_trend_30d: number;
	price_volatility_30d: number;
	// New 10 features (SEC EDGAR, Polygon, EODHD)
	insider_buy_volume_30d: number;
	insider_sell_volume_30d: number;
	insider_buy_ratio_30d: number;
	insider_transaction_count_30d: number;
	inst_ownership_pct: number;
	inst_holders_count: number;
	inst_ownership_change_qtd: number;
	block_trade_ratio_30d: number;
	vwap_deviation_avg_30d: number;
	options_put_call_ratio_7d: number;
}

class LeanDatasetGenerator {
	private extractor: LeanSmartMoneyFeatureExtractor;
	private polygonAPI: PolygonAPI;
	private samples: DatasetSample[] = [];
	private failedSymbols: string[] = [];
	private successCount = 0;
	private failCount = 0;

	constructor() {
		this.extractor = new LeanSmartMoneyFeatureExtractor();
		this.polygonAPI = new PolygonAPI();
	}

	async generateDataset(symbols: string[], startDate: Date, endDate: Date, outputName: string) {
		console.log('\n═══════════════════════════════════════════════════════════');
		console.log('LEAN SMART MONEY FLOW DATASET GENERATION (20 FEATURES)');
		console.log('═══════════════════════════════════════════════════════════');
		console.log(`Symbols: ${symbols.length}`);
		console.log(`Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
		console.log(`Features: 20 (Congressional, Volume, Price, SEC Insider, SEC 13F, Polygon, EODHD)`);
		console.log(`Output: ${outputName}.csv`);
		console.log('═══════════════════════════════════════════════════════════\n');

		// Ensure output directory exists
		if (!fs.existsSync(OUTPUT_DIR)) {
			fs.mkdirSync(OUTPUT_DIR, { recursive: true });
		}

		const startTime = Date.now();

		for (let i = 0; i < symbols.length; i++) {
			const symbol = symbols[i];
			const progress = ((i + 1) / symbols.length * 100).toFixed(1);

			console.log(`\n[${i + 1}/${symbols.length}] Processing ${symbol} (${progress}%)...`);

			try {
				const symbolSamples = await this.generateSamplesForSymbol(symbol, startDate, endDate);

				if (symbolSamples.length === 0) {
					console.log(`⚠️  ${symbol}: No valid samples generated`);
					this.failedSymbols.push(symbol);
					this.failCount++;
				} else {
					this.samples.push(...symbolSamples);
					this.successCount++;
					console.log(`✅ ${symbol}: Generated ${symbolSamples.length} samples`);
				}
			} catch (error) {
				const err = error as Error;
				console.error(`❌ ${symbol}: FAILED - ${err.message}`);
				this.failedSymbols.push(symbol);
				this.failCount++;
			}

			// Checkpoint every N symbols
			if ((i + 1) % CHECKPOINT_INTERVAL === 0) {
				this.saveCheckpoint(outputName, i + 1);
			}

			// Progress summary
			if ((i + 1) % 10 === 0) {
				const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
				console.log(`\n📊 Progress: ${i + 1}/${symbols.length} | Success: ${this.successCount} | Failed: ${this.failCount} | Samples: ${this.samples.length} | Time: ${elapsed}m`);
			}
		}

		// Final save
		this.saveFinal(outputName);

		// Summary
		const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
		console.log('\n═══════════════════════════════════════════════════════════');
		console.log('GENERATION COMPLETE');
		console.log('═══════════════════════════════════════════════════════════');
		console.log(`✅ Success: ${this.successCount} symbols`);
		console.log(`❌ Failed: ${this.failCount} symbols`);
		console.log(`📊 Total samples: ${this.samples.length}`);
		console.log(`⏱️  Time: ${totalTime} minutes`);
		console.log(`📁 Output: ${OUTPUT_DIR}/${outputName}.csv`);
		console.log('═══════════════════════════════════════════════════════════\n');

		if (this.failedSymbols.length > 0) {
			console.log(`Failed symbols (${this.failedSymbols.length}):`);
			console.log(this.failedSymbols.slice(0, 20).join(', '));
			if (this.failedSymbols.length > 20) {
				console.log(`... and ${this.failedSymbols.length - 20} more`);
			}
		}

		return this.samples.length;
	}

	private async generateSamplesForSymbol(
		symbol: string,
		startDate: Date,
		endDate: Date
	): Promise<DatasetSample[]> {
		const samples: DatasetSample[] = [];

		// Sample every 14 days (2 weeks) to avoid overlap in 14-day forward returns
		const currentDate = new Date(startDate);
		const sampleInterval = 14; // days

		while (currentDate <= endDate) {
			const sampleDateStr = currentDate.toISOString().split('T')[0];

			try {
				// Extract features at this point in time
				const features = await this.extractor.extractFeatures(symbol, currentDate);

				// Get future price (14 days ahead)
				const futureDate = new Date(currentDate.getTime() + 14 * 24 * 60 * 60 * 1000);
				const priceData = await this.getPriceData(symbol, currentDate, futureDate);

				if (!priceData) {
					console.log(`  ⚠️  ${symbol} ${sampleDateStr}: No price data`);
					currentDate.setDate(currentDate.getDate() + sampleInterval);
					continue;
				}

				const { priceAtSample, priceAfter14d } = priceData;
				const return14d = (priceAfter14d - priceAtSample) / priceAtSample;
				const label = return14d > 0.05 ? 1 : 0; // 1 if >5% gain

				// Validate ALL features are real numbers
				const featureValues = Object.values(features);
				const hasInvalidFeatures = featureValues.some(v =>
					typeof v !== 'number' || !isFinite(v) || isNaN(v)
				);

				if (hasInvalidFeatures) {
					throw new Error(`Invalid features detected for ${symbol} on ${sampleDateStr}`);
				}

				samples.push({
					symbol,
					date: sampleDateStr,
					price_at_sample: priceAtSample,
					price_after_14d: priceAfter14d,
					return_14d: return14d,
					label,
					...features,
				});

				console.log(`  ✅ ${symbol} ${sampleDateStr}: return=${(return14d * 100).toFixed(2)}%, label=${label}`);
			} catch (error) {
				const err = error as Error;
				console.log(`  ⚠️  ${symbol} ${sampleDateStr}: ${err.message}`);
			}

			// Move to next sample date
			currentDate.setDate(currentDate.getDate() + sampleInterval);
		}

		return samples;
	}

	private async getPriceData(
		symbol: string,
		sampleDate: Date,
		futureDate: Date
	): Promise<{ priceAtSample: number; priceAfter14d: number } | null> {
		try {
			// Get bars from sample date to future date + buffer
			const bufferDate = new Date(futureDate.getTime() + 7 * 24 * 60 * 60 * 1000);
			const bars = await this.polygonAPI.getAggregates(symbol, 1, 'day', sampleDate, bufferDate);

			if (!bars || bars.length < 2) {
				return null;
			}

			// Find closest bar to sample date
			const sampleBar = bars.find(b => {
				const barDate = new Date(b.timestamp);
				return barDate >= sampleDate;
			});

			// Find closest bar to future date (14 days later)
			const futureBar = bars.find(b => {
				const barDate = new Date(b.timestamp);
				return barDate >= futureDate;
			});

			if (!sampleBar || !futureBar) {
				return null;
			}

			return {
				priceAtSample: sampleBar.close,
				priceAfter14d: futureBar.close,
			};
		} catch (error) {
			return null;
		}
	}

	private saveCheckpoint(outputName: string, processedCount: number) {
		const checkpointPath = path.join(OUTPUT_DIR, `checkpoint_${outputName}_${processedCount}.csv`);
		this.saveCSV(checkpointPath);
		console.log(`\n💾 Checkpoint saved: ${this.samples.length} samples (${processedCount} symbols processed)`);
	}

	private saveFinal(outputName: string) {
		const finalPath = path.join(OUTPUT_DIR, `${outputName}.csv`);
		this.saveCSV(finalPath);
		console.log(`\n💾 Final dataset saved: ${finalPath}`);
	}

	private saveCSV(filePath: string) {
		if (this.samples.length === 0) {
			console.log('⚠️  No samples to save');
			return;
		}

		// CSV header
		const header = Object.keys(this.samples[0]).join(',');
		const rows = this.samples.map(sample => Object.values(sample).join(','));
		const csv = [header, ...rows].join('\n');

		fs.writeFileSync(filePath, csv, 'utf-8');
	}
}

// Parse command line arguments
const args = process.argv.slice(2);
const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
const nameArg = args.find(arg => arg.startsWith('--name='));
const testArg = args.includes('--test');
const top100Arg = args.includes('--top100');

let symbols: string[];
let outputName: string;

if (testArg) {
	// Test with 3 symbols
	symbols = ['AAPL', 'MSFT', 'GOOGL'];
	outputName = nameArg ? nameArg.replace('--name=', '') : 'lean-test';
} else if (symbolsArg) {
	// Custom symbol list
	symbols = symbolsArg.replace('--symbols=', '').split(',');
	outputName = nameArg ? nameArg.replace('--name=', '') : 'lean-custom';
} else if (top100Arg) {
	// Top 100 stocks (imported from stock-lists.ts)
	const { getTopNStocks } = require('./stock-lists');
	symbols = getTopNStocks(100);
	outputName = nameArg ? nameArg.replace('--name=', '') : 'lean-top100';
} else {
	// Top 500 stocks (imported from stock-lists.ts)
	const { getTop500Stocks } = require('./stock-lists');
	symbols = getTop500Stocks();
	outputName = nameArg ? nameArg.replace('--name=', '') : 'lean-sp500';
}

// Date range: 2 years of historical data
const endDate = new Date();
endDate.setMonth(endDate.getMonth() - 1); // End 1 month ago (need 14 days forward)
const startDate = new Date(endDate);
startDate.setFullYear(startDate.getFullYear() - 2); // Start 2 years ago

// Run generation
const generator = new LeanDatasetGenerator();
generator.generateDataset(symbols, startDate, endDate, outputName)
	.then(sampleCount => {
		console.log(`\n✅ Dataset generation completed: ${sampleCount} samples`);
		process.exit(0);
	})
	.catch(error => {
		console.error(`\n❌ Dataset generation failed:`, error);
		process.exit(1);
	});
