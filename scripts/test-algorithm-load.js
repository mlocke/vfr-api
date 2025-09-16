#!/usr/bin/env node

/**
 * Test script to verify algorithm configurations are properly loaded
 */

const path = require('path');

// Mock the TypeScript modules for testing
async function testAlgorithmLoading() {
  console.log('🧪 Testing Algorithm Configuration Loading...');

  try {
    // Test 1: Check if data file exists
    const fs = require('fs');
    const configPath = path.join(__dirname, '..', 'data', 'algorithm-configs.json');

    if (fs.existsSync(configPath)) {
      console.log('✅ Algorithm configuration file exists:', configPath);

      const configData = fs.readFileSync(configPath, 'utf8');
      const configs = JSON.parse(configData);

      console.log('📚 Found configurations:', Object.keys(configs));

      // Check specific configs
      if (configs.composite) {
        console.log('✅ Composite algorithm found:', configs.composite.name);
        console.log(`   • Factors: ${configs.composite.weights.length}`);
        console.log(`   • Max positions: ${configs.composite.universe.maxPositions}`);
      }

      if (configs.quality) {
        console.log('✅ Quality algorithm found:', configs.quality.name);
        console.log(`   • Factors: ${configs.quality.weights.length}`);
        console.log(`   • Max positions: ${configs.quality.universe.maxPositions}`);
      }

      return true;
    } else {
      console.log('❌ Algorithm configuration file not found');
      return false;
    }

  } catch (error) {
    console.error('❌ Error testing algorithm loading:', error);
    return false;
  }
}

// Test making a direct API call to understand the issue
async function testDirectAPICall() {
  console.log('\n🌐 Testing direct API call...');

  try {
    const fetch = (await import('node-fetch')).default;

    // Test health check first
    const healthResponse = await fetch('http://localhost:3000/api/stocks/select');
    const healthData = await healthResponse.json();

    console.log('🏥 Health check response:', {
      status: healthData.status,
      supportedModes: healthData.supportedModes,
      health: healthData.health
    });

    // Test minimal single stock request
    const testRequest = {
      scope: {
        mode: 'single_stock',
        symbols: ['TSLA']
      },
      options: {
        useRealTimeData: false,
        timeout: 10000
      }
    };

    console.log('📤 Sending test request:', JSON.stringify(testRequest, null, 2));

    const response = await fetch('http://localhost:3000/api/stocks/select', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testRequest)
    });

    const responseData = await response.json();
    console.log('📥 Response status:', response.status);
    console.log('📥 Response data:', JSON.stringify(responseData, null, 2));

    return responseData.success;

  } catch (error) {
    console.error('❌ Error in direct API test:', error);
    return false;
  }
}

async function main() {
  console.log('🎯 Algorithm System Diagnostic Test');
  console.log('=' .repeat(50));

  const configsLoaded = await testAlgorithmLoading();
  const apiWorking = await testDirectAPICall();

  console.log('\n' + '=' .repeat(50));
  console.log('📊 Test Results:');
  console.log(`   • Configuration loading: ${configsLoaded ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`   • API functionality: ${apiWorking ? '✅ PASS' : '❌ FAIL'}`);

  if (configsLoaded && apiWorking) {
    console.log('🎉 All tests passed! System is ready.');
  } else {
    console.log('⚠️  Some tests failed. Check the logs above.');
  }

  return configsLoaded && apiWorking;
}

if (require.main === module) {
  main()
    .then(success => process.exit(success ? 0 : 1))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testAlgorithmLoading, testDirectAPICall };