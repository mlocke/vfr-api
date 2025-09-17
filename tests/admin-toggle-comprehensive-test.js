/**
 * Comprehensive test for admin toggle functionality
 * Tests both the toggle state persistence and the actual connection blocking
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'
const authToken = 'dev-admin-token'

async function checkServerRunning() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, { timeout: 2000 })
    return response.ok
  } catch (error) {
    return false
  }
}

async function testToggleStateManagement() {
  console.log('\n🔧 Testing Toggle State Management')
  console.log('=' .repeat(50))

  try {
    // 1. Get initial state
    console.log('1️⃣ Getting initial server configuration...')
    const configResponse = await fetch(`${BASE_URL}/api/admin/server-config`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })

    if (!configResponse.ok) {
      throw new Error(`Failed to get config: ${configResponse.status}`)
    }

    const configData = await configResponse.json()
    console.log(`   📋 Enabled servers: ${configData.enabledServers.join(', ')}`)

    const wasPolygonEnabled = configData.enabledServers.includes('polygon')
    console.log(`   🔹 Polygon initially: ${wasPolygonEnabled ? 'ENABLED' : 'DISABLED'}`)

    // 2. Disable Polygon
    console.log('\n2️⃣ Disabling Polygon server...')
    const disableResponse = await fetch(`${BASE_URL}/api/admin/server-config/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ serverId: 'polygon' })
    })

    if (!disableResponse.ok) {
      const errorText = await disableResponse.text()
      throw new Error(`Failed to toggle: ${disableResponse.status} - ${errorText}`)
    }

    const disableResult = await disableResponse.json()
    console.log(`   ✅ Toggle result: polygon is now ${disableResult.enabled ? 'ENABLED' : 'DISABLED'}`)

    // 3. Verify state persistence by checking config again
    console.log('\n3️⃣ Verifying state persistence...')
    const configResponse2 = await fetch(`${BASE_URL}/api/admin/server-config`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })

    const configData2 = await configResponse2.json()
    const isPolygonEnabledNow = configData2.enabledServers.includes('polygon')
    console.log(`   📋 Current enabled servers: ${configData2.enabledServers.join(', ')}`)
    console.log(`   🔹 Polygon state: ${isPolygonEnabledNow ? 'ENABLED' : 'DISABLED'}`)

    const stateCorrect = isPolygonEnabledNow === disableResult.enabled
    console.log(`   ${stateCorrect ? '✅' : '❌'} State persistence: ${stateCorrect ? 'WORKING' : 'BROKEN'}`)

    return {
      success: stateCorrect,
      polygonEnabled: isPolygonEnabledNow,
      originalState: wasPolygonEnabled
    }

  } catch (error) {
    console.error('❌ Toggle state test failed:', error)
    return { success: false, error: error.message }
  }
}

async function testConnectionBlocking() {
  console.log('\n🚫 Testing Connection Blocking')
  console.log('=' .repeat(50))

  try {
    // Test with polygon explicitly disabled
    console.log('1️⃣ Testing stock selection with Polygon disabled...')
    const stockResponse = await fetch(`${BASE_URL}/api/stocks/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        mode: 'single',
        config: {
          symbol: 'AAPL',
          preferredDataSources: ['polygon'], // Force it to try Polygon
          timeout: 5000
        }
      })
    })

    const stockResult = await stockResponse.json()
    console.log(`   📊 Stock selection response status: ${stockResponse.status}`)

    if (stockResult.error) {
      console.log(`   🔹 Error message: "${stockResult.error}"`)
    }

    if (stockResult.dataSources) {
      console.log(`   🔹 Data sources used: ${stockResult.dataSources.map(s => s.id).join(', ')}`)
    }

    if (stockResult.source) {
      console.log(`   🔹 Primary source: ${stockResult.source}`)
    }

    // Check if Polygon was actually blocked
    const polygonBlocked = (
      stockResult.error?.toLowerCase().includes('disabled') ||
      stockResult.error?.toLowerCase().includes('polygon') ||
      (stockResult.dataSources && !stockResult.dataSources.some(s => s.id === 'polygon')) ||
      (stockResult.source && stockResult.source !== 'polygon')
    )

    console.log(`   ${polygonBlocked ? '✅' : '❌'} Polygon blocking: ${polygonBlocked ? 'WORKING' : 'FAILED'}`)

    return {
      success: polygonBlocked,
      response: stockResult
    }

  } catch (error) {
    console.error('❌ Connection blocking test failed:', error)
    return { success: false, error: error.message }
  }
}

async function testReEnabling() {
  console.log('\n🔄 Testing Re-enabling')
  console.log('=' .repeat(50))

  try {
    // Re-enable Polygon
    console.log('1️⃣ Re-enabling Polygon server...')
    const enableResponse = await fetch(`${BASE_URL}/api/admin/server-config/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ serverId: 'polygon' })
    })

    if (!enableResponse.ok) {
      throw new Error(`Failed to re-enable: ${enableResponse.status}`)
    }

    const enableResult = await enableResponse.json()
    console.log(`   ✅ Re-enable result: polygon is now ${enableResult.enabled ? 'ENABLED' : 'DISABLED'}`)

    // Test that connections work again
    console.log('\n2️⃣ Testing that connections work when re-enabled...')
    const stockResponse = await fetch(`${BASE_URL}/api/stocks/select`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        mode: 'single',
        config: {
          symbol: 'AAPL',
          preferredDataSources: ['polygon'],
          timeout: 5000
        }
      })
    })

    const stockResult = await stockResponse.json()

    const polygonWorking = (
      !stockResult.error?.toLowerCase().includes('disabled') &&
      (stockResult.dataSources?.some(s => s.id === 'polygon') || stockResult.source === 'polygon')
    )

    console.log(`   ${polygonWorking ? '✅' : '❌'} Polygon re-enabled: ${polygonWorking ? 'WORKING' : 'FAILED'}`)

    return {
      success: polygonWorking && enableResult.enabled,
      enabled: enableResult.enabled
    }

  } catch (error) {
    console.error('❌ Re-enabling test failed:', error)
    return { success: false, error: error.message }
  }
}

async function runComprehensiveTest() {
  const serverRunning = await checkServerRunning()

  if (!serverRunning) {
    console.log('⚠️  Server not running. Start with: npm run dev')
    console.log('   This test requires the Next.js server to be running.')
    return
  }

  console.log('🧪 COMPREHENSIVE ADMIN TOGGLE TEST')
  console.log('=' .repeat(60))
  console.log('Testing: State persistence, connection blocking, and re-enabling')

  const results = {
    stateManagement: await testToggleStateManagement(),
    connectionBlocking: await testConnectionBlocking(),
    reEnabling: await testReEnabling()
  }

  // Summary
  console.log('\n📊 TEST SUMMARY')
  console.log('=' .repeat(60))

  const tests = [
    { name: 'Toggle State Management', result: results.stateManagement.success },
    { name: 'Connection Blocking', result: results.connectionBlocking.success },
    { name: 'Re-enabling Functionality', result: results.reEnabling.success }
  ]

  tests.forEach(test => {
    console.log(`${test.result ? '✅' : '❌'} ${test.name}: ${test.result ? 'PASSED' : 'FAILED'}`)
  })

  const overallSuccess = tests.every(test => test.result)
  console.log(`\n🏁 OVERALL RESULT: ${overallSuccess ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`)

  if (!overallSuccess) {
    console.log('\n🔍 FAILURE DETAILS:')
    if (!results.stateManagement.success) {
      console.log(`   • State Management: ${results.stateManagement.error || 'State not persisted correctly'}`)
    }
    if (!results.connectionBlocking.success) {
      console.log(`   • Connection Blocking: ${results.connectionBlocking.error || 'Disabled servers still allow connections'}`)
    }
    if (!results.reEnabling.success) {
      console.log(`   • Re-enabling: ${results.reEnabling.error || 'Re-enabled servers not working'}`)
    }
  }

  return overallSuccess
}

runComprehensiveTest()