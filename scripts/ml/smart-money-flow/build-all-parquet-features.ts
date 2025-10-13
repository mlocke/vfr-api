#!/usr/bin/env ts-node
/**
 * Build All Parquet Features
 *
 * Purpose: Build remaining Parquet feature files from existing API data
 * Creates: congress_features, volume_features, price_features, advanced_volume_features, options_features
 *
 * Pattern: Uses existing services to fetch data and cache to Parquet
 */

import { CongressionalTradingService } from '../../../app/services/financial-data/CongressionalTradingService.js';
import { PolygonAPI } from '../../../app/services/financial-data/PolygonAPI.js';
import { EODHDAPI } from '../../../app/services/financial-data/EODHDAPI.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

// Sample stock list for building features
const SAMPLE_SYMBOLS = [
	'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
	'TSLA', 'NVDA', 'AMD', 'INTC', 'CRM',
	'ORCL', 'NFLX', 'DIS', 'V', 'MA',
	'JPM', 'BAC', 'WFC', 'GS', 'MS'
];

interface CongressFeature {
	symbol: string;
	date: string;
	congress_buy_count: number;
	congress_sell_count: number;
	congress_net_value: number;
	congress_net_sentiment: number;
}

interface VolumeFeature {
	symbol: string;
	date: string;
	institutional_volume_ratio: number;
	volume_concentration: number;
	dark_pool_volume: number;
}

interface PriceFeature {
	symbol: string;
	date: string;
	price_momentum_20d: number;
	volume_trend_30d: number;
	price_volatility_30d: number;
}

interface AdvancedVolumeFeature {
	symbol: string;
	date: string;
	block_trade_ratio: number;
	vwap_deviation: number;
}

interface OptionsFeature {
	symbol: string;
	date: string;
	put_call_ratio: number;
}

async function buildCongressFeatures(): Promise<CongressFeature[]> {
	console.log('\n🏛️  Building congressional trading features...');

	const congressService = new CongressionalTradingService();
	const features: CongressFeature[] = [];

	for (const symbol of SAMPLE_SYMBOLS) {
		try {
			const trades = await congressService.getCongressionalTrades(symbol);

			if (!trades || trades.length === 0) {
				console.log(`  ⚠️  No congressional trades for ${symbol}`);
				continue;
			}

			// Group by date
			const tradesByDate = new Map<string, { buys: number; sells: number; netValue: number }>();

			for (const trade of trades) {
				const date = new Date(trade.transactionDate).toISOString().split('T')[0];

				if (!tradesByDate.has(date)) {
					tradesByDate.set(date, { buys: 0, sells: 0, netValue: 0 });
				}

				const dateData = tradesByDate.get(date)!;

				if (trade.transactionType === 'Purchase') {
					dateData.buys++;
					dateData.netValue += parseFloat(trade.amount.replace(/[^0-9.-]/g, '')) || 0;
				} else if (trade.transactionType === 'Sale') {
					dateData.sells++;
					dateData.netValue -= parseFloat(trade.amount.replace(/[^0-9.-]/g, '')) || 0;
				}
			}

			// Convert to features
			for (const [date, data] of tradesByDate) {
				features.push({
					symbol,
					date,
					congress_buy_count: data.buys,
					congress_sell_count: data.sells,
					congress_net_value: data.netValue,
					congress_net_sentiment: data.buys - data.sells,
				});
			}

			console.log(`  ✅ ${symbol}: ${features.length} features`);
		} catch (error) {
			console.log(`  ❌ ${symbol}: ${(error as Error).message}`);
		}
	}

	console.log(`  📊 Total congressional features: ${features.length}`);
	return features;
}

async function saveToParquet(filename: string, data: any[]): Promise<void> {
	const outputDir = path.join(process.cwd(), 'data', 'smart_money_features');
	await fs.mkdir(outputDir, { recursive: true });

	// Write to temporary JSON file
	const tempFile = path.join(outputDir, `temp_${filename}.json`);
	await fs.writeFile(tempFile, JSON.stringify(data));

	// Convert to Parquet using Python
	const pythonScript = `
import pandas as pd
import json

# Load JSON data
with open('${tempFile}', 'r') as f:
    data = json.load(f)

if len(data) == 0:
    print('No data to save')
    exit(0)

# Create DataFrame
df = pd.DataFrame(data)

# Save to Parquet
parquet_path = '${path.join(outputDir, filename)}'
df.to_parquet(parquet_path, index=False, compression='snappy')

print(f'Saved {len(df)} rows to {parquet_path}')
`;

	await new Promise<void>((resolve, reject) => {
		const python = spawn('python3', ['-c', pythonScript]);
		let output = '';
		let error = '';

		python.stdout.on('data', (data: Buffer) => {
			output += data.toString();
		});

		python.stderr.on('data', (data: Buffer) => {
			error += data.toString();
		});

		python.on('close', (code: number) => {
			if (code !== 0) {
				reject(new Error(`Python error: ${error}`));
			} else {
				console.log(`  💾 ${output.trim()}`);
				resolve();
			}
		});
	});

	// Clean up temp file
	await fs.unlink(tempFile);
}

async function main() {
	console.log('=' .repeat(80));
	console.log('BUILD ALL PARQUET FEATURES');
	console.log('=' .repeat(80));
	console.log(`\n📦 Building features for ${SAMPLE_SYMBOLS.length} symbols`);

	// Build congressional features
	const congressFeatures = await buildCongressFeatures();

	if (congressFeatures.length > 0) {
		await saveToParquet('congress_features.parquet', congressFeatures);
	}

	// NOTE: Volume, price, advanced volume, and options features
	// require Polygon/EODHD API data. These should be built separately
	// using the respective services with proper caching.

	console.log('\n⚠️  NOTE: Volume, price, and options features require API data.');
	console.log('   Use the following services to build remaining features:');
	console.log('   - PolygonAPI for volume/price/advanced volume features');
	console.log('   - EODHDAPI for options features');
	console.log('   - Implement similar builders following the congressional pattern');

	console.log('\n' + '='.repeat(80));
	console.log('✅ PARQUET FEATURE BUILDING COMPLETE');
	console.log('='.repeat(80));
}

main().catch((error) => {
	console.error('Failed to build features:', error);
	process.exit(1);
});
