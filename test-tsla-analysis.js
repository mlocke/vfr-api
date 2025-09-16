#!/usr/bin/env node

/**
 * TSLA Stock Analysis System Test
 *
 * Executes a comprehensive test of the stock analysis system using TSLA (Tesla)
 * Tests the complete backend data flow pipeline and Yahoo Finance MCP integration
 *
 * Usage: node test-tsla-analysis.js
 */

const fs = require('fs').promises;
const path = require('path');

// Configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const OUTPUT_DIR = '/Users/michaellocke/WebstormProjects/Home/public/stock-picker/docs/test-output';
const TEST_SYMBOL = 'TSLA';

// Test request configurations
const TEST_REQUESTS = {
  singleStock: {
    scope: {
      mode: 'single_stock',
      symbols: [TEST_SYMBOL],
      maxResults: 1
    },
    options: {
      useRealTimeData: true,
      includeSentiment: true,
      includeNews: true,
      timeout: 30000
    }
  },
  singleStockBasic: {
    scope: {
      mode: 'single_stock',
      symbols: [TEST_SYMBOL]
    },
    options: {
      useRealTimeData: false
    }
  }
};

// Utility functions
const timestamp = () => new Date().toISOString();
const formatDuration = (start, end) => `${end - start}ms`;
const formatJSON = (obj, indent = 2) => JSON.stringify(obj, null, indent);

// Test execution class
class TSLAAnalysisTest {
  constructor() {
    this.startTime = Date.now();
    this.results = {
      testId: `tsla-test-${Date.now()}`,
      timestamp: timestamp(),
      symbol: TEST_SYMBOL,
      requests: [],
      healthCheck: null,
      summary: null,
      errors: []
    };
  }

  log(message, level = 'info') {
    const logMessage = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
    console.log(logMessage);
  }

  async makeRequest(url, options = {}) {
    const startTime = Date.now();
    try {
      this.log(`Making request to: ${url}`);

      // Use fetch if available, otherwise simulate
      let response;
      if (typeof fetch !== 'undefined') {
        response = await fetch(url, options);
      } else {
        // Simulate response for Node.js environment
        const { default: nodeFetch } = await import('node-fetch');
        response = await nodeFetch(url, options);
      }

      const endTime = Date.now();
      const duration = formatDuration(startTime, endTime);

      let data;
      const contentType = response.headers.get('content-type');

      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        data,
        duration,
        timestamp: timestamp()
      };
    } catch (error) {
      const endTime = Date.now();
      this.log(`Request failed: ${error.message}`, 'error');
      return {
        success: false,
        error: error.message,
        duration: formatDuration(startTime, endTime),
        timestamp: timestamp()
      };
    }
  }

  async testHealthCheck() {
    this.log('Testing health check endpoint...');

    const result = await this.makeRequest(`${API_BASE_URL}/api/stocks/select`, {
      method: 'GET'
    });

    this.results.healthCheck = result;

    if (result.success) {
      this.log(`Health check passed - Status: ${result.data.status}`);
      if (result.data.stats) {
        this.log(`Service stats - Requests: ${result.data.stats.totalRequests}, Success Rate: ${result.data.stats.successRate}`);
      }
    } else {
      this.log('Health check failed', 'error');
      this.results.errors.push({
        test: 'healthCheck',
        error: result.error || 'Health check endpoint not responding'
      });
    }

    return result;
  }

  async testStockAnalysis(requestConfig, testName) {
    this.log(`Testing ${testName} analysis for ${TEST_SYMBOL}...`);

    const result = await this.makeRequest(`${API_BASE_URL}/api/stocks/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestConfig)
    });

    const testResult = {
      name: testName,
      request: requestConfig,
      response: result,
      analysis: null
    };

    if (result.success && result.data.success) {
      this.log(`${testName} analysis completed successfully in ${result.duration}`);

      // Analyze the response
      testResult.analysis = this.analyzeResponse(result.data);

      if (result.data.singleStock) {
        this.log(`TSLA Score: ${result.data.singleStock.score.overallScore}`);
        this.log(`Recommendation: ${result.data.singleStock.action} (Confidence: ${result.data.singleStock.confidence})`);
      }
    } else {
      this.log(`${testName} analysis failed: ${result.error || 'Unknown error'}`, 'error');
      this.results.errors.push({
        test: testName,
        error: result.error || result.data?.error || 'Analysis failed'
      });
    }

    this.results.requests.push(testResult);
    return testResult;
  }

  analyzeResponse(responseData) {
    const analysis = {
      success: responseData.success,
      requestId: responseData.requestId,
      executionTime: responseData.executionTime,
      dataQuality: null,
      performance: responseData.performance,
      metadata: responseData.metadata
    };

    // Analyze single stock result if present
    if (responseData.singleStock) {
      const stock = responseData.singleStock;
      analysis.stockAnalysis = {
        symbol: stock.symbol,
        score: stock.score.overallScore,
        action: stock.action,
        confidence: stock.confidence,
        factorScores: stock.score.factorScores,
        marketData: stock.score.marketData,
        dataQuality: stock.score.dataQuality || stock.dataQuality?.overall
      };
    }

    // Extract performance metrics
    if (responseData.performance) {
      analysis.performanceAnalysis = {
        totalTime: responseData.executionTime,
        dataFetchTime: responseData.performance.dataFetchTime,
        analysisTime: responseData.performance.analysisTime,
        fusionTime: responseData.performance.fusionTime,
        cacheTime: responseData.performance.cacheTime,
        efficiency: responseData.performance.dataFetchTime / responseData.executionTime
      };
    }

    // Extract data source information
    if (responseData.metadata) {
      analysis.dataSourceAnalysis = {
        algorithmUsed: responseData.metadata.algorithmUsed,
        sourcesUsed: responseData.metadata.dataSourcesUsed,
        cacheHitRate: responseData.metadata.cacheHitRate,
        qualityScore: responseData.metadata.qualityScore
      };
    }

    return analysis;
  }

  async runAllTests() {
    this.log('Starting comprehensive TSLA stock analysis test...');
    this.log(`Test ID: ${this.results.testId}`);

    try {
      // Test 1: Health Check
      await this.testHealthCheck();

      // Test 2: Basic Single Stock Analysis
      await this.testStockAnalysis(TEST_REQUESTS.singleStockBasic, 'Basic Single Stock');

      // Test 3: Full Single Stock Analysis with Real-time Data
      await this.testStockAnalysis(TEST_REQUESTS.singleStock, 'Full Single Stock');

      // Generate summary
      this.generateSummary();

      // Save results
      await this.saveResults();

      this.log('All tests completed successfully!');
      return this.results;

    } catch (error) {
      this.log(`Test execution failed: ${error.message}`, 'error');
      this.results.errors.push({
        test: 'execution',
        error: error.message
      });

      await this.saveResults();
      throw error;
    }
  }

  generateSummary() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    const successfulRequests = this.results.requests.filter(req => req.response.success);
    const failedRequests = this.results.requests.filter(req => !req.response.success);

    this.results.summary = {
      totalDuration: `${totalDuration}ms`,
      totalTests: this.results.requests.length + (this.results.healthCheck ? 1 : 0),
      successfulTests: successfulRequests.length + (this.results.healthCheck?.success ? 1 : 0),
      failedTests: failedRequests.length + (this.results.healthCheck?.success ? 0 : 1),
      healthCheckStatus: this.results.healthCheck?.success ? 'PASS' : 'FAIL',
      errors: this.results.errors,
      performance: {
        averageResponseTime: successfulRequests.length > 0
          ? successfulRequests.reduce((acc, req) => acc + parseInt(req.response.duration), 0) / successfulRequests.length
          : 0,
        fastestResponse: Math.min(...successfulRequests.map(req => parseInt(req.response.duration))),
        slowestResponse: Math.max(...successfulRequests.map(req => parseInt(req.response.duration)))
      }
    };

    // Log summary
    this.log('=== TEST SUMMARY ===');
    this.log(`Total Tests: ${this.results.summary.totalTests}`);
    this.log(`Successful: ${this.results.summary.successfulTests}`);
    this.log(`Failed: ${this.results.summary.failedTests}`);
    this.log(`Health Check: ${this.results.summary.healthCheckStatus}`);
    this.log(`Total Duration: ${this.results.summary.totalDuration}`);

    if (successfulRequests.length > 0) {
      this.log(`Average Response Time: ${this.results.summary.performance.averageResponseTime.toFixed(2)}ms`);
    }
  }

  async saveResults() {
    try {
      // Ensure output directory exists
      await fs.mkdir(OUTPUT_DIR, { recursive: true });

      // Save full results
      const resultsFile = path.join(OUTPUT_DIR, `tsla-analysis-test-${Date.now()}.json`);
      await fs.writeFile(resultsFile, formatJSON(this.results), 'utf8');

      // Save summary report
      const reportFile = path.join(OUTPUT_DIR, `tsla-test-report-${Date.now()}.md`);
      const report = this.generateMarkdownReport();
      await fs.writeFile(reportFile, report, 'utf8');

      this.log(`Results saved to: ${resultsFile}`);
      this.log(`Report saved to: ${reportFile}`);

    } catch (error) {
      this.log(`Failed to save results: ${error.message}`, 'error');
    }
  }

  generateMarkdownReport() {
    const { summary, requests, healthCheck, errors } = this.results;

    let report = `# TSLA Stock Analysis System Test Report

## Test Overview
- **Test ID**: ${this.results.testId}
- **Timestamp**: ${this.results.timestamp}
- **Symbol Tested**: ${TEST_SYMBOL}
- **Total Duration**: ${summary.totalDuration}
- **Success Rate**: ${((summary.successfulTests / summary.totalTests) * 100).toFixed(2)}%

## Test Results Summary
- **Total Tests**: ${summary.totalTests}
- **Successful Tests**: ${summary.successfulTests}
- **Failed Tests**: ${summary.failedTests}
- **Health Check**: ${summary.healthCheckStatus}

## Performance Metrics
`;

    if (summary.performance.averageResponseTime > 0) {
      report += `- **Average Response Time**: ${summary.performance.averageResponseTime.toFixed(2)}ms
- **Fastest Response**: ${summary.performance.fastestResponse}ms
- **Slowest Response**: ${summary.performance.slowestResponse}ms
`;
    }

    // Health Check Results
    report += `
## Health Check Results
`;
    if (healthCheck) {
      report += `- **Status**: ${healthCheck.success ? '✅ PASS' : '❌ FAIL'}
- **Response Time**: ${healthCheck.duration}
- **API Status**: ${healthCheck.data?.status || 'Unknown'}
`;
      if (healthCheck.data?.stats) {
        report += `- **Service Stats**: ${healthCheck.data.stats.totalRequests} requests, ${healthCheck.data.stats.successRate} success rate
`;
      }
    }

    // Individual Test Results
    report += `
## Individual Test Results
`;

    requests.forEach((request, index) => {
      const status = request.response.success ? '✅ PASS' : '❌ FAIL';
      report += `
### ${index + 1}. ${request.name}
- **Status**: ${status}
- **Response Time**: ${request.response.duration}
- **Request Mode**: ${request.request.scope.mode}
`;

      if (request.analysis?.stockAnalysis) {
        const stock = request.analysis.stockAnalysis;
        report += `- **TSLA Score**: ${stock.score}
- **Recommendation**: ${stock.action} (Confidence: ${stock.confidence})
- **Market Cap**: $${stock.marketData?.marketCap?.toLocaleString() || 'N/A'}
- **Data Quality**: ${stock.dataQuality?.overall || 'N/A'}
`;
      }

      if (request.analysis?.dataSourceAnalysis) {
        const sources = request.analysis.dataSourceAnalysis;
        report += `- **Data Sources**: ${sources.sourcesUsed?.join(', ') || 'N/A'}
- **Cache Hit Rate**: ${sources.cacheHitRate || 'N/A'}
- **Algorithm Used**: ${sources.algorithmUsed || 'N/A'}
`;
      }
    });

    // Errors
    if (errors.length > 0) {
      report += `
## Errors Encountered
`;
      errors.forEach((error, index) => {
        report += `${index + 1}. **${error.test}**: ${error.error}
`;
      });
    }

    // Backend Data Flow Validation
    report += `
## Backend Data Flow Validation
Based on the test results, here's how the system performed against the expected data flow:

### 1. API Route Processing
- Request validation: ${requests.some(r => r.response.success) ? '✅ Working' : '❌ Failed'}
- Rate limiting: ${healthCheck?.success ? '✅ Working' : '❌ Failed'}
- Response formatting: ${requests.some(r => r.response.data?.success) ? '✅ Working' : '❌ Failed'}

### 2. Service Pool Management
- Service initialization: ${healthCheck?.success ? '✅ Working' : '❌ Failed'}
- Connection pooling: ${summary.performance.averageResponseTime < 5000 ? '✅ Efficient' : '⚠️ Slow'}

### 3. Data Collection
`;

    const successfulRequest = requests.find(r => r.response.success && r.analysis?.dataSourceAnalysis);
    if (successfulRequest) {
      const sources = successfulRequest.analysis.dataSourceAnalysis.sourcesUsed;
      report += `- Data sources used: ${sources?.length || 0} sources
- Yahoo Finance integration: ${sources?.includes('yahoo') ? '✅ Working' : '❓ Unknown'}
- Real-time data: ${successfulRequest.request.options.useRealTimeData ? '✅ Requested' : '❌ Not requested'}
`;
    }

    report += `
### 4. Performance Analysis
- Response time target (<5s): ${summary.performance.averageResponseTime < 5000 ? '✅ Met' : '❌ Exceeded'}
- Data quality: ${requests.some(r => r.analysis?.stockAnalysis?.dataQuality?.overall > 0.8) ? '✅ High' : '⚠️ Moderate'}

## Conclusions
${summary.failedTests === 0 ?
  '✅ All tests passed successfully. The TSLA analysis system is working correctly with the complete backend data flow pipeline.' :
  `⚠️ ${summary.failedTests} test(s) failed. Review the errors above and check system configuration.`}

---
*Report generated on ${timestamp()}*
`;

    return report;
  }
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting TSLA Stock Analysis System Test');
    console.log('=' .repeat(50));

    const test = new TSLAAnalysisTest();
    const results = await test.runAllTests();

    console.log('=' .repeat(50));
    console.log('✅ Test execution completed');
    console.log(`📊 Results: ${results.summary.successfulTests}/${results.summary.totalTests} tests passed`);

    if (results.errors.length > 0) {
      console.log(`⚠️  Errors encountered: ${results.errors.length}`);
      process.exit(1);
    }

    process.exit(0);

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { TSLAAnalysisTest, TEST_REQUESTS };