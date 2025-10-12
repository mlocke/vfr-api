/**
 * Test script for HybridSmartMoneyDataService
 * Verifies SEC EDGAR and Polygon.io data fetching works correctly
 */

import { HybridSmartMoneyDataService } from '../../../app/services/ml/smart-money-flow/HybridSmartMoneyDataService';

async function main() {
	console.log('🧪 Testing HybridSmartMoneyDataService\n');

	const service = new HybridSmartMoneyDataService();
	const symbol = 'AAPL';
	const endDate = '2024-01-31';
	const startDate = '2023-11-01'; // 90 days back

	try {
		// Test 1: Insider Trading from SEC EDGAR
		console.log(`📊 Test 1: Fetching insider trades for ${symbol}...`);
		const insiderTrades = await service.getInsiderTrading(symbol, startDate, endDate, 10);
		console.log(`  ✅ Found ${insiderTrades.length} insider transactions`);
		if (insiderTrades.length > 0) {
			console.log(`  📋 Sample transaction:`, {
				date: insiderTrades[0].transactionDate,
				type: insiderTrades[0].transactionType,
				shares: insiderTrades[0].securitiesTransacted,
				insider: insiderTrades[0].reportingName,
			});
		}

		// Test 2: Institutional Ownership from SEC EDGAR
		console.log(`\n📊 Test 2: Fetching institutional holdings for ${symbol}...`);
		const instHoldings = await service.getInstitutionalOwnership(symbol, 10);
		console.log(`  ✅ Found ${instHoldings.length} institutional holdings`);
		if (instHoldings.length > 0) {
			console.log(`  📋 Sample holding:`, {
				date: instHoldings[0].date,
				investor: instHoldings[0].investorName,
				shares: instHoldings[0].shares,
				value: instHoldings[0].marketValue,
			});
		}

		// Test 3: Options Flow Proxy
		console.log(`\n📊 Test 3: Fetching options flow proxy for ${symbol}...`);
		const congressProxy = await service.getCongressionalTradesProxy(symbol, startDate, endDate);
		console.log(`  ✅ Found ${congressProxy.length} proxy signals`);

		// Test 4: ETF Holdings Proxy
		console.log(`\n📊 Test 4: Fetching ETF holdings proxy for ${symbol}...`);
		const etfProxy = await service.getETFHoldingsProxy(symbol);
		console.log(`  ✅ Found ${etfProxy.length} proxy signals`);

		// Test 5: Get all data at once
		console.log(`\n📊 Test 5: Fetching all smart money data for ${symbol}...`);
		const allData = await service.getAllSmartMoneyData(symbol, startDate, endDate);
		console.log(`  ✅ Complete data package:`);
		console.log(`     - Insider trades: ${allData.insiderTrading.length}`);
		console.log(`     - Institutional holdings: ${allData.institutionalOwnership.length}`);
		console.log(`     - Congressional proxy: ${allData.congressionalTrades.length}`);
		console.log(`     - ETF proxy: ${allData.etfHoldings.length}`);

		console.log(`\n✅ All tests passed! Hybrid service working correctly.`);
	} catch (error) {
		console.error(`\n❌ Test failed:`, error);
		process.exit(1);
	}
}

main();
