/**
 * Test script to verify Polygon server toggle behavior
 * Tests that when Polygon is disabled, all attempts to use it are blocked
 */

import { MCPClient } from '../app/services/mcp/MCPClient'
import { serverConfigManager } from '../app/services/admin/ServerConfigManager'

// Fix Node.js module issues for testing
declare global {
  var require: any
}

async function testPolygonToggleBehavior() {
  console.log('🧪 Testing Polygon Server Toggle Behavior')
  console.log('=' .repeat(50))

  const mcpClient = MCPClient.getInstance()

  // Test 1: Check initial state
  console.log('\n1️⃣ Checking initial Polygon server state...')
  const initialEnabled = serverConfigManager.isServerEnabled('polygon')
  console.log(`Initial Polygon enabled state: ${initialEnabled}`)

  // Test 2: Ensure Polygon is enabled and test normal operation
  console.log('\n2️⃣ Testing Polygon when enabled...')
  if (!initialEnabled) {
    console.log('Enabling Polygon for test...')
    await serverConfigManager.toggleServer('polygon')
  }

  try {
    const enabledResult = await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
      preferredServer: 'polygon',
      timeout: 5000
    })
    console.log(`✅ Polygon enabled test: ${enabledResult.success ? 'SUCCESS' : 'FAILED'}`)
    if (!enabledResult.success) {
      console.log(`   Error: ${enabledResult.error}`)
    }
  } catch (error) {
    console.log(`❌ Polygon enabled test failed with exception: ${error}`)
  }

  // Test 3: Disable Polygon and verify all requests are blocked
  console.log('\n3️⃣ Testing Polygon when disabled...')
  console.log('Disabling Polygon...')
  const toggleResult = await serverConfigManager.toggleServer('polygon')
  console.log(`Toggle result: ${toggleResult.success}, enabled: ${toggleResult.enabled}`)

  // Verify disabled state
  const disabledState = serverConfigManager.isServerEnabled('polygon')
  console.log(`Confirmed Polygon disabled: ${!disabledState}`)

  // Test multiple tool calls when disabled - ALL should fail
  const testTools = [
    { tool: 'get_ticker_details', params: { ticker: 'AAPL' } },
    { tool: 'list_tickers', params: {} },
    { tool: 'get_aggs', params: { ticker: 'AAPL', multiplier: 1, timespan: 'day', from: '2024-01-01', to: '2024-01-02' } }
  ]

  let allBlockedCount = 0
  for (const test of testTools) {
    try {
      const result = await mcpClient.executeTool(test.tool, test.params, {
        preferredServer: 'polygon',
        timeout: 2000
      })

      if (!result.success && result.error?.includes('disabled')) {
        console.log(`✅ ${test.tool}: Correctly blocked (${result.error})`)
        allBlockedCount++
      } else if (result.success) {
        console.log(`❌ ${test.tool}: SECURITY ISSUE - Request succeeded when server disabled!`)
        console.log(`   Result: ${JSON.stringify(result, null, 2)}`)
      } else {
        console.log(`⚠️  ${test.tool}: Failed for different reason: ${result.error}`)
      }
    } catch (error) {
      console.log(`❌ ${test.tool}: Exception thrown: ${error}`)
    }
  }

  // Test 4: Test fallback behavior
  console.log('\n4️⃣ Testing fallback behavior when Polygon disabled...')
  try {
    const fallbackResult = await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
      // Don't specify preferredServer, let it choose automatically
      timeout: 5000
    })
    console.log(`✅ Fallback test: ${fallbackResult.success ? 'SUCCESS' : 'FAILED'}`)
    if (fallbackResult.success) {
      console.log(`   Used server: ${fallbackResult.source}`)
    } else {
      console.log(`   Error: ${fallbackResult.error}`)
    }
  } catch (error) {
    console.log(`❌ Fallback test failed: ${error}`)
  }

  // Test 5: Re-enable Polygon and verify it works again
  console.log('\n5️⃣ Re-enabling Polygon and testing...')
  const reEnableResult = await serverConfigManager.toggleServer('polygon')
  console.log(`Re-enable result: ${reEnableResult.success}, enabled: ${reEnableResult.enabled}`)

  try {
    const reEnabledResult = await mcpClient.executeTool('get_ticker_details', { ticker: 'AAPL' }, {
      preferredServer: 'polygon',
      timeout: 5000
    })
    console.log(`✅ Polygon re-enabled test: ${reEnabledResult.success ? 'SUCCESS' : 'FAILED'}`)
  } catch (error) {
    console.log(`❌ Polygon re-enabled test failed: ${error}`)
  }

  // Summary
  console.log('\n📊 Test Summary')
  console.log('=' .repeat(30))
  console.log(`Polygon requests blocked when disabled: ${allBlockedCount}/${testTools.length}`)

  if (allBlockedCount === testTools.length) {
    console.log('🎉 SUCCESS: All Polygon requests properly blocked when server disabled!')
  } else {
    console.log('🚨 SECURITY ISSUE: Some Polygon requests bypassed disabled state!')
  }

  return allBlockedCount === testTools.length
}

// Run the test
if (require.main === module) {
  testPolygonToggleBehavior()
    .then(success => {
      console.log(`\n🏁 Test completed: ${success ? 'PASSED' : 'FAILED'}`)
      process.exit(success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error)
      process.exit(1)
    })
}

export { testPolygonToggleBehavior }