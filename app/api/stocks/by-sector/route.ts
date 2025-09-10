import { NextRequest, NextResponse } from 'next/server'

// Sector mapping to filter stocks by industry
const SECTOR_MAPPINGS = {
  // Industry Sectors
  'technology': {
    keywords: ['software', 'technology', 'internet', 'semiconductor', 'computer'],
    exchanges: ['NASDAQ', 'NYSE'],
    limit: 20
  },
  'healthcare': {
    keywords: ['healthcare', 'pharmaceutical', 'biotech', 'medical', 'health'],
    exchanges: ['NASDAQ', 'NYSE'],
    limit: 20
  },
  'financials': {
    keywords: ['bank', 'financial', 'insurance', 'investment', 'credit'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'consumer-discretionary': {
    keywords: ['retail', 'consumer', 'automotive', 'entertainment', 'restaurant'],
    exchanges: ['NASDAQ', 'NYSE'],
    limit: 20
  },
  'consumer-staples': {
    keywords: ['food', 'beverage', 'household', 'consumer', 'staples'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'energy': {
    keywords: ['oil', 'gas', 'energy', 'petroleum', 'renewable'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'industrials': {
    keywords: ['industrial', 'manufacturing', 'aerospace', 'defense', 'machinery'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'utilities': {
    keywords: ['utility', 'electric', 'gas', 'water', 'power'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'materials': {
    keywords: ['mining', 'materials', 'chemicals', 'metals', 'forestry'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'real-estate': {
    keywords: ['real estate', 'REIT', 'property', 'development'],
    exchanges: ['NYSE', 'NASDAQ'],
    limit: 20
  },
  'communication': {
    keywords: ['telecommunication', 'media', 'communication', 'internet', 'wireless'],
    exchanges: ['NASDAQ', 'NYSE'],
    limit: 20
  },
  
  // Market Indices
  'sp500': {
    symbols: ['SPY', 'SPXL', 'SPXS', 'IVV', 'VOO', 'SPLG'],
    exchanges: ['AMEX', 'NASDAQ'],
    limit: 6
  },
  'nasdaq100': {
    symbols: ['QQQ', 'TQQQ', 'SQQQ', 'QQQM', 'PSQ'],
    exchanges: ['NASDAQ', 'AMEX'],
    limit: 5
  },
  'dow30': {
    symbols: ['DIA', 'UDOW', 'SDOW', 'DDM', 'DJP'],
    exchanges: ['AMEX', 'NYSE'],
    limit: 5
  },
  'russell2000': {
    symbols: ['IWM', 'TNA', 'TZA', 'VTWO', 'UWM'],
    exchanges: ['AMEX', 'NASDAQ'],
    limit: 5
  }
}

// Cache to store responses (simple in-memory cache)
const cache = new Map<string, { data: any, timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface SymbolData {
  proName: string
  title: string
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sector = searchParams.get('sector')

    if (!sector || !SECTOR_MAPPINGS[sector as keyof typeof SECTOR_MAPPINGS]) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid sector specified',
        availableSectors: Object.keys(SECTOR_MAPPINGS)
      }, { status: 400 })
    }

    // Check cache first
    const cacheKey = `sector-${sector}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log(`✅ Cache hit for sector: ${sector}`)
      return NextResponse.json({ 
        success: true, 
        symbols: cached.data,
        cached: true 
      })
    }

    const sectorConfig = SECTOR_MAPPINGS[sector as keyof typeof SECTOR_MAPPINGS]
    let symbols: SymbolData[] = []

    try {
      // For indices, use predefined symbols
      if ('symbols' in sectorConfig) {
        symbols = sectorConfig.symbols.map(symbol => ({
          proName: `${sectorConfig.exchanges[0]}:${symbol}`,
          title: `${symbol} - Market Index`
        }))
        
        console.log(`📊 Generated ${symbols.length} index symbols for ${sector}`)
      } else {
        // For sectors, we'll use a curated list since we don't have MCP integration yet
        symbols = await getCuratedSectorStocks(sector as string)
      }

      // Cache the result
      cache.set(cacheKey, {
        data: symbols,
        timestamp: Date.now()
      })

      console.log(`✅ Generated ${symbols.length} symbols for sector: ${sector}`)
      
      return NextResponse.json({ 
        success: true, 
        symbols: symbols.slice(0, sectorConfig.limit),
        sector: sector,
        cached: false
      })

    } catch (mcpError) {
      console.log(`⚠️ MCP integration not yet available, using fallback for ${sector}`)
      
      // Fallback to default symbols for now
      const fallbackSymbols = await getFallbackSymbols(sector)
      
      return NextResponse.json({ 
        success: true, 
        symbols: fallbackSymbols,
        fallback: true,
        message: 'Using curated symbols - MCP integration pending'
      })
    }

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error',
      message: 'Unable to fetch sector data'
    }, { status: 500 })
  }
}

// Curated stock lists by sector (temporary until MCP integration)
async function getCuratedSectorStocks(sector: string): Promise<SymbolData[]> {
  const sectorStocks = {
    'technology': [
      { proName: 'NASDAQ:AAPL', title: 'Apple Inc.' },
      { proName: 'NASDAQ:MSFT', title: 'Microsoft Corporation' },
      { proName: 'NASDAQ:GOOGL', title: 'Alphabet Inc.' },
      { proName: 'NASDAQ:AMZN', title: 'Amazon.com Inc.' },
      { proName: 'NASDAQ:META', title: 'Meta Platforms Inc.' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla Inc.' },
      { proName: 'NASDAQ:NVDA', title: 'NVIDIA Corporation' },
      { proName: 'NASDAQ:NFLX', title: 'Netflix Inc.' },
      { proName: 'NYSE:CRM', title: 'Salesforce Inc.' },
      { proName: 'NYSE:ORCL', title: 'Oracle Corporation' },
      { proName: 'NASDAQ:ADBE', title: 'Adobe Inc.' },
      { proName: 'NASDAQ:INTC', title: 'Intel Corporation' },
      { proName: 'NYSE:IBM', title: 'IBM Corporation' },
      { proName: 'NASDAQ:AMD', title: 'Advanced Micro Devices' },
      { proName: 'NYSE:CSCO', title: 'Cisco Systems Inc.' }
    ],
    'healthcare': [
      { proName: 'NYSE:JNJ', title: 'Johnson & Johnson' },
      { proName: 'NYSE:PFE', title: 'Pfizer Inc.' },
      { proName: 'NASDAQ:MRNA', title: 'Moderna Inc.' },
      { proName: 'NYSE:UNH', title: 'UnitedHealth Group' },
      { proName: 'NYSE:ABT', title: 'Abbott Laboratories' },
      { proName: 'NYSE:TMO', title: 'Thermo Fisher Scientific' },
      { proName: 'NASDAQ:GILD', title: 'Gilead Sciences' },
      { proName: 'NYSE:BMY', title: 'Bristol Myers Squibb' },
      { proName: 'NASDAQ:AMGN', title: 'Amgen Inc.' },
      { proName: 'NYSE:MRK', title: 'Merck & Co.' }
    ],
    'financials': [
      { proName: 'NYSE:JPM', title: 'JPMorgan Chase & Co.' },
      { proName: 'NYSE:BAC', title: 'Bank of America Corp.' },
      { proName: 'NYSE:WFC', title: 'Wells Fargo & Company' },
      { proName: 'NYSE:GS', title: 'Goldman Sachs Group' },
      { proName: 'NYSE:MS', title: 'Morgan Stanley' },
      { proName: 'NYSE:C', title: 'Citigroup Inc.' },
      { proName: 'NYSE:AXP', title: 'American Express Company' },
      { proName: 'NYSE:BLK', title: 'BlackRock Inc.' },
      { proName: 'NYSE:SCHW', title: 'Charles Schwab Corp.' },
      { proName: 'NYSE:USB', title: 'U.S. Bancorp' }
    ],
    'energy': [
      { proName: 'NYSE:XOM', title: 'Exxon Mobil Corporation' },
      { proName: 'NYSE:CVX', title: 'Chevron Corporation' },
      { proName: 'NYSE:COP', title: 'ConocoPhillips' },
      { proName: 'NYSE:EOG', title: 'EOG Resources Inc.' },
      { proName: 'NYSE:SLB', title: 'Schlumberger Limited' },
      { proName: 'NYSE:PSX', title: 'Phillips 66' },
      { proName: 'NYSE:VLO', title: 'Valero Energy Corporation' },
      { proName: 'NYSE:OXY', title: 'Occidental Petroleum' },
      { proName: 'NYSE:HAL', title: 'Halliburton Company' },
      { proName: 'NYSE:BKR', title: 'Baker Hughes Company' }
    ]
  }

  return sectorStocks[sector as keyof typeof sectorStocks] || []
}

// Fallback symbols when all else fails
async function getFallbackSymbols(sector: string): Promise<SymbolData[]> {
  return [
    { proName: 'NASDAQ:AAPL', title: 'Apple Inc.' },
    { proName: 'NASDAQ:MSFT', title: 'Microsoft Corporation' },
    { proName: 'NASDAQ:GOOGL', title: 'Alphabet Inc.' },
    { proName: 'AMEX:SPY', title: 'SPDR S&P 500 ETF' },
    { proName: 'NASDAQ:QQQ', title: 'Invesco QQQ Trust' }
  ]
}