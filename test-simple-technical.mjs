import { RedisCache } from './app/services/cache/RedisCache.ts'
import { SimpleTechnicalTestService } from './app/services/admin/SimpleTechnicalTestService.ts'

async function testSimpleTechnical() {
  console.log('🧪 Testing SimpleTechnicalTestService...')

  try {
    const cache = new RedisCache()
    const testService = new SimpleTechnicalTestService(cache)

    console.log('Testing AAPL symbol...')
    const result = await testService.testSymbol('AAPL')

    console.log('✅ Test Result:', {
      symbol: result.symbol,
      success: result.success,
      responseTime: result.responseTime,
      hasIndicators: !!result.indicators,
      error: result.error
    })

    if (result.indicators) {
      console.log('📊 Indicators:', {
        rsi: result.indicators.rsi,
        sma20: result.indicators.sma20,
        volume: result.indicators.volume
      })
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

testSimpleTechnical()