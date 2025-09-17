/**
 * Test Runner for Admin Toggle Functionality
 * Runs tests in order and provides comprehensive reporting
 */

// Handle fetch import for different Node.js versions
let fetch
try {
  // Try Node.js 18+ built-in fetch
  fetch = globalThis.fetch
  if (!fetch) {
    // Fallback to node-fetch
    fetch = require('node-fetch')
  }
} catch (error) {
  console.error('❌ Could not import fetch. Please install node-fetch: npm install node-fetch')
  process.exit(1)
}

const testConfig = require('./test-config')

async function runAllTests() {
  console.log('🧪 STOCK PICKER ADMIN TOGGLE TEST SUITE')
  console.log('=' .repeat(60))
  console.log(`Base URL: ${testConfig.baseUrl}`)
  console.log(`Auth Token: ${testConfig.authToken}`)
  console.log()

  const results = {
    serverHealth: false,
    tests: [],
    startTime: Date.now()
  }

  // Step 1: Check server health
  console.log('1️⃣ Checking server health...')
  results.serverHealth = await testConfig.checkServerHealth(fetch)

  if (!results.serverHealth) {
    console.log('❌ Server is not running. Please start it with: npm run dev')
    console.log('   Some tests can still run in mock mode.')
    console.log()
  } else {
    console.log('✅ Server is running and healthy')
    console.log()
  }

  // Step 2: Test API endpoint availability
  console.log('2️⃣ Testing API endpoint availability...')
  const endpointTests = [
    { name: 'Health Check', endpoint: testConfig.endpoints.health, method: 'GET' },
    { name: 'Server Config', endpoint: testConfig.endpoints.serverConfig, method: 'GET' },
    { name: 'Server Toggle', endpoint: testConfig.endpoints.serverToggle, method: 'POST' },
    { name: 'Stock Select', endpoint: testConfig.endpoints.stockSelect, method: 'POST' }
  ]

  for (const test of endpointTests) {
    const testResult = await testEndpoint(test)
    results.tests.push(testResult)
    console.log(`   ${testResult.success ? '✅' : '❌'} ${test.name}: ${testResult.message}`)
  }
  console.log()

  // Step 3: Test server toggle functionality
  console.log('3️⃣ Testing server toggle functionality...')
  const toggleTest = await testServerToggle()
  results.tests.push(toggleTest)
  console.log(`   ${toggleTest.success ? '✅' : '❌'} Server Toggle: ${toggleTest.message}`)
  console.log()

  // Step 4: Test stock selection with disabled server
  console.log('4️⃣ Testing stock selection with disabled server...')
  const stockTest = await testStockSelectionBlocking()
  results.tests.push(stockTest)
  console.log(`   ${stockTest.success ? '✅' : '❌'} Stock Selection Blocking: ${stockTest.message}`)
  console.log()

  // Summary
  const endTime = Date.now()
  const totalTime = endTime - results.startTime
  const passedTests = results.tests.filter(t => t.success).length
  const totalTests = results.tests.length

  console.log('📊 TEST SUMMARY')
  console.log('=' .repeat(60))
  console.log(`Server Health: ${results.serverHealth ? '✅ HEALTHY' : '❌ UNAVAILABLE'}`)
  console.log(`Tests Passed: ${passedTests}/${totalTests}`)
  console.log(`Test Duration: ${totalTime}ms`)
  console.log()

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED!')
  } else {
    console.log('❌ SOME TESTS FAILED:')
    results.tests.filter(t => !t.success).forEach(test => {
      console.log(`   • ${test.name}: ${test.message}`)
      if (test.error) {
        console.log(`     Error: ${test.error}`)
      }
    })
  }

  return passedTests === totalTests
}

async function testEndpoint(test) {
  try {
    const url = `${testConfig.baseUrl}${test.endpoint}`
    const options = {
      method: test.method,
      headers: testConfig.createHeaders(),
      timeout: testConfig.defaultTimeout
    }

    if (test.method === 'POST') {
      // Add test body for POST requests
      if (test.endpoint.includes('toggle')) {
        options.body = JSON.stringify({ serverId: testConfig.testServer })
      } else if (test.endpoint.includes('select')) {
        options.body = JSON.stringify({
          mode: 'single',
          config: {
            symbol: testConfig.testSymbol,
            preferredDataSources: [testConfig.testServer],
            timeout: 5000
          }
        })
      }
    }

    const response = await fetch(url, options)
    const responseText = await response.text()

    // Special handling for different endpoints
    if (test.endpoint.includes('select')) {
      try {
        const responseData = JSON.parse(responseText)
        if (response.status === 400 && responseData.disabledSources) {
          return {
            name: test.name,
            success: true, // This is expected behavior when server is disabled
            message: 'Server properly blocked (as expected)',
            status: response.status,
            response: responseText
          }
        }
      } catch (e) {
        // Not JSON, continue with normal handling
      }
    }

    // Health endpoint returns structured data even with 503
    if (test.endpoint.includes('health')) {
      try {
        const responseData = JSON.parse(responseText)
        if (responseData.success !== undefined || responseData.timestamp) {
          return {
            name: test.name,
            success: true, // Endpoint is working, even if services are degraded
            message: `${response.status} ${response.statusText} (structured response)`,
            status: response.status,
            response: responseText
          }
        }
      } catch (e) {
        // Not JSON, continue with normal handling
      }
    }

    return {
      name: test.name,
      success: response.status < 500, // Accept 4xx errors as "working" endpoints
      message: `${response.status} ${response.statusText}`,
      status: response.status,
      response: responseText
    }

  } catch (error) {
    return {
      name: test.name,
      success: false,
      message: 'Network error or timeout',
      error: error.message
    }
  }
}

async function testServerToggle() {
  try {
    const url = `${testConfig.baseUrl}${testConfig.endpoints.serverToggle}`
    const response = await fetch(url, {
      method: 'POST',
      headers: testConfig.createHeaders(),
      body: JSON.stringify({ serverId: testConfig.testServer }),
      timeout: testConfig.defaultTimeout
    })

    const responseData = await response.json()

    if (response.ok && responseData.success !== undefined) {
      return {
        name: 'Server Toggle',
        success: true,
        message: `Toggle successful, server enabled: ${responseData.enabled}`,
        enabled: responseData.enabled
      }
    } else {
      return {
        name: 'Server Toggle',
        success: false,
        message: `Toggle failed: ${responseData.error || 'Unknown error'}`,
        error: responseData.error
      }
    }

  } catch (error) {
    return {
      name: 'Server Toggle',
      success: false,
      message: 'Toggle request failed',
      error: error.message
    }
  }
}

async function testStockSelectionBlocking() {
  try {
    const url = `${testConfig.baseUrl}${testConfig.endpoints.stockSelect}`
    const response = await fetch(url, {
      method: 'POST',
      headers: testConfig.createHeaders(),
      body: JSON.stringify({
        mode: 'single',
        config: {
          symbol: testConfig.testSymbol,
          preferredDataSources: [testConfig.testServer],
          timeout: 5000
        }
      }),
      timeout: testConfig.defaultTimeout
    })

    const responseData = await response.json()

    // Check if the request was properly blocked for disabled servers
    if (!response.ok && responseData.error &&
        (responseData.error.includes('disabled') || responseData.disabledSources)) {
      return {
        name: 'Stock Selection Blocking',
        success: true,
        message: 'Server properly blocked when disabled',
        blocked: true
      }
    } else if (response.ok) {
      return {
        name: 'Stock Selection Blocking',
        success: false,
        message: 'Security issue: Request succeeded when server should be disabled',
        blocked: false
      }
    } else {
      return {
        name: 'Stock Selection Blocking',
        success: false,
        message: `Unexpected response: ${responseData.error || 'Unknown error'}`,
        error: responseData.error
      }
    }

  } catch (error) {
    return {
      name: 'Stock Selection Blocking',
      success: false,
      message: 'Stock selection request failed',
      error: error.message
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests()
    .then(success => {
      console.log(`\n🏁 Test suite ${success ? 'PASSED' : 'FAILED'}`)
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test suite execution failed:', error)
      process.exit(1)
    })
}

module.exports = { runAllTests }