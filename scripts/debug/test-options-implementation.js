#!/usr/bin/env node

/**
 * Test script for Alpha Vantage and Yahoo Finance options implementation
 * This script demonstrates the new options methods and their expected behavior
 */

const { AlphaVantageAPI } = require('./app/services/financial-data/AlphaVantageAPI.ts');
const { YahooFinanceAPI } = require('./app/services/financial-data/YahooFinanceAPI.ts');

async function testOptionsImplementation() {
  console.log('🔬 Testing Options Implementation\n');

  // Test Alpha Vantage options (should return null with clear messaging)
  console.log('=== Alpha Vantage Options Tests ===');
  const alphaVantage = new AlphaVantageAPI();

  console.log('1. Testing Alpha Vantage Put/Call Ratio:');
  const avPutCallRatio = await alphaVantage.getPutCallRatio('AAPL');
  console.log('Result:', avPutCallRatio);

  console.log('\n2. Testing Alpha Vantage Options Analysis:');
  const avOptionsAnalysis = await alphaVantage.getOptionsAnalysisFreeTier('AAPL');
  console.log('Result:', avOptionsAnalysis);

  console.log('\n3. Testing Alpha Vantage Options Chain:');
  const avOptionsChain = await alphaVantage.getOptionsChain('AAPL');
  console.log('Result:', avOptionsChain);

  console.log('\n4. Testing Alpha Vantage Options Availability:');
  const avAvailability = await alphaVantage.checkOptionsAvailability();
  console.log('Result:', avAvailability);

  // Test Yahoo Finance options (may work but unreliable)
  console.log('\n\n=== Yahoo Finance Options Tests ===');
  const yahooFinance = new YahooFinanceAPI();

  console.log('1. Testing Yahoo Finance Options Availability:');
  const yhAvailability = await yahooFinance.checkOptionsAvailability();
  console.log('Result:', yhAvailability);

  if (yhAvailability.putCallRatio) {
    console.log('\n2. Testing Yahoo Finance Put/Call Ratio:');
    const yhPutCallRatio = await yahooFinance.getPutCallRatio('SPY');
    console.log('Result:', yhPutCallRatio);

    console.log('\n3. Testing Yahoo Finance Options Analysis:');
    const yhOptionsAnalysis = await yahooFinance.getOptionsAnalysisFreeTier('SPY');
    console.log('Result:', yhOptionsAnalysis);
  } else {
    console.log('Yahoo Finance unofficial API not available - skipping live tests');
  }

  console.log('\n✅ Options implementation testing complete!');
  console.log('\nSummary:');
  console.log('- Alpha Vantage: Premium subscription required for options data');
  console.log('- Yahoo Finance: Unofficial API may provide limited options data');
  console.log('- Polygon: Free tier returns 403 Forbidden for options');
  console.log('- TwelveData: Requires paid plan for options');
  console.log('\nRecommendation: Yahoo Finance as fallback until premium subscriptions are available');
}

// Run the test if this script is executed directly
if (require.main === module) {
  testOptionsImplementation().catch(console.error);
}

module.exports = { testOptionsImplementation };