import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function testHistoricalEarnings() {
	const fmp = new FinancialModelingPrepAPI();

	const symbol = 'AAPL';
	const earnings = await fmp.getEarningsSurprises(symbol, 60);

	console.log(`Total earnings records for ${symbol}: ${earnings.length}\n`);

	// Filter to historical only (past dates with actual data)
	const historical = earnings.filter(e => {
		const date = new Date(e.date);
		return date < new Date() && e.actualEarningResult !== 0 && e.estimatedEarning !== 0;
	});

	console.log(`Historical earnings (past + non-zero): ${historical.length}`);

	if (historical.length > 0) {
		console.log('\nFirst 5 historical earnings:');
		historical.slice(0, 5).forEach((e, i) => {
			const surprise = ((e.actualEarningResult - e.estimatedEarning) / Math.abs(e.estimatedEarning)) * 100;
			console.log(`${i + 1}. ${e.date}: Actual=${e.actualEarningResult.toFixed(2)}, Est=${e.estimatedEarning.toFixed(2)}, Surprise=${surprise.toFixed(1)}%`);
		});
	} else {
		console.log('⚠️  NO HISTORICAL EARNINGS DATA FOUND');
	}

	// Check what percentage are future
	const future = earnings.filter(e => new Date(e.date) > new Date());
	const zeros = earnings.filter(e => e.actualEarningResult === 0 || e.estimatedEarning === 0);

	console.log(`\nBreakdown:`);
	console.log(`  Future dates: ${future.length}`);
	console.log(`  Zero values: ${zeros.length}`);
	console.log(`  Historical valid: ${historical.length}`);
}

testHistoricalEarnings().catch(console.error);
