import "dotenv/config";
import { FinancialModelingPrepAPI } from "../../app/services/financial-data/FinancialModelingPrepAPI.js";

async function testFMPTier() {
  const fmp = new FinancialModelingPrepAPI();
  
  console.log('═'.repeat(80));
  console.log('FMP API TIER & ENDPOINT TESTING');
  console.log('═'.repeat(80));
  
  // Test 1: Earnings surprises (premium endpoint)
  console.log('\n🔍 Test 1: /earnings-surprises/ endpoint');
  try {
    const surprises = await fmp.getEarningsSurprises('AAPL');
    console.log(`✓ Success: ${surprises.length} earnings records`);
    if (surprises.length > 0) {
      console.log('Sample:', JSON.stringify(surprises.slice(0, 2), null, 2));
    }
  } catch (error: any) {
    console.log('✗ Error:', error.message);
  }
  
  // Test 2: Income statement (fallback approach)
  console.log('\n🔍 Test 2: /income-statement/ endpoint (current approach)');
  try {
    const url = `/income-statement/AAPL?period=quarter&limit=60`;
    const response = await (fmp as any).makeRequest(url);
    console.log(`✓ Success: ${response.data?.length || 0} quarterly statements`);
    if (response.data?.length > 0) {
      console.log('Sample:', JSON.stringify(response.data.slice(0, 1), null, 2));
    }
  } catch (error: any) {
    console.log('✗ Error:', error.message);
  }
  
  // Test 3: Check multiple symbols
  console.log('\n🔍 Test 3: Testing 10 random S&P 500 symbols');
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'JPM', 'V', 'WMT', 'DIS', 'NFLX', 'BA'];
  let successCount = 0;
  
  for (const symbol of symbols) {
    try {
      const earnings = await fmp.getEarningsSurprises(symbol);
      if (earnings.length > 0) {
        successCount++;
        console.log(`  ✓ ${symbol}: ${earnings.length} earnings`);
      } else {
        console.log(`  ✗ ${symbol}: No data`);
      }
    } catch (error: any) {
      console.log(`  ✗ ${symbol}: ${error.message}`);
    }
  }
  
  console.log(`\n📊 Success rate: ${successCount}/${symbols.length} (${(successCount/symbols.length*100).toFixed(0)}%)`);
  
  console.log('\n═'.repeat(80));
  console.log('CONCLUSION:');
  if (successCount >= 8) {
    console.log('✅ FMP API tier supports earnings data for most symbols');
    console.log('   Recommendation: Use /income-statement/ for comprehensive coverage');
  } else {
    console.log('⚠️  FMP API has limited earnings data coverage');
    console.log('   Current 1,051 example dataset is the best available option');
  }
  console.log('═'.repeat(80));
}

testFMPTier().catch(console.error);
