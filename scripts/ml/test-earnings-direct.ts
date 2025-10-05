import { FinancialModelingPrepAPI } from '../../app/services/financial-data/FinancialModelingPrepAPI.js';

async function test() {
  const fmp = new FinancialModelingPrepAPI();
  const testSymbols = ['AAPL', 'MSFT', 'PG', 'MA', 'HD', 'GOOGL', 'JPM', 'JNJ'];
  
  console.log('Testing FMP /historical/earning_calendar/ endpoint:\n');
  
  for (const symbol of testSymbols) {
    const earnings = await fmp.getEarningsSurprises(symbol, 20);
    console.log(`${symbol}: ${earnings.length} records`);
    if (earnings.length > 0) {
      console.log(`  Latest: ${earnings[0].date} - actual: ${earnings[0].actualEarningResult}, estimated: ${earnings[0].estimatedEarning}`);
    } else {
      console.log(`  ⚠️  NO EARNINGS DATA RETURNED`);
    }
    await new Promise(r => setTimeout(r, 300)); // Rate limiting
  }
}

test().catch(console.error);
