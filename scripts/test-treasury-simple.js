#!/usr/bin/env node
/**
 * Simple Treasury Fiscal Data API Test
 *
 * Basic test to verify Treasury API endpoints are working.
 * Uses direct fetch calls to test the API integration.
 */

const fs = require('fs');
const path = require('path');

// Test configuration
const TREASURY_BASE_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'test-output');
const TEST_ID = `treasury-simple-test-${Date.now()}`;

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function testTreasuryEndpoint(endpoint, description) {
  console.log(`🏛️ Testing ${description}...`);

  const startTime = Date.now();

  try {
    const url = `${TREASURY_BASE_URL}${endpoint}`;
    console.log(`   URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Stock-Picker Financial Analysis Platform v1.0'
      }
    });

    const responseTime = Date.now() - startTime;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const recordCount = data.data?.length || 0;

    console.log(`✅ ${description}: ${recordCount} records in ${responseTime}ms`);

    return {
      success: true,
      endpoint,
      description,
      responseTime,
      recordCount,
      sampleData: data.data?.[0] || null
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.log(`❌ ${description}: Failed in ${responseTime}ms - ${error.message}`);

    return {
      success: false,
      endpoint,
      description,
      responseTime,
      recordCount: 0,
      error: error.message
    };
  }
}

async function runTreasuryTests() {
  console.log('🏛️ Treasury Fiscal Data API Simple Test');
  console.log('=======================================');
  console.log(`Test ID: ${TEST_ID}`);
  console.log('');

  const testStartTime = Date.now();

  // Define test endpoints
  const tests = [
    {
      endpoint: '/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=5',
      description: 'Federal Debt (Debt to the Penny)'
    },
    {
      endpoint: '/v1/accounting/dts/dts_table_1?sort=-record_date&page[size]=5',
      description: 'Daily Treasury Statement'
    },
    {
      endpoint: '/v1/accounting/od/rates_of_exchange?sort=-record_date&page[size]=5',
      description: 'Exchange Rates'
    },
    {
      endpoint: '/v1/accounting/mts/mts_table_2?filter=record_fiscal_year:eq:2024&page[size]=5',
      description: 'Federal Spending (2024)'
    },
    {
      endpoint: '/v1/accounting/dts/operating_cash_balance?sort=-record_date&page[size]=5',
      description: 'Operating Cash Balance'
    }
  ];

  const results = [];

  // Run tests sequentially with delays to respect rate limits
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const result = await testTreasuryEndpoint(test.endpoint, test.description);
    results.push(result);

    // Add delay between requests (200ms = 5 req/sec max)
    if (i < tests.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }

  const testDuration = Date.now() - testStartTime;
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  // Generate summary
  console.log('\n📊 Test Summary');
  console.log('================');
  console.log(`Duration: ${(testDuration / 1000).toFixed(2)} seconds`);
  console.log(`Success Rate: ${successful.length}/${results.length} (${((successful.length / results.length) * 100).toFixed(1)}%)`);

  if (successful.length > 0) {
    const avgResponseTime = successful.reduce((sum, r) => sum + r.responseTime, 0) / successful.length;
    console.log(`Average Response Time: ${avgResponseTime.toFixed(0)}ms`);

    const totalRecords = successful.reduce((sum, r) => sum + r.recordCount, 0);
    console.log(`Total Data Points: ${totalRecords}`);
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Endpoints:');
    failed.forEach(result => {
      console.log(`  - ${result.description}: ${result.error}`);
    });
  }

  // Save results
  const summary = {
    testId: TEST_ID,
    timestamp: new Date().toISOString(),
    duration: testDuration,
    endpoints: {
      total: results.length,
      successful: successful.length,
      failed: failed.length
    },
    results
  };

  const jsonPath = path.join(OUTPUT_DIR, `${TEST_ID}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(summary, null, 2));

  console.log(`\n💾 Results saved to: ${jsonPath}`);

  // Create simple markdown report
  const reportContent = `# Treasury API Simple Test Report

## Overview
- **Test ID**: ${TEST_ID}
- **Date**: ${new Date().toISOString()}
- **Duration**: ${(testDuration / 1000).toFixed(2)} seconds
- **Success Rate**: ${successful.length}/${results.length} (${((successful.length / results.length) * 100).toFixed(1)}%)

## Results
${results.map(r => `- **${r.description}**: ${r.success ? '✅' : '❌'} (${r.responseTime}ms${r.success ? `, ${r.recordCount} records` : ''})`).join('\n')}

## Status
${successful.length === results.length ? '🎉 All Treasury API endpoints are working correctly!' : '⚠️ Some endpoints failed - check implementation.'}
`;

  const mdPath = path.join(OUTPUT_DIR, `${TEST_ID}-report.md`);
  fs.writeFileSync(mdPath, reportContent);

  console.log(`📄 Report saved to: ${mdPath}`);

  if (failed.length === 0) {
    console.log('\n🎉 All Treasury API tests passed! Integration is working correctly.');
    return true;
  } else {
    console.log('\n⚠️ Some tests failed. Review the errors and check API implementation.');
    return false;
  }
}

// Run the tests
runTreasuryTests()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  });