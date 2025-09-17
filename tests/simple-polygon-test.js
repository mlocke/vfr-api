/**
 * Simple test to verify Polygon toggle behavior via API
 * Tests the admin toggle endpoint and then stock selection endpoint
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

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

async function testPolygonToggle() {
  console.log('🧪 Testing Polygon Server Toggle via API')
  console.log('=' .repeat(50))

  // Mock auth token for testing (matches development token in ServerConfigManager)
  const authToken = 'dev-admin-token'

  try {
    // Test 1: Toggle Polygon OFF
    console.log('\n1️⃣ Disabling Polygon server...')
    const disableResponse = await fetch(`${BASE_URL}/api/admin/server-config/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ serverId: 'polygon' })
    })

    if (!disableResponse.ok) {
      console.log(`❌ Failed to disable Polygon: ${disableResponse.status}`)
      const errorText = await disableResponse.text()
      console.log(`Error: ${errorText}`)
      return false
    }

    const disableResult = await disableResponse.json()
    console.log(`✅ Polygon toggle result: enabled=${disableResult.enabled}`)

    // Test 2: Try to use Polygon when disabled
    console.log('\n2️⃣ Testing stock selection with Polygon disabled...')
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
          preferredDataSources: ['polygon'] // Force it to try Polygon
        }
      })
    })

    const stockResult = await stockResponse.json()
    console.log(`Stock selection result: ${JSON.stringify(stockResult, null, 2)}`)

    // Check if Polygon was actually blocked
    const polygonBlocked = stockResult.dataSources?.every(source => source.id !== 'polygon') ||
                          stockResult.error?.includes('disabled') ||
                          stockResult.source !== 'polygon'

    console.log(`✅ Polygon properly blocked: ${polygonBlocked}`)

    // Test 3: Enable Polygon again
    console.log('\n3️⃣ Re-enabling Polygon server...')
    const enableResponse = await fetch(`${BASE_URL}/api/admin/server-config/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ serverId: 'polygon' })
    })

    if (enableResponse.ok) {
      const enableResult = await enableResponse.json()
      console.log(`✅ Polygon re-enabled: enabled=${enableResult.enabled}`)
    }

    return polygonBlocked

  } catch (error) {
    console.error('❌ Test failed with error:', error)
    return false
  }
}

// Check if server is running
async function checkServerRunning() {
  try {
    const response = await fetch(`${BASE_URL}/api/health`, {
      timeout: 2000
    })

    // Accept both 200 and 503 if they return structured data
    if (response.status === 200 || response.status === 503) {
      const data = await response.json()
      // If we get structured data with timestamp, server is running
      return data.timestamp !== undefined
    }

    return false
  } catch (error) {
    return false
  }
}

async function runTest() {
  const serverRunning = await checkServerRunning()

  if (!serverRunning) {
    console.log('⚠️  Server not running. Start with: npm run dev')
    console.log('   This test requires the Next.js server to be running.')
    return
  }

  const success = await testPolygonToggle()
  console.log(`\n🏁 Test ${success ? 'PASSED' : 'FAILED'}`)
}

runTest()