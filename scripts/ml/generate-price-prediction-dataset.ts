/**
 * Price Prediction Dataset Generator
 *
 * Generates comprehensive training dataset for price movement prediction model.
 *
 * Features: 43 price-relevant features
 * Labels: UP/DOWN/NEUTRAL (3-class classification)
 * Stock Universe: Top 1000 liquid stocks
 * Time Range: 2020-2024 (5 years)
 * Sampling: Weekly (52 samples/year/stock)
 *
 * Total Examples: ~260,000 (1000 stocks × 5 years × 52 weeks)
 *
 * Usage:
 *   npx tsx scripts/ml/generate-price-prediction-dataset.ts --test
 *   npx tsx scripts/ml/generate-price-prediction-dataset.ts --top100
 *   npx tsx scripts/ml/generate-price-prediction-dataset.ts --top1000 --weekly
 */

import * as fs from 'fs';
import * as path from 'path';
import { PricePredictionFeatureExtractor, PriceFeatureVector } from '../../app/services/ml/features/PricePredictionFeatureExtractor';
import { generatePriceLabel, PriceLabelData, calculateLabelDistribution } from './generate-price-labels';

// Stock universes
const TEST_SYMBOLS = ['AAPL', 'GOOGL', 'MSFT'];

const SP500_TOP_100 = [
	'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'UNH', 'JNJ',
	'V', 'XOM', 'WMT', 'JPM', 'LLY', 'MA', 'PG', 'AVGO', 'HD', 'CVX',
	'MRK', 'ABBV', 'PEP', 'COST', 'KO', 'ADBE', 'MCD', 'CSCO', 'CRM', 'TMO',
	'ACN', 'ABT', 'NFLX', 'DHR', 'WFC', 'VZ', 'TXN', 'PM', 'NEE', 'ORCL',
	'DIS', 'NKE', 'CMCSA', 'BMY', 'RTX', 'UNP', 'PFE', 'INTC', 'QCOM', 'COP',
	'LIN', 'AMD', 'HON', 'UPS', 'LOW', 'T', 'CAT', 'ELV', 'BA', 'INTU',
	'SBUX', 'DE', 'AXP', 'GS', 'AMGN', 'MS', 'SPGI', 'BLK', 'GILD', 'BKNG',
	'MDLZ', 'ADI', 'PLD', 'TJX', 'SYK', 'CVS', 'MMC', 'C', 'VRTX', 'ADP',
	'ISRG', 'ZTS', 'REGN', 'NOW', 'TMUS', 'MO', 'SCHW', 'CB', 'SO', 'DUK',
	'PGR', 'CI', 'BDX', 'CL', 'NOC', 'LRCX', 'BSX', 'EOG', 'ITW', 'GE'
];

interface DatasetConfig {
	symbols: string[];
	startDate: Date;
	endDate: Date;
	samplingFrequency: 'weekly' | 'monthly';
	outputFile: string;
	checkpointFrequency: number; // Save every N symbols
}

interface DatasetRow extends PriceFeatureVector {
	label: string;
}

class PriceDatasetGenerator {
	private featureExtractor: PricePredictionFeatureExtractor;
	private totalRows: number = 0;
	private successfulSymbols: number = 0;
	private failedSymbols: string[] = [];

	constructor() {
		this.featureExtractor = new PricePredictionFeatureExtractor();
	}

	/**
	 * Generate dataset for given configuration
	 */
	async generateDataset(config: DatasetConfig): Promise<void> {
		console.log('🚀 Price Prediction Dataset Generation');
		console.log('='.repeat(80));
		console.log(`  Symbols: ${config.symbols.length}`);
		console.log(`  Date Range: ${config.startDate.toISOString().split('T')[0]} to ${config.endDate.toISOString().split('T')[0]}`);
		console.log(`  Sampling: ${config.samplingFrequency}`);
		console.log(`  Output: ${config.outputFile}`);
		console.log('='.repeat(80));

		// Ensure output directory exists
		const outputDir = path.dirname(config.outputFile);
		if (!fs.existsSync(outputDir)) {
			fs.mkdirSync(outputDir, { recursive: true });
		}

		// Initialize CSV file with headers
		const headers = this.generateCSVHeaders();
		fs.writeFileSync(config.outputFile, headers + '\n');

		// Process symbols in batches
		for (let i = 0; i < config.symbols.length; i++) {
			const symbol = config.symbols[i];
			console.log(`\n[${i + 1}/${config.symbols.length}] Processing ${symbol}...`);

			try {
				const rows = await this.generateSymbolData(
					symbol,
					config.startDate,
					config.endDate,
					config.samplingFrequency
				);

				if (rows.length > 0) {
					this.appendRowsToCSV(config.outputFile, rows);
					this.totalRows += rows.length;
					this.successfulSymbols++;
					console.log(`  ✓ Generated ${rows.length} examples for ${symbol}`);
				} else {
					this.failedSymbols.push(symbol);
					console.log(`  ⚠️ No data generated for ${symbol}`);
				}
			} catch (error) {
				this.failedSymbols.push(symbol);
				console.error(`  ❌ Error processing ${symbol}:`, error instanceof Error ? error.message : error);
			}

			// Checkpoint: save progress every N symbols
			if ((i + 1) % config.checkpointFrequency === 0) {
				await this.saveCheckpoint(config.outputFile, i + 1);
			}

			// Rate limiting: small delay between symbols
			await this.sleep(200);
		}

		// Final summary
		this.printSummary(config.outputFile);
	}

	/**
	 * Generate data rows for a single symbol
	 */
	private async generateSymbolData(
		symbol: string,
		startDate: Date,
		endDate: Date,
		samplingFrequency: 'weekly' | 'monthly'
	): Promise<DatasetRow[]> {
		const rows: DatasetRow[] = [];
		const currentDate = new Date(startDate);

		const intervalDays = samplingFrequency === 'weekly' ? 7 : 30;

		while (currentDate <= endDate) {
			try {
				// Generate label first (check if we have future data)
				const labelData = await generatePriceLabel(symbol, new Date(currentDate));

				if (!labelData) {
					// Skip this date if we don't have future price data
					currentDate.setDate(currentDate.getDate() + intervalDays);
					continue;
				}

				// Extract features
				const features = await this.featureExtractor.extractFeatures(
					symbol,
					new Date(currentDate)
				);

				// Combine features and label
				const row: DatasetRow = {
					...features,
					label: labelData.label
				};

				rows.push(row);
			} catch (error) {
				console.warn(`    Skipping ${symbol} on ${currentDate.toISOString().split('T')[0]}: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}

			// Advance to next sample date
			currentDate.setDate(currentDate.getDate() + intervalDays);
		}

		return rows;
	}

	/**
	 * Generate CSV headers
	 */
	private generateCSVHeaders(): string {
		const headers = [
			'symbol',
			'date',
			// Volume features (6)
			'volume_ratio_5d', 'volume_spike', 'volume_trend_10d', 'relative_volume',
			'volume_acceleration', 'dark_pool_ratio',
			// Technical indicators (10)
			'rsi_14', 'macd_signal', 'macd_histogram', 'bollinger_position',
			'stochastic_k', 'adx_14', 'atr_14', 'ema_20_distance', 'sma_50_distance', 'williams_r',
			// Price action (8)
			'price_momentum_5d', 'price_momentum_10d', 'price_momentum_20d', 'price_acceleration',
			'gap_percent', 'intraday_volatility', 'overnight_return', 'week_high_distance',
			// Options flow (7)
			'put_call_ratio', 'put_call_ratio_change', 'unusual_options_activity', 'options_iv_rank',
			'gamma_exposure', 'max_pain_distance', 'options_volume_ratio',
			// Institutional flow (4)
			'institutional_net_flow', 'block_trade_volume', 'insider_buying_ratio', 'ownership_change_30d',
			// Sentiment (4)
			'news_sentiment_delta', 'social_momentum', 'analyst_target_distance', 'earnings_surprise_impact',
			// Macro context (4)
			'sector_momentum_5d', 'spy_momentum_5d', 'vix_level', 'correlation_to_spy_20d',
			// Label
			'label'
		];

		return headers.join(',');
	}

	/**
	 * Append rows to CSV file
	 */
	private appendRowsToCSV(filename: string, rows: DatasetRow[]): void {
		const csvLines = rows.map(row => {
			const date = new Date(row.timestamp).toISOString().split('T')[0];
			const values = [
				row.symbol,
				date,
				// Volume features
				row.volume_ratio_5d, row.volume_spike, row.volume_trend_10d, row.relative_volume,
				row.volume_acceleration, row.dark_pool_ratio,
				// Technical indicators
				row.rsi_14, row.macd_signal, row.macd_histogram, row.bollinger_position,
				row.stochastic_k, row.adx_14, row.atr_14, row.ema_20_distance, row.sma_50_distance, row.williams_r,
				// Price action
				row.price_momentum_5d, row.price_momentum_10d, row.price_momentum_20d, row.price_acceleration,
				row.gap_percent, row.intraday_volatility, row.overnight_return, row.week_high_distance,
				// Options flow
				row.put_call_ratio, row.put_call_ratio_change, row.unusual_options_activity, row.options_iv_rank,
				row.gamma_exposure, row.max_pain_distance, row.options_volume_ratio,
				// Institutional flow
				row.institutional_net_flow, row.block_trade_volume, row.insider_buying_ratio, row.ownership_change_30d,
				// Sentiment
				row.news_sentiment_delta, row.social_momentum, row.analyst_target_distance, row.earnings_surprise_impact,
				// Macro context
				row.sector_momentum_5d, row.spy_momentum_5d, row.vix_level, row.correlation_to_spy_20d,
				// Label
				row.label
			];

			return values.join(',');
		});

		fs.appendFileSync(filename, csvLines.join('\n') + '\n');
	}

	/**
	 * Save checkpoint
	 */
	private async saveCheckpoint(originalFile: string, symbolCount: number): Promise<void> {
		const checkpointFile = originalFile.replace('.csv', `_checkpoint_${symbolCount}.csv`);
		fs.copyFileSync(originalFile, checkpointFile);
		console.log(`\n💾 Checkpoint saved: ${checkpointFile} (${this.totalRows} rows, ${symbolCount} symbols)`);
	}

	/**
	 * Print final summary
	 */
	private printSummary(outputFile: string): void {
		console.log('\n' + '='.repeat(80));
		console.log('✅ Dataset Generation Complete');
		console.log('='.repeat(80));
		console.log(`  Total Rows: ${this.totalRows.toLocaleString()}`);
		console.log(`  Successful Symbols: ${this.successfulSymbols}`);
		console.log(`  Failed Symbols: ${this.failedSymbols.length}`);
		if (this.failedSymbols.length > 0) {
			console.log(`    ${this.failedSymbols.slice(0, 10).join(', ')}${this.failedSymbols.length > 10 ? '...' : ''}`);
		}
		console.log(`  Output File: ${outputFile}`);
		console.log(`  File Size: ${this.getFileSize(outputFile)}`);
		console.log('='.repeat(80));
	}

	/**
	 * Get file size in human-readable format
	 */
	private getFileSize(filename: string): string {
		if (!fs.existsSync(filename)) return '0 B';
		const stats = fs.statSync(filename);
		const bytes = stats.size;

		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
	}

	/**
	 * Sleep helper
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

/**
 * Main function
 */
async function main() {
	const args = process.argv.slice(2);

	let config: DatasetConfig;

	if (args.includes('--test')) {
		// Test mode: 3 symbols, 1 year, weekly
		config = {
			symbols: TEST_SYMBOLS,
			startDate: new Date('2023-01-01'),
			endDate: new Date('2023-12-31'),
			samplingFrequency: 'weekly',
			outputFile: 'data/training/price-prediction-test.csv',
			checkpointFrequency: 1
		};
	} else if (args.includes('--top100')) {
		// Top 100: 100 stocks, 3 years, weekly
		config = {
			symbols: SP500_TOP_100,
			startDate: new Date('2022-01-01'),
			endDate: new Date('2024-12-31'),
			samplingFrequency: 'weekly',
			outputFile: 'data/training/price-prediction-top100.csv',
			checkpointFrequency: 10
		};
	} else if (args.includes('--top1000')) {
		// Full dataset: 1000 stocks, 5 years
		const sampling = args.includes('--monthly') ? 'monthly' : 'weekly';
		config = {
			symbols: SP500_TOP_100, // TODO: Expand to full 1000 stocks
			startDate: new Date('2020-01-01'),
			endDate: new Date('2024-12-31'),
			samplingFrequency: sampling,
			outputFile: `data/training/price-prediction-full-${sampling}.csv`,
			checkpointFrequency: 50
		};
	} else {
		console.log('Usage:');
		console.log('  npx tsx scripts/ml/generate-price-prediction-dataset.ts --test');
		console.log('  npx tsx scripts/ml/generate-price-prediction-dataset.ts --top100');
		console.log('  npx tsx scripts/ml/generate-price-prediction-dataset.ts --top1000 [--monthly]');
		process.exit(1);
	}

	const generator = new PriceDatasetGenerator();
	await generator.generateDataset(config);
}

// Run if executed directly
if (require.main === module) {
	main().catch(console.error);
}
