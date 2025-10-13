#!/usr/bin/env ts-node
/**
 * Build CUSIP → Ticker Mapping
 *
 * Purpose: Create mapping table from CUSIP to ticker symbol
 * Source: SEC company tickers JSON (free, no API key required)
 * Output: data/smart_money_features/cusip_ticker_mapping.parquet
 *
 * Usage:
 * 1. Downloads SEC company tickers JSON
 * 2. Maps CIK → ticker
 * 3. Downloads CUSIP mapping (requires manual step or OpenFIGI API)
 * 4. Creates CUSIP → ticker Parquet file
 */

import * as https from 'https';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn } from 'child_process';

interface SECCompany {
	cik_str: number;
	ticker: string;
	title: string;
}

interface CUSIPMapping {
	cusip: string;
	ticker: string;
	cik: string;
	company_name: string;
}

async function downloadSECCompanyTickers(): Promise<Map<string, string>> {
	console.log('\n📥 Downloading SEC company tickers...');

	return new Promise((resolve, reject) => {
		const url = 'https://www.sec.gov/files/company_tickers.json';

		https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					const json = JSON.parse(data);
					const cikToTicker = new Map<string, string>();

					// Parse JSON format: { "0": { cik_str: 320193, ticker: "AAPL", ... }, ... }
					for (const key in json) {
						const company: SECCompany = json[key];
						const cik = String(company.cik_str).padStart(10, '0'); // Pad CIK to 10 digits
						cikToTicker.set(cik, company.ticker);
					}

					console.log(`  ✅ Downloaded ${cikToTicker.size} companies`);
					resolve(cikToTicker);
				} catch (error) {
					reject(new Error(`Failed to parse SEC data: ${error}`));
				}
			});
		}).on('error', (error) => {
			reject(new Error(`Failed to download SEC data: ${error}`));
		});
	});
}

async function buildCUSIPMapping(cikToTicker: Map<string, string>): Promise<CUSIPMapping[]> {
	console.log('\n🔗 Building CUSIP → Ticker mapping...');

	// For now, create a simple mapping based on CIK
	// TODO: Enhance with actual CUSIP data from OpenFIGI or other sources

	const mappings: CUSIPMapping[] = [];

	for (const [cik, ticker] of cikToTicker) {
		// Note: This is a placeholder. Real CUSIP mapping requires additional data source
		mappings.push({
			cusip: `CUSIP_${cik}`, // Placeholder CUSIP
			ticker,
			cik,
			company_name: ticker, // Placeholder name
		});
	}

	console.log(`  📊 Created ${mappings.length} mappings`);
	console.log(`  ⚠️  WARNING: This is a placeholder mapping`);
	console.log(`  ℹ️  For production, use OpenFIGI API or other CUSIP source`);

	return mappings;
}

async function saveToParquet(mappings: CUSIPMapping[]): Promise<void> {
	console.log('\n💾 Saving to Parquet...');

	const outputDir = path.join(process.cwd(), 'data', 'smart_money_features');
	await fs.mkdir(outputDir, { recursive: true });

	// Write to temporary JSON
	const tempFile = path.join(outputDir, 'temp_cusip_mapping.json');
	await fs.writeFile(tempFile, JSON.stringify(mappings));

	// Convert to Parquet
	const pythonScript = `
import pandas as pd
import json

# Load JSON
with open('${tempFile}', 'r') as f:
    data = json.load(f)

# Create DataFrame
df = pd.DataFrame(data)

# Save to Parquet
parquet_path = '${path.join(outputDir, 'cusip_ticker_mapping.parquet')}'
df.to_parquet(parquet_path, index=False, compression='snappy')

print(f'✅ Saved {len(df)} CUSIP mappings to Parquet')
`;

	await new Promise<void>((resolve, reject) => {
		const python = spawn('python3', ['-c', pythonScript]);
		let output = '';

		python.stdout.on('data', (data: Buffer) => {
			output += data.toString();
		});

		python.on('close', (code: number) => {
			if (code !== 0) {
				reject(new Error('Python script failed'));
			} else {
				console.log(`  ${output.trim()}`);
				resolve();
			}
		});
	});

	// Clean up
	await fs.unlink(tempFile);
}

async function main() {
	console.log('='.repeat(80));
	console.log('BUILD CUSIP → TICKER MAPPING');
	console.log('='.repeat(80));

	try {
		// Download SEC company tickers
		const cikToTicker = await downloadSECCompanyTickers();

		// Build CUSIP mapping
		const mappings = await buildCUSIPMapping(cikToTicker);

		// Save to Parquet
		await saveToParquet(mappings);

		console.log('\n' + '='.repeat(80));
		console.log('✅ CUSIP MAPPING COMPLETE');
		console.log('='.repeat(80));
		console.log('\n📝 NEXT STEPS:');
		console.log('   1. Enhance mapping with real CUSIP data from OpenFIGI:');
		console.log('      https://www.openfigi.com/api');
		console.log('   2. Update institutional_features.parquet with ticker symbols');
		console.log('   3. Create join logic in ParquetSmartMoneyFeatureExtractor');
	} catch (error) {
		console.error('\n❌ Failed to build CUSIP mapping:', error);
		process.exit(1);
	}
}

main();
