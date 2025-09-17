/**
 * Test: Offline Server Testing Capability
 *
 * This test verifies that servers can be tested regardless of their enabled/disabled state.
 * Only the checkbox selection should control which servers are tested.
 */

const { serverConfigManager } = require('../app/services/admin/ServerConfigManager')

async function testOfflineServerTesting() {
  console.log('🧪 Testing offline server testing capability...')

  try {
    // 1. Disable the polygon server
    console.log('\n1. Disabling polygon server...')
    const disableResult = await serverConfigManager.toggleServer('polygon')
    console.log('   Disable result:', disableResult)

    // 2. Verify server is disabled for production use
    console.log('\n2. Verifying server is disabled for production...')
    const isEnabled = serverConfigManager.isServerEnabled('polygon')
    console.log('   Is polygon enabled for production:', isEnabled)

    if (isEnabled) {
      throw new Error('❌ Expected polygon to be disabled, but it is enabled')
    }

    // 3. Test the disabled server (should work with bypass)
    console.log('\n3. Testing disabled server (should work)...')
    const testResult = await serverConfigManager.testServer('polygon', 'connection')
    console.log('   Test result:', testResult)

    if (!testResult) {
      throw new Error('❌ Expected test to succeed with bypass, but it failed')
    }

    // 4. Re-enable the server
    console.log('\n4. Re-enabling polygon server...')
    const enableResult = await serverConfigManager.toggleServer('polygon')
    console.log('   Enable result:', enableResult)

    console.log('\n✅ All tests passed! Offline servers can be tested.')

    return {
      success: true,
      message: 'Offline server testing works correctly',
      details: {
        disableResult,
        testResult,
        enableResult
      }
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)

    // Cleanup: try to re-enable polygon server
    try {
      await serverConfigManager.toggleServer('polygon')
    } catch (cleanupError) {
      console.error('   Failed to re-enable polygon during cleanup:', cleanupError.message)
    }

    return {
      success: false,
      error: error.message
    }
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testOfflineServerTesting()
    .then(result => {
      console.log('\n📊 Final Result:', result)
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('❌ Unexpected error:', error)
      process.exit(1)
    })
}

module.exports = { testOfflineServerTesting }