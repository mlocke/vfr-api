/**
 * Quick verification that our fix doesn't break the server startup
 * and that the toggle functionality is working
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'
const authToken = 'dev-admin-token'

async function quickTest() {
  console.log('🔍 Quick Fix Verification')
  console.log('=' .repeat(40))

  try {
    // 1. Check server is responding
    console.log('1️⃣ Checking server health...')
    const healthResponse = await fetch(`${BASE_URL}/api/health`, { timeout: 3000 })

    if (healthResponse.ok) {
      console.log('   ✅ Server is running')
    } else {
      throw new Error('Server health check failed')
    }

    // 2. Check admin config endpoint
    console.log('2️⃣ Checking admin config endpoint...')
    const configResponse = await fetch(`${BASE_URL}/api/admin/server-config`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    })

    if (configResponse.ok) {
      const config = await configResponse.json()
      console.log('   ✅ Admin config endpoint working')
      console.log(`   📋 Found ${config.servers?.length || 0} servers`)
      console.log(`   📋 Enabled: ${config.enabledServers?.join(', ') || 'none'}`)
    } else {
      throw new Error(`Admin config failed: ${configResponse.status}`)
    }

    // 3. Test toggle endpoint
    console.log('3️⃣ Testing toggle functionality...')
    const toggleResponse = await fetch(`${BASE_URL}/api/admin/server-config/toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ serverId: 'polygon' })
    })

    if (toggleResponse.ok) {
      const toggleResult = await toggleResponse.json()
      console.log('   ✅ Toggle endpoint working')
      console.log(`   🔄 Polygon is now: ${toggleResult.enabled ? 'ENABLED' : 'DISABLED'}`)
    } else {
      const errorText = await toggleResponse.text()
      throw new Error(`Toggle failed: ${toggleResponse.status} - ${errorText}`)
    }

    console.log('\n🎉 All basic functionality working!')
    console.log('💡 Ready for comprehensive testing')

  } catch (error) {
    console.error('❌ Quick test failed:', error.message)
    console.log('\n🔧 Troubleshooting tips:')
    console.log('   • Make sure the server is running: npm run dev')
    console.log('   • Check console for any startup errors')
    console.log('   • Verify admin authentication is working')
  }
}

quickTest()