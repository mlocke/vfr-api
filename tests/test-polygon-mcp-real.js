/**
 * Test real Polygon MCP integration with toggle functionality
 * This tests the actual MCP polygon tools when server is enabled/disabled
 */

const { createPage, closePage, listPages } = require('playwright')

async function testRealPolygonMCP() {
  console.log('🧪 Testing Real Polygon MCP with Toggle')
  console.log('=' .repeat(50))

  try {
    // Create a browser page for testing
    const page = await createPage()
    await page.goto('http://localhost:3000')

    console.log('1️⃣ Testing with real MCP polygon tools...')

    // Test the real MCP polygon functions directly
    const testCases = [
      {
        name: 'mcp__polygon__list_tickers',
        args: { limit: 5 }
      },
      {
        name: 'mcp__polygon__get_ticker_details',
        args: { ticker: 'AAPL' }
      },
      {
        name: 'mcp__polygon__get_aggs',
        args: {
          ticker: 'AAPL',
          multiplier: 1,
          timespan: 'day',
          from_: '2024-01-01',
          to: '2024-01-02'
        }
      }
    ]

    // Test when Polygon is enabled
    console.log('\n2️⃣ Testing Polygon MCP tools when enabled...')
    for (const testCase of testCases) {
      try {
        console.log(`Testing ${testCase.name}...`)

        // Call the MCP function directly through the page context
        const result = await page.evaluate(async (funcName, args) => {
          // Try to access the MCP client
          if (window.mcpClient) {
            return await window.mcpClient.executeTool(funcName, args, {
              preferredServer: 'polygon',
              timeout: 10000
            })
          }
          return { error: 'MCP client not available' }
        }, testCase.name, testCase.args)

        if (result.success) {
          console.log(`✅ ${testCase.name}: SUCCESS`)
        } else {
          console.log(`⚠️  ${testCase.name}: ${result.error}`)
        }
      } catch (error) {
        console.log(`❌ ${testCase.name}: Exception - ${error.message}`)
      }
    }

    // Navigate to admin and disable Polygon
    console.log('\n3️⃣ Disabling Polygon server...')
    await page.goto('http://localhost:3000/admin')
    await page.waitForTimeout(2000)

    // Find and click Polygon toggle
    const polygonToggle = await page.$('[aria-label*="Polygon"]')
    if (polygonToggle) {
      await polygonToggle.click()
      await page.waitForTimeout(1000)
      console.log('✅ Polygon server disabled')
    } else {
      console.log('⚠️  Could not find Polygon toggle')
    }

    // Test when Polygon is disabled
    console.log('\n4️⃣ Testing Polygon MCP tools when disabled...')
    for (const testCase of testCases) {
      try {
        console.log(`Testing ${testCase.name} (should fail)...`)

        const result = await page.evaluate(async (funcName, args) => {
          if (window.mcpClient) {
            return await window.mcpClient.executeTool(funcName, args, {
              preferredServer: 'polygon',
              timeout: 5000
            })
          }
          return { error: 'MCP client not available' }
        }, testCase.name, testCase.args)

        if (result.success) {
          console.log(`❌ ${testCase.name}: SECURITY ISSUE - Should have been blocked!`)
        } else if (result.error && result.error.includes('disabled')) {
          console.log(`✅ ${testCase.name}: Correctly blocked (${result.error})`)
        } else {
          console.log(`⚠️  ${testCase.name}: Failed with: ${result.error}`)
        }
      } catch (error) {
        console.log(`❌ ${testCase.name}: Exception - ${error.message}`)
      }
    }

    // Re-enable Polygon
    console.log('\n5️⃣ Re-enabling Polygon server...')
    const polygonToggleAgain = await page.$('[aria-label*="Polygon"]')
    if (polygonToggleAgain) {
      await polygonToggleAgain.click()
      await page.waitForTimeout(1000)
      console.log('✅ Polygon server re-enabled')
    }

    // Close the test page
    await closePage(page)

    console.log('\n🏁 Real Polygon MCP test completed')
    return true

  } catch (error) {
    console.error('❌ Test failed:', error)
    return false
  }
}

// Alternative approach using Claude Code's MCP tools directly
async function testDirectMCPCalls() {
  console.log('\n🔧 Testing Direct MCP Calls...')

  try {
    // Test direct MCP function calls (available in Claude Code environment)
    console.log('Testing mcp__polygon__list_tickers...')

    // This should work if we're in Claude Code environment
    if (typeof mcp__polygon__list_tickers !== 'undefined') {
      const result = await mcp__polygon__list_tickers({ limit: 3 })
      console.log('✅ Direct MCP call successful:', result)
      return true
    } else {
      console.log('⚠️  Direct MCP functions not available in this environment')
      return false
    }
  } catch (error) {
    console.log('❌ Direct MCP test failed:', error)
    return false
  }
}

// Run the tests
async function runTests() {
  console.log('🚀 Starting Polygon MCP Toggle Tests')

  // Try direct MCP calls first
  const directSuccess = await testDirectMCPCalls()

  if (!directSuccess) {
    // Fall back to browser-based testing
    const browserSuccess = await testRealPolygonMCP()

    if (!browserSuccess) {
      console.log('\n📝 Test Notes:')
      console.log('- Ensure Next.js server is running (npm run dev)')
      console.log('- Real MCP polygon tools should be available')
      console.log('- Admin toggle should work properly')
    }
  }
}

runTests()