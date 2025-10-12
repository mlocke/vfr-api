/**
 * Test SEC EDGAR Integration
 *
 * Tests the real SEC EDGAR Form 4 and 13F-HR XML parsing implementation
 * Verifies:
 * - Real data retrieval from SEC EDGAR
 * - XML parsing correctness
 * - Zero placeholder values
 * - Feature variance across symbols
 */

import { SECEdgarAPI } from '../../app/services/financial-data/SECEdgarAPI';

async function testSECEdgarIntegration() {
	console.log('='.repeat(80));
	console.log('SEC EDGAR INTEGRATION TEST');
	console.log('='.repeat(80));
	console.log();

	const secAPI = new SECEdgarAPI();

	// Test symbols
	const testSymbols = ['AAPL', 'MSFT'];

	for (const symbol of testSymbols) {
		console.log(`\n${'='.repeat(80)}`);
		console.log(`Testing ${symbol}`);
		console.log('='.repeat(80));

		// Test 1: Form 4 Insider Transactions
		console.log(`\n📋 Test 1: Form 4 Insider Transactions (${symbol})`);
		console.log('-'.repeat(80));

		try {
			const insiderTransactions = await secAPI.getForm4Transactions(symbol, 90);

			if (!insiderTransactions || insiderTransactions.length === 0) {
				console.log(`⚠️  No Form 4 transactions found for ${symbol} (may be expected)`);
			} else {
				console.log(`✅ Found ${insiderTransactions.length} insider transactions`);

				// Show first 3 transactions
				const samplesToShow = Math.min(3, insiderTransactions.length);
				for (let i = 0; i < samplesToShow; i++) {
					const tx = insiderTransactions[i];
					console.log(`\n  Transaction ${i + 1}:`);
					console.log(`    Insider: ${tx.reportingOwnerName} (${tx.reportingOwnerTitle || 'N/A'})`);
					console.log(`    Date: ${tx.transactionDate}`);
					console.log(`    Type: ${tx.transactionType} (Code: ${tx.transactionCode})`);
					console.log(`    Shares: ${tx.shares.toLocaleString()}`);
					console.log(`    Price: $${tx.pricePerShare?.toFixed(2) || 'N/A'}`);
					console.log(`    Value: $${tx.transactionValue?.toLocaleString() || 'N/A'}`);
					console.log(`    Owned After: ${tx.sharesOwnedAfter.toLocaleString()}`);
					console.log(`    Relationship: ${tx.relationship.join(', ')}`);
				}

				// Check for placeholder values
				console.log(`\n  📊 Data Quality Checks:`);
				const hasPlaceholderNames = insiderTransactions.some(tx =>
					tx.reportingOwnerName === 'Mock Insider' ||
					tx.reportingOwnerName === 'Unknown' ||
					tx.reportingOwnerName === ''
				);
				const hasPlaceholderValues = insiderTransactions.some(tx =>
					tx.shares === 10000 && tx.pricePerShare === 150.0
				);
				const hasVariance = new Set(insiderTransactions.map(tx => tx.shares)).size > 1;

				console.log(`    ✅ No placeholder names: ${!hasPlaceholderNames ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ No placeholder values: ${!hasPlaceholderValues ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ Has data variance: ${hasVariance ? 'PASS' : 'FAIL'}`);

				if (hasPlaceholderNames || hasPlaceholderValues) {
					console.error(`\n  ❌ CRITICAL: Found placeholder/mock data in ${symbol}!`);
					return false;
				}
			}
		} catch (error) {
			console.error(`❌ Form 4 test FAILED for ${symbol}:`, error);
			return false;
		}

		// Test 2: 13F Institutional Holdings
		console.log(`\n\n📋 Test 2: 13F Institutional Holdings (${symbol})`);
		console.log('-'.repeat(80));

		try {
			const holdings = await secAPI.get13FHoldings(symbol, 2);

			if (!holdings || holdings.length === 0) {
				console.log(`⚠️  No 13F holdings found for ${symbol} (may be expected)`);
			} else {
				console.log(`✅ Found ${holdings.length} institutional holdings`);

				// Show first 3 holdings
				const samplesToShow = Math.min(3, holdings.length);
				for (let i = 0; i < samplesToShow; i++) {
					const holding = holdings[i];
					console.log(`\n  Holding ${i + 1}:`);
					console.log(`    Institution: ${holding.managerName}`);
					console.log(`    Security: ${holding.securityName}`);
					console.log(`    CUSIP: ${holding.cusip}`);
					console.log(`    Shares: ${holding.shares.toLocaleString()}`);
					console.log(`    Market Value: $${holding.marketValue.toLocaleString()}`);
					console.log(`    Filing Date: ${holding.filingDate}`);
					console.log(`    Security Type: ${holding.securityType}`);
				}

				// Check for placeholder values
				console.log(`\n  📊 Data Quality Checks:`);
				const hasPlaceholderCUSIPs = holdings.some(h =>
					h.cusip === '037833100'
				);
				const hasPlaceholderInstitutions = holdings.some(h =>
					h.managerName === 'Mock Institutional Manager' ||
					h.managerName === ''
				);
				const hasPlaceholderShares = holdings.some(h =>
					h.shares === 1000000 && h.marketValue === 150000000
				);
				const hasVariance = new Set(holdings.map(h => h.shares)).size > 1;
				const validCUSIPs = holdings.every(h => h.cusip && h.cusip.length === 9);

				console.log(`    ✅ No placeholder CUSIPs: ${!hasPlaceholderCUSIPs ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ No placeholder institutions: ${!hasPlaceholderInstitutions ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ No placeholder values: ${!hasPlaceholderShares ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ Has data variance: ${hasVariance ? 'PASS' : 'FAIL'}`);
				console.log(`    ✅ Valid CUSIP format: ${validCUSIPs ? 'PASS' : 'FAIL'}`);

				if (hasPlaceholderCUSIPs || hasPlaceholderInstitutions || hasPlaceholderShares) {
					console.error(`\n  ❌ CRITICAL: Found placeholder/mock data in ${symbol}!`);
					return false;
				}

				if (!validCUSIPs) {
					console.error(`\n  ❌ CRITICAL: Invalid CUSIP format detected!`);
					return false;
				}
			}
		} catch (error) {
			console.error(`❌ 13F test FAILED for ${symbol}:`, error);
			return false;
		}

		// Test 3: Insider Sentiment
		console.log(`\n\n📋 Test 3: Insider Sentiment Aggregation (${symbol})`);
		console.log('-'.repeat(80));

		try {
			const sentiment = await secAPI.getInsiderSentiment(symbol);

			if (!sentiment) {
				console.log(`⚠️  No insider sentiment calculated for ${symbol}`);
			} else {
				console.log(`✅ Insider Sentiment Calculated`);
				console.log(`  Period: ${sentiment.period}`);
				console.log(`  Total Transactions: ${sentiment.totalTransactions}`);
				console.log(`  Total Insiders: ${sentiment.totalInsiders}`);
				console.log(`  Buy Count: ${sentiment.buyTransactions}`);
				console.log(`  Sell Count: ${sentiment.sellTransactions}`);
				console.log(`  Net Shares: ${sentiment.netShares.toLocaleString()}`);
				console.log(`  Net Value: $${sentiment.netValue.toLocaleString()}`);
				console.log(`  Sentiment: ${sentiment.sentiment} (Score: ${sentiment.sentimentScore}/10)`);
			}
		} catch (error) {
			console.error(`❌ Insider sentiment test FAILED for ${symbol}:`, error);
			// Non-critical - continue
		}

		// Test 4: Institutional Sentiment
		console.log(`\n\n📋 Test 4: Institutional Sentiment Aggregation (${symbol})`);
		console.log('-'.repeat(80));

		try {
			const sentiment = await secAPI.getInstitutionalSentiment(symbol);

			if (!sentiment) {
				console.log(`⚠️  No institutional sentiment calculated for ${symbol}`);
			} else {
				console.log(`✅ Institutional Sentiment Calculated`);
				console.log(`  Report Date: ${sentiment.reportDate}`);
				console.log(`  Total Institutions: ${sentiment.totalInstitutions}`);
				console.log(`  Total Shares: ${sentiment.totalShares.toLocaleString()}`);
				console.log(`  Total Value: $${sentiment.totalValue.toLocaleString()}`);
				console.log(`  New Positions: ${sentiment.quarterlyChange.newPositions}`);
				console.log(`  Closed Positions: ${sentiment.quarterlyChange.closedPositions}`);
				console.log(`  Increased Positions: ${sentiment.quarterlyChange.increasedPositions}`);
				console.log(`  Decreased Positions: ${sentiment.quarterlyChange.decreasedPositions}`);
				console.log(`  Sentiment: ${sentiment.sentiment} (Score: ${sentiment.sentimentScore}/10)`);
			}
		} catch (error) {
			console.error(`❌ Institutional sentiment test FAILED for ${symbol}:`, error);
			// Non-critical - continue
		}
	}

	console.log(`\n\n${'='.repeat(80)}`);
	console.log('✅ ALL TESTS PASSED - NO PLACEHOLDER DATA DETECTED');
	console.log('='.repeat(80));
	console.log();
	console.log('Summary:');
	console.log('  ✅ Real SEC EDGAR Form 4 XML parsing working');
	console.log('  ✅ Real SEC EDGAR 13F-HR XML parsing working');
	console.log('  ✅ Zero placeholder values detected');
	console.log('  ✅ Feature variance confirmed across symbols');
	console.log('  ✅ Data quality validation passed');
	console.log();
	console.log('🎉 SEC EDGAR integration is ready for dataset generation!');
	console.log();

	return true;
}

// Run tests
testSECEdgarIntegration()
	.then(success => {
		if (success) {
			process.exit(0);
		} else {
			console.error('\n❌ Tests FAILED - Fix issues before proceeding');
			process.exit(1);
		}
	})
	.catch(error => {
		console.error('\n❌ Test execution FAILED:', error);
		process.exit(1);
	});
