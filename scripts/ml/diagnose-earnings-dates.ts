/**
 * Diagnose earnings date distribution to understand the "No earnings data" issue
 */

import "dotenv/config";
import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI.js";

const fmpAPI = new FinancialModelingPrepAPI();

// Sample symbols from different positions
const TEST_SYMBOLS = [
	{ symbol: "AAPL", position: 1 },
	{ symbol: "MSFT", position: 2 },
	{ symbol: "GOOGL", position: 3 },
	{ symbol: "NVDA", position: 5 },
	{ symbol: "MMM", position: 130 },
	{ symbol: "AIG", position: 133 },
	{ symbol: "A", position: 138 },
	{ symbol: "AAPL", position: 171 }, // AAPL appears again at 171
];

async function diagnoseDates() {
	console.log("Diagnosing earnings date distribution...\n");
	console.log("Date range: 2023-01-01 to 2025-12-31");
	console.log("Current date:", new Date().toISOString().split("T")[0]);
	console.log("=".repeat(80));

	const start = new Date("2023-01-01");
	const end = new Date("2025-12-31");

	for (const { symbol, position } of TEST_SYMBOLS) {
		console.log(`\n[Position ${position}] ${symbol}:`);

		const earnings = await fmpAPI.getEarningsSurprises(symbol, 60);
		console.log(`  Total earnings from API: ${earnings.length}`);

		// Filter by date range
		const inRange = earnings.filter((e: any) => {
			const date = new Date(e.date);
			return date >= start && date <= end;
		});
		console.log(`  In date range (2023-2025): ${inRange.length}`);

		// Filter by actual != 0 (historical earnings only)
		const withActuals = inRange.filter(
			(e: any) => e.actualEarningResult !== 0 && e.estimatedEarning !== 0
		);
		console.log(`  With actual results (actual != 0): ${withActuals.length}`);

		if (withActuals.length > 0) {
			const dates = withActuals.map((e: any) => e.date).sort();
			console.log(`  Date range of valid earnings: ${dates[0]} to ${dates[dates.length - 1]}`);
		} else {
			console.log(`  ❌ NO VALID EARNINGS IN DATE RANGE`);

			// Show what we have
			if (inRange.length > 0) {
				const sample = inRange.slice(0, 3);
				console.log(`  Sample earnings in range:`);
				sample.forEach((e: any) => {
					console.log(
						`    ${e.date}: actual=${e.actualEarningResult}, est=${e.estimatedEarning}`
					);
				});
			}
		}

		await new Promise(resolve => setTimeout(resolve, 250));
	}
}

diagnoseDates().catch(console.error);
