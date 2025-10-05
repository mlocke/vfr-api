import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function testEarningsAPI() {
	const fmp = new FinancialModelingPrepAPI();

	const symbols = ['AAPL', 'MSFT', 'GOOGL', 'NVDA', 'META'];

	console.log('Testing FMP earnings surprises API...\n');

	for (const symbol of symbols) {
		try {
			const earnings = await fmp.getEarningsSurprises(symbol, 60);
			console.log(`${symbol}: ${earnings.length} earnings records`);
			if (earnings.length > 0) {
				console.log(`  Sample: ${JSON.stringify(earnings[0])}`);
			} else {
				console.log(`  ⚠️  NO DATA RETURNED`);
			}
		} catch (error: any) {
			console.log(`${symbol}: ERROR - ${error.message}`);
		}
	}
}

testEarningsAPI().catch(console.error);
