# MCP Dynamic Stock Selection Integration Plan

## Overview

Transform the stock scroller from static predefined lists to intelligent, real-time MCP-powered selections that adapt to market conditions. Each sector selection will display **top 20 stocks/markets** plus the **top 3 most volatile** (either gaining or losing) stocks for maximum relevance and trading opportunity awareness.

## Current State Analysis

### Existing Implementation
- **Static Lists**: Predefined arrays of 10-15 symbols per sector
- **TradingView Integration**: Real-time price data for displayed symbols
- **MCP Infrastructure**: Available but not utilized (Polygon, Alpha Vantage APIs configured)
- **Cache Strategy**: 5-minute basic caching for API responses

### Limitations
- No market condition adaptation
- Missing high-momentum opportunities  
- Static sector compositions
- No volatility-based selections

## Target Architecture: 20 + 3 Formula

### Core Selection Strategy
For each sector/index/ETF selection:

#### Primary Selection (Top 20)
- **Market Cap Leaders**: Top companies by market capitalization
- **Volume Leaders**: Most actively traded stocks
- **Sector Representatives**: Best-in-class companies per sub-sector
- **Index Components**: Actual index constituents (for indices)

#### Volatility Selection (Top 3)
- **Momentum Movers**: Highest % gainers OR highest % losers  
- **Volume Surge**: Stocks with unusual volume spikes
- **News Catalysts**: Stocks moving on breaking news/earnings

### Implementation Phases

## Phase 1: MCP Foundation Layer (4-6 hours)

### 1.1 MCP Service Integration
```typescript
// New MCP service layer
class MCPStockSelector {
  async getTopStocks(sector: string): Promise<SymbolData[]> {
    const [top20, volatile3] = await Promise.all([
      this.getTop20Stocks(sector),
      this.getTop3Volatile(sector)
    ])
    return [...top20, ...volatile3]
  }
  
  async getTop20Stocks(sector: string): Promise<SymbolData[]> {
    // Use Polygon MCP for sector filtering
    const tickers = await mcp__polygon__list_tickers({
      market: 'stocks',
      active: true,
      sector: this.mapSectorToPolygon(sector),
      limit: 50 // Get more to filter intelligently
    })
    
    // Filter and rank by market cap + volume
    return this.rankAndFilter(tickers, 20)
  }
  
  async getTop3Volatile(sector: string): Promise<SymbolData[]> {
    // Get real-time snapshots for volatility analysis
    const snapshots = await mcp__polygon__get_snapshot_all('stocks')
    const sectorStocks = this.filterBySector(snapshots, sector)
    
    // Find top movers (gaining OR losing)
    return this.getTopVolatile(sectorStocks, 3)
  }
}
```

### 1.2 Sector-to-MCP Mapping
**Technology Sector**:
- Primary 20: AAPL, MSFT, GOOGL, AMZN, META, NVDA, etc.
- Volatile 3: Today's biggest tech movers (±5%+)

**Healthcare Sector**:
- Primary 20: JNJ, PFE, UNH, MRK, ABBV, etc.
- Volatile 3: Biotech earnings movers, FDA approval reactions

**Energy Sector**:
- Primary 20: XOM, CVX, COP, EOG, etc.  
- Volatile 3: Oil price correlation movers

### 1.3 Dynamic ETF Selection
**Popular ETFs**:
- Primary 20: SPY, QQQ, IWM, VTI, VOO, ARKK, etc.
- Volatile 3: Leveraged ETFs with biggest moves (TQQQ, SOXL, etc.)

## Phase 2: Intelligence Layer (3-4 hours)

### 2.1 Market Condition Adaptation
```typescript
interface MarketConditions {
  volatilityIndex: number    // VIX level
  marketTrend: 'bull' | 'bear' | 'sideways'
  sectorRotation: string[]   // Hot sectors
}

class IntelligentSelector {
  async adaptToMarketConditions(sector: string): Promise<SymbolData[]> {
    const conditions = await this.getMarketConditions()
    
    if (conditions.volatilityIndex > 25) {
      // High volatility: prefer blue chips + defensive
      return this.getDefensiveSelection(sector, 20, 3)
    } else if (conditions.marketTrend === 'bull') {
      // Bull market: growth + momentum focus  
      return this.getGrowthSelection(sector, 20, 3)
    }
    // Standard selection logic
    return this.getBalancedSelection(sector, 20, 3)
  }
}
```

### 2.2 Time-Based Intelligence
- **Pre-Market (4-9:30 AM)**: Focus on earnings movers, overnight news
- **Market Hours (9:30-4 PM)**: Volume-based selections, momentum plays
- **After-Hours (4-8 PM)**: Extended hours movers, tomorrow's setup

### 2.3 Volatility Detection Algorithm
```typescript
interface VolatilityMetrics {
  percentChange: number      // Daily % change
  volumeRatio: number       // Current/average volume  
  priceVelocity: number     // Rate of change acceleration
}

async getTop3Volatile(sectorStocks: StockData[]): Promise<SymbolData[]> {
  return sectorStocks
    .map(stock => ({
      ...stock,
      volatilityScore: this.calculateVolatilityScore(stock)
    }))
    .sort((a, b) => b.volatilityScore - a.volatilityScore)
    .slice(0, 3)
}
```

## Phase 3: Performance Optimization (2-3 hours)

### 3.1 Multi-Tier Caching Strategy
- **L1 Cache**: 30-second volatile stock cache (rapid updates)
- **L2 Cache**: 5-minute sector composition cache  
- **L3 Cache**: 1-hour market condition analysis cache

### 3.2 Intelligent Prefetching
```typescript
// Preload adjacent sectors for faster switching
const adjacentSectors = ['technology', 'healthcare', 'financials']
await Promise.all(
  adjacentSectors.map(sector => this.prefetchSectorData(sector))
)
```

### 3.3 Error Handling & Fallbacks
```typescript
async getStocksWithFallback(sector: string): Promise<SymbolData[]> {
  try {
    // Primary: MCP dynamic selection
    return await this.getMCPSelection(sector)
  } catch (mcpError) {
    console.log('MCP fallback triggered:', mcpError)
    // Secondary: Enhanced static lists
    return await this.getEnhancedStaticSelection(sector)
  } catch (staticError) {
    // Tertiary: Basic fallback
    return this.getBasicFallback(sector)
  }
}
```

## Recommended MCP Strategy (Based on Available Infrastructure)

### **Primary**: Polygon MCP (✅ TESTED & WORKING)
**Capabilities Confirmed:**
- ✅ `mcp__polygon__list_tickers` - Sector stock discovery with filtering
- ✅ `mcp__polygon__get_ticker_details` - Market cap data (perfect for top 20 ranking)
- ⚠️ `mcp__polygon__get_snapshot_all` - Real-time data (requires paid plan)

**Usage Strategy:**
```typescript
// 1. Get sector stocks with market cap data
const tickers = await mcp__polygon__list_tickers({
  active: true,
  market: 'stocks',
  limit: 200,  // Get large pool to filter
  search: sectorKeywords  // Filter by sector
})

// 2. Get detailed market cap for ranking  
const details = await Promise.all(
  tickers.map(t => mcp__polygon__get_ticker_details(t.ticker))
)

// 3. Rank by market cap for top 20
const top20 = details
  .filter(d => d.market_cap > 1_000_000_000) // $1B+ only
  .sort((a,b) => b.market_cap - a.market_cap)
  .slice(0, 20)
```

### **Secondary**: Yahoo Finance MCP (✅ FREE & OPERATIONAL) 
**Best for volatility detection:**
- Yahoo Finance MCP provides free historical and real-time price data
- Can calculate daily % changes for volatility ranking
- No API limits - perfect for frequent updates

### **Tertiary**: Alpha Vantage MCP (✅ OPERATIONAL)
**Intelligence Layer:**
- 79 tools available for advanced analysis
- Technical indicators for sophisticated volatility detection
- Sector performance analysis

### **Enhanced Intelligence**: Your Custom Government MCPs
**Strategic Data:**
- **SEC EDGAR MCP**: Institutional holdings for "smart money" tracking
- **Data.gov MCP**: Economic indicators affecting sectors

## Expected Outcomes

### Performance Metrics
- **Response Time**: <200ms with L1 cache hits
- **Data Freshness**: Volatile stocks updated every 30 seconds
- **Accuracy**: 99%+ valid TradingView symbols
- **Relevance**: Always show current market leaders + momentum plays

### User Experience Impact
- **Dynamic Adaptation**: Scroller reflects real market conditions
- **Trading Opportunities**: Volatile 3 highlight potential trades
- **Market Awareness**: Users see both stability (top 20) and opportunity (volatile 3)
- **Sector Intelligence**: True sector representatives, not static lists

### Technical Benefits
- **Scalability**: MCP architecture supports additional data sources
- **Maintainability**: Centralized selection logic, no manual list updates
- **Extensibility**: Easy to add new selection algorithms
- **Reliability**: Multi-tier fallback ensures 100% uptime

## Risk Mitigation

### Data Quality Assurance
- **Symbol Validation**: Verify all symbols exist in TradingView
- **Market Hour Awareness**: Handle pre/post market data appropriately  
- **Volume Filters**: Exclude illiquid stocks (volume < 100K shares)
- **Market Cap Thresholds**: Minimum $1B market cap for top 20

### Performance Safeguards
- **Circuit Breakers**: Fallback if MCP response > 500ms
- **Rate Limiting**: Respect API quotas and limits
- **Graceful Degradation**: Always return valid stock list
- **Monitoring**: Track success rates and performance metrics

This architecture transforms the stock scroller into an intelligent, market-responsive tool that provides both stability (top 20 established stocks) and opportunity awareness (top 3 volatile movers) for each sector selection.