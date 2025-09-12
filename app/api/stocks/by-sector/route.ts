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
        // Try MCP-enhanced stock selection first
        symbols = await getMCPEnhancedStocks(sector as string)
        
        if (symbols.length === 0) {
          // Fallback to curated list
          symbols = await getCuratedSectorStocks(sector as string)
          console.log(`📋 Using curated stocks for ${sector}`)
        }
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
        cached: false,
        source: symbols.length > 0 ? 'mcp' : 'curated'
      })

    } catch (mcpError) {
      console.log(`⚠️ MCP error for ${sector}:`, mcpError)
      
      // Fallback to curated symbols
      const fallbackSymbols = await getCuratedSectorStocks(sector)
      
      return NextResponse.json({ 
        success: true, 
        symbols: fallbackSymbols,
        fallback: true,
        message: 'Using curated symbols - MCP temporarily unavailable'
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

// MCP-enhanced stock selection using Polygon data
async function getMCPEnhancedStocks(sector: string): Promise<SymbolData[]> {
  try {
    console.log(`🔌 Attempting MCP integration for ${sector} sector`)
    
    // TODO: This would integrate with actual Polygon MCP
    // For now, return enhanced curated lists with better filtering
    
    // Simulate MCP processing delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    const mcpEnhancedStocks = await getEnhancedSectorStocks(sector)
    
    if (mcpEnhancedStocks.length > 0) {
      console.log(`🚀 MCP enhanced selection: ${mcpEnhancedStocks.length} stocks for ${sector}`)
      return mcpEnhancedStocks
    }
    
    return []
  } catch (error) {
    console.log(`⚠️ MCP integration failed for ${sector}:`, error)
    return []
  }
}

// Enhanced sector stocks with better curation and filtering
async function getEnhancedSectorStocks(sector: string): Promise<SymbolData[]> {
  const enhancedSectorStocks = {
    'technology': [
      // Mega-cap tech (MCP would filter by market cap > $500B)
      { proName: 'NASDAQ:AAPL', title: 'Apple Inc. - Consumer Electronics' },
      { proName: 'NASDAQ:MSFT', title: 'Microsoft Corp. - Cloud Computing' },
      { proName: 'NASDAQ:GOOGL', title: 'Alphabet Inc. - Search & AI' },
      { proName: 'NASDAQ:AMZN', title: 'Amazon.com - E-commerce & Cloud' },
      { proName: 'NASDAQ:META', title: 'Meta Platforms - Social Media' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla Inc. - Electric Vehicles' },
      { proName: 'NASDAQ:NVDA', title: 'NVIDIA Corp. - AI Chips' },
      
      // Large-cap tech (MCP would filter by volume and volatility)
      { proName: 'NASDAQ:NFLX', title: 'Netflix Inc. - Streaming' },
      { proName: 'NYSE:CRM', title: 'Salesforce Inc. - Enterprise Software' },
      { proName: 'NASDAQ:ADBE', title: 'Adobe Inc. - Creative Software' },
      { proName: 'NASDAQ:INTC', title: 'Intel Corp. - Semiconductors' },
      { proName: 'NASDAQ:AMD', title: 'AMD - Semiconductors' },
      
      // Growth tech (MCP would add based on sector trends)
      { proName: 'NASDAQ:SNOW', title: 'Snowflake - Cloud Data' },
      { proName: 'NASDAQ:ZM', title: 'Zoom Communications' },
      { proName: 'NYSE:PLTR', title: 'Palantir Technologies' }
    ],
    'healthcare': [
      // Pharma giants
      { proName: 'NYSE:JNJ', title: 'Johnson & Johnson - Diversified Healthcare' },
      { proName: 'NYSE:PFE', title: 'Pfizer Inc. - Pharmaceuticals' },
      { proName: 'NYSE:UNH', title: 'UnitedHealth Group - Health Insurance' },
      { proName: 'NYSE:MRK', title: 'Merck & Co. - Pharmaceuticals' },
      { proName: 'NYSE:ABT', title: 'Abbott Laboratories - Medical Devices' },
      
      // Biotech leaders
      { proName: 'NASDAQ:GILD', title: 'Gilead Sciences - Antiviral Drugs' },
      { proName: 'NASDAQ:AMGN', title: 'Amgen Inc. - Biotechnology' },
      { proName: 'NASDAQ:MRNA', title: 'Moderna Inc. - mRNA Technology' },
      { proName: 'NYSE:BMY', title: 'Bristol Myers Squibb - Oncology' },
      
      // Medical technology
      { proName: 'NYSE:TMO', title: 'Thermo Fisher Scientific - Life Sciences' }
    ],
    'financials': [
      // Major banks
      { proName: 'NYSE:JPM', title: 'JPMorgan Chase - Investment Banking' },
      { proName: 'NYSE:BAC', title: 'Bank of America - Commercial Banking' },
      { proName: 'NYSE:WFC', title: 'Wells Fargo - Consumer Banking' },
      { proName: 'NYSE:C', title: 'Citigroup Inc. - Global Banking' },
      
      // Investment firms
      { proName: 'NYSE:GS', title: 'Goldman Sachs - Investment Banking' },
      { proName: 'NYSE:MS', title: 'Morgan Stanley - Wealth Management' },
      { proName: 'NYSE:BLK', title: 'BlackRock - Asset Management' },
      
      // Payment processors
      { proName: 'NYSE:V', title: 'Visa Inc. - Payment Processing' },
      { proName: 'NYSE:MA', title: 'Mastercard Inc. - Payment Technology' },
      { proName: 'NYSE:AXP', title: 'American Express - Financial Services' }
    ],
    'energy': [
      // Oil majors
      { proName: 'NYSE:XOM', title: 'Exxon Mobil - Integrated Oil' },
      { proName: 'NYSE:CVX', title: 'Chevron Corp. - Integrated Oil' },
      { proName: 'NYSE:COP', title: 'ConocoPhillips - Oil & Gas E&P' },
      
      // Energy services
      { proName: 'NYSE:SLB', title: 'Schlumberger - Oilfield Services' },
      { proName: 'NYSE:HAL', title: 'Halliburton - Oilfield Services' },
      
      // Renewables & utilities
      { proName: 'NYSE:NEE', title: 'NextEra Energy - Renewable Power' },
      { proName: 'NYSE:DUK', title: 'Duke Energy - Electric Utility' }
    ],
    'consumer-discretionary': [
      // Retail giants
      { proName: 'NYSE:WMT', title: 'Walmart Inc. - Retail' },
      { proName: 'NASDAQ:AMZN', title: 'Amazon.com - E-commerce' },
      { proName: 'NYSE:HD', title: 'Home Depot - Home Improvement' },
      { proName: 'NYSE:LOW', title: 'Lowe\'s Companies - Home Improvement' },
      { proName: 'NYSE:TGT', title: 'Target Corp. - Retail' },
      
      // Automotive
      { proName: 'NYSE:F', title: 'Ford Motor Company - Automotive' },
      { proName: 'NYSE:GM', title: 'General Motors - Automotive' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla Inc. - Electric Vehicles' },
      
      // Apparel & luxury
      { proName: 'NYSE:NKE', title: 'Nike Inc. - Athletic Apparel' },
      { proName: 'NYSE:TJX', title: 'TJX Companies - Discount Retail' },
      
      // Entertainment & media
      { proName: 'NYSE:DIS', title: 'Walt Disney Company - Entertainment' },
      { proName: 'NASDAQ:NFLX', title: 'Netflix Inc. - Streaming' },
      
      // Restaurants
      { proName: 'NYSE:MCD', title: 'McDonald\'s Corp. - Fast Food' },
      { proName: 'NYSE:SBUX', title: 'Starbucks Corp. - Coffee Retail' }
    ],
    'consumer-staples': [
      // Food & beverage giants
      { proName: 'NYSE:KO', title: 'Coca-Cola Company - Beverages' },
      { proName: 'NASDAQ:PEP', title: 'PepsiCo Inc. - Food & Beverages' },
      { proName: 'NYSE:PG', title: 'Procter & Gamble - Consumer Products' },
      { proName: 'NYSE:UL', title: 'Unilever PLC - Consumer Goods' },
      
      // Food producers
      { proName: 'NYSE:KHC', title: 'Kraft Heinz Company - Food Products' },
      { proName: 'NYSE:GIS', title: 'General Mills - Food Products' },
      { proName: 'NYSE:K', title: 'Kellogg Company - Breakfast Foods' },
      { proName: 'NYSE:CPB', title: 'Campbell Soup Company - Food Products' },
      
      // Household products
      { proName: 'NYSE:CL', title: 'Colgate-Palmolive - Household Products' },
      { proName: 'NYSE:KMB', title: 'Kimberly-Clark - Paper Products' },
      
      // Retail staples
      { proName: 'NYSE:WMT', title: 'Walmart Inc. - Staples Retail' },
      { proName: 'NYSE:COST', title: 'Costco Wholesale - Membership Retail' }
    ],
    'industrials': [
      // Aerospace & defense
      { proName: 'NYSE:BA', title: 'Boeing Company - Aerospace' },
      { proName: 'NYSE:LMT', title: 'Lockheed Martin - Defense' },
      { proName: 'NYSE:RTX', title: 'Raytheon Technologies - Aerospace & Defense' },
      { proName: 'NYSE:NOC', title: 'Northrop Grumman - Defense' },
      { proName: 'NYSE:GD', title: 'General Dynamics - Defense' },
      
      // Industrial conglomerates
      { proName: 'NYSE:GE', title: 'General Electric - Industrial Conglomerate' },
      { proName: 'NYSE:HON', title: 'Honeywell International - Diversified Technology' },
      { proName: 'NYSE:MMM', title: '3M Company - Diversified Industrial' },
      { proName: 'NYSE:CAT', title: 'Caterpillar Inc. - Heavy Machinery' },
      { proName: 'NYSE:DE', title: 'Deere & Company - Agricultural Equipment' },
      
      // Transportation
      { proName: 'NYSE:UPS', title: 'United Parcel Service - Package Delivery' },
      { proName: 'NYSE:FDX', title: 'FedEx Corporation - Express Transportation' },
      { proName: 'NYSE:UAL', title: 'United Airlines - Aviation' },
      { proName: 'NYSE:DAL', title: 'Delta Air Lines - Aviation' }
    ],
    'utilities': [
      // Electric utilities
      { proName: 'NYSE:NEE', title: 'NextEra Energy - Renewable Energy' },
      { proName: 'NYSE:DUK', title: 'Duke Energy - Electric Utility' },
      { proName: 'NYSE:SO', title: 'Southern Company - Electric Utility' },
      { proName: 'NYSE:AEP', title: 'American Electric Power - Electric Utility' },
      { proName: 'NYSE:EXC', title: 'Exelon Corporation - Electric Utility' },
      { proName: 'NYSE:XEL', title: 'Xcel Energy - Electric & Gas Utility' },
      
      // Gas utilities
      { proName: 'NYSE:SRE', title: 'Sempra Energy - Gas & Electric Utility' },
      { proName: 'NYSE:PEG', title: 'Public Service Enterprise Group - Gas & Electric' },
      { proName: 'NYSE:ED', title: 'Consolidated Edison - Electric & Gas Utility' },
      
      // Water utilities
      { proName: 'NYSE:AWK', title: 'American Water Works - Water Utility' },
      
      // Multi-utilities
      { proName: 'NYSE:WEC', title: 'WEC Energy Group - Multi-Utility' },
      { proName: 'NYSE:ETR', title: 'Entergy Corporation - Electric Utility' }
    ]
  }
  
  return enhancedSectorStocks[sector as keyof typeof enhancedSectorStocks] || []
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
    ],
    'consumer-discretionary': [
      { proName: 'NYSE:WMT', title: 'Walmart Inc.' },
      { proName: 'NASDAQ:AMZN', title: 'Amazon.com Inc.' },
      { proName: 'NYSE:HD', title: 'Home Depot Inc.' },
      { proName: 'NYSE:LOW', title: 'Lowe\'s Companies Inc.' },
      { proName: 'NYSE:TGT', title: 'Target Corporation' },
      { proName: 'NYSE:F', title: 'Ford Motor Company' },
      { proName: 'NYSE:GM', title: 'General Motors Company' },
      { proName: 'NASDAQ:TSLA', title: 'Tesla Inc.' },
      { proName: 'NYSE:NKE', title: 'Nike Inc.' },
      { proName: 'NYSE:DIS', title: 'Walt Disney Company' }
    ],
    'consumer-staples': [
      { proName: 'NYSE:KO', title: 'Coca-Cola Company' },
      { proName: 'NASDAQ:PEP', title: 'PepsiCo Inc.' },
      { proName: 'NYSE:PG', title: 'Procter & Gamble Co.' },
      { proName: 'NYSE:UL', title: 'Unilever PLC' },
      { proName: 'NYSE:KHC', title: 'Kraft Heinz Company' },
      { proName: 'NYSE:GIS', title: 'General Mills Inc.' },
      { proName: 'NYSE:K', title: 'Kellogg Company' },
      { proName: 'NYSE:CL', title: 'Colgate-Palmolive Company' },
      { proName: 'NYSE:KMB', title: 'Kimberly-Clark Corporation' },
      { proName: 'NYSE:COST', title: 'Costco Wholesale Corporation' }
    ],
    'industrials': [
      { proName: 'NYSE:BA', title: 'Boeing Company' },
      { proName: 'NYSE:LMT', title: 'Lockheed Martin Corporation' },
      { proName: 'NYSE:RTX', title: 'Raytheon Technologies Corporation' },
      { proName: 'NYSE:GE', title: 'General Electric Company' },
      { proName: 'NYSE:HON', title: 'Honeywell International Inc.' },
      { proName: 'NYSE:MMM', title: '3M Company' },
      { proName: 'NYSE:CAT', title: 'Caterpillar Inc.' },
      { proName: 'NYSE:DE', title: 'Deere & Company' },
      { proName: 'NYSE:UPS', title: 'United Parcel Service Inc.' },
      { proName: 'NYSE:FDX', title: 'FedEx Corporation' }
    ],
    'utilities': [
      { proName: 'NYSE:NEE', title: 'NextEra Energy Inc.' },
      { proName: 'NYSE:DUK', title: 'Duke Energy Corporation' },
      { proName: 'NYSE:SO', title: 'Southern Company' },
      { proName: 'NYSE:AEP', title: 'American Electric Power Company' },
      { proName: 'NYSE:EXC', title: 'Exelon Corporation' },
      { proName: 'NYSE:XEL', title: 'Xcel Energy Inc.' },
      { proName: 'NYSE:SRE', title: 'Sempra Energy' },
      { proName: 'NYSE:PEG', title: 'Public Service Enterprise Group' },
      { proName: 'NYSE:ED', title: 'Consolidated Edison Inc.' },
      { proName: 'NYSE:AWK', title: 'American Water Works Company Inc.' }
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