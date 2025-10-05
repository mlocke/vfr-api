/**
 * Test script to diagnose earnings data issue after ~100 symbols
 */

import "dotenv/config";
import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI.js";

const fmpAPI = new FinancialModelingPrepAPI();

async function testEarningsSequence() {
	const testSymbols = [
		"AAPL",  // Should work
		"MSFT",  // Should work
		"GOOGL", // Should work
		// Skip to around symbol 100-150
		"AIZ",   // Symbol #137
		"A",     // Symbol #138
		"APH",   // Symbol #139
		"ABNB",  // Symbol #140
	];

	console.log("Testing earnings data retrieval...\n");

	for (let i = 0; i < testSymbols.length; i++) {
		const symbol = testSymbols[i];
		console.log(`[${i + 1}/${testSymbols.length}] Testing ${symbol}...`);

		const start = Date.now();
		const earnings = await fmpAPI.getEarningsSurprises(symbol, 60);
		const elapsed = Date.now() - start;

		console.log(`  ✓ Response time: ${elapsed}ms`);
		console.log(`  ✓ Earnings records: ${earnings.length}`);

		if (earnings.length > 0) {
			const filtered = earnings.filter((e: any) =>
				e.actualEarningResult !== 0 && e.estimatedEarning !== 0
			);
			console.log(`  ✓ Valid earnings (actual != 0): ${filtered.length}`);
			console.log(`  ✓ Sample: ${JSON.stringify(earnings[0])}`);
		} else {
			console.log(`  ⚠️  NO EARNINGS DATA RETURNED`);
		}

		// Add delay to respect rate limits
		await new Promise(resolve => setTimeout(resolve, 250));
		console.log();
	}
}

testEarningsSequence().catch(console.error);
