# MCP Dynamic Stock Selection - Implementation TODO

## 🎯 Objective  
**INTEGRATE existing MCP servers** to enable intelligent stock selection displaying **top 20 stocks + top 3 most volatile** for each sector/index/ETF selection.

## ✅ MCP Infrastructure Status

### **Commercial/Private MCP Servers (Already Implemented)**
- **✅ Polygon MCP** - 40+ institutional-grade tools (OPERATIONAL)
- **✅ Alpha Vantage MCP** - 79 AI-optimized tools (OPERATIONAL) 
- **✅ Yahoo Finance MCP** - FREE 10 comprehensive tools (OPERATIONAL)
- **✅ Dappier MCP** - Real-time web intelligence (OPERATIONAL)

### **Government MCP Servers (Already Implemented)**
- **✅ Data.gov MCP** - 5 categories, 20 tools (OPERATIONAL)
- **✅ SEC EDGAR MCP** - Financial filings, 13F holdings (ARCHITECTURE EXISTS)

### **Claude-Available MCP Servers**  
- **✅ Firecrawl MCP** - Web scraping intelligence
- **✅ Context7 MCP** - Documentation access
- **✅ GitHub MCP** - Repository intelligence
- **✅ Better-Playwright MCP** - Browser automation

**Focus**: Integration layer between your extensive existing MCP infrastructure and stock scroller API

## 📋 Implementation Checklist

### Phase 1: Foundation Layer (4-6 hours)

#### 1.1 MCP Service Layer Setup (2 hours)
- [ ] **Create MCPStockSelector Class** `app/services/MCPStockSelector.ts`
  - [ ] Implement `getTopStocks(sector)` - main entry point
  - [ ] Implement `getTop20Stocks(sector)` - market cap/volume leaders  
  - [ ] Implement `getTop3Volatile(sector)` - biggest movers
  - [ ] Add error handling with graceful fallbacks
  - [ ] Test with console logging for debugging

- [ ] **Sector Mapping Configuration** `app/config/sectorMappings.ts`
  - [ ] Map frontend sectors to Polygon sector codes
  - [ ] Define market cap thresholds per sector
  - [ ] Set volume requirements (minimum daily volume)
  - [ ] Create volatility detection parameters

- [ ] **MCP Tool Integration** `app/services/MCPClient.ts`
  ```typescript
  // PRIMARY: Polygon MCP (✅ TESTED & CONFIRMED WORKING)
  - [ ] mcp__polygon__list_tickers (✅ sector filtering - WORKING)
  - [ ] mcp__polygon__get_ticker_details (✅ market cap data - WORKING)
  - [ ] mcp__polygon__get_snapshot_all (⚠️ requires paid plan)
  
  // SECONDARY: Yahoo Finance MCP (✅ FREE & UNLIMITED)
  - [ ] Yahoo Finance price data (for volatility detection)
  - [ ] Yahoo Finance historical data (daily % changes)
  
  // TERTIARY: Alpha Vantage MCP (✅ 79 TOOLS AVAILABLE)
  - [ ] Sector performance analysis
  - [ ] Technical indicators (RSI, Bollinger Bands)
  
  // ENHANCED: Your Government MCPs
  - [ ] SEC EDGAR institutional holdings (when needed)
  - [ ] Data.gov economic indicators (sector impact)
  ```

#### 1.2 API Route Enhancement (1 hour)
- [ ] **Update `/api/stocks/by-sector/route.ts`**
  - [ ] Replace `getMCPEnhancedStocks()` placeholder with real MCP calls
  - [ ] **Implementation Strategy**:
    ```typescript
    // Use your working Polygon MCP for top 20
    async function getTop20Stocks(sector: string) {
      const tickers = await mcp__polygon__list_tickers({
        active: true, market: 'stocks', limit: 200
      })
      
      const details = await Promise.all(
        tickers.results
          .filter(t => matchesSector(t, sector))
          .slice(0, 50)  // Limit API calls
          .map(t => mcp__polygon__get_ticker_details(t.ticker))
      )
      
      return details
        .filter(d => d.market_cap > 1_000_000_000)
        .sort((a,b) => b.market_cap - a.market_cap)
        .slice(0, 20)
    }
    
    // Use Yahoo Finance MCP for volatile 3 (free)
    async function getVolatile3(sector: string) {
      // Get price changes from Yahoo Finance MCP
      // Return top 3 absolute % movers
    }
    ```
  - [ ] Maintain 23-symbol return (20 + 3) for each sector
  - [ ] Add performance logging (response times)
  - [ ] Test with all existing sectors/indices/ETFs

#### 1.3 Volatility Detection Algorithm (1 hour)
- [ ] **Create VolatilityAnalyzer** `app/services/VolatilityAnalyzer.ts`
  ```typescript
  interface VolatilityMetrics {
    percentChange: number      // Daily % change ±5%+
    volumeRatio: number       // Current/50-day avg volume (2x+)
    priceVelocity: number     // Rate of change acceleration
    newsImpact: boolean       // Breaking news catalyst
  }
  ```
  - [ ] Implement `calculateVolatilityScore()` method
  - [ ] Add time-weighted scoring (recent moves count more)
  - [ ] Filter for both gainers AND losers (absolute volatility)
  - [ ] Exclude penny stocks (price < $5)

#### 1.4 Testing & Validation (1 hour)
- [ ] **Unit Tests** `tests/MCPStockSelector.test.ts`
  - [ ] Test sector mapping accuracy
  - [ ] Validate 23-symbol return count
  - [ ] Test fallback mechanisms
  - [ ] Verify TradingView symbol compatibility

- [ ] **Integration Testing**
  - [ ] Test all 11 sectors + 4 indices + 1 ETF category
  - [ ] Verify no duplicate symbols in results  
  - [ ] Test during market hours vs after hours
  - [ ] Load test with rapid sector switching

### Phase 2: Intelligence Layer (3-4 hours)

#### 2.1 Market Condition Intelligence (2 hours)
- [ ] **Create MarketIntelligence Service** `app/services/MarketIntelligence.ts`
  ```typescript
  // Implement market condition detection:
  - [ ] getVolatilityIndex() - VIX level analysis
  - [ ] getMarketTrend() - bull/bear/sideways detection  
  - [ ] getSectorRotation() - identify hot/cold sectors
  - [ ] getMarketHours() - pre/during/post market logic
  ```

- [ ] **Adaptive Selection Logic**
  - [ ] High volatility (VIX > 25): Prefer blue chips + defensive
  - [ ] Bull market: Growth + momentum focus
  - [ ] Bear market: Dividend aristocrats + utilities
  - [ ] Sector rotation: Weight toward momentum sectors

#### 2.2 Time-Based Intelligence (1 hour)  
- [ ] **Pre-Market (4-9:30 AM)**
  - [ ] Focus on earnings announcement movers
  - [ ] Overnight news catalyst stocks
  - [ ] European market correlation plays

- [ ] **Market Hours (9:30-4 PM)**  
  - [ ] Volume-based momentum selections
  - [ ] Intraday breakout candidates
  - [ ] Real-time sector rotation detection

- [ ] **After-Hours (4-8 PM)**
  - [ ] Extended hours volume leaders
  - [ ] Tomorrow's earnings preview
  - [ ] Post-earnings reaction analysis

#### 2.3 Enhanced Sector Logic (1 hour)
- [ ] **Technology Sector Enhancement**
  - [ ] Top 20: FAANG + chip leaders + cloud leaders
  - [ ] Volatile 3: AI hype stocks, semiconductor movers
  - [ ] Sub-sector rotation: Software vs Hardware vs Semiconductors

- [ ] **Healthcare Sector Enhancement**
  - [ ] Top 20: Big pharma + biotech leaders + medtech
  - [ ] Volatile 3: FDA approval reactions, earnings beats/misses
  - [ ] Sub-sector focus: Biotech vs Traditional pharma

- [ ] **ETF Category Enhancement**  
  - [ ] Top 20: Major index ETFs + sector ETFs + thematic ETFs
  - [ ] Volatile 3: Leveraged ETFs (3x bull/bear), volatility products
  - [ ] Smart beta and alternative strategy ETFs

### Phase 3: Performance Optimization (2-3 hours)

#### 3.1 Caching Strategy Implementation (1.5 hours)
- [ ] **Multi-Tier Cache System** `app/services/CacheManager.ts`
  ```typescript
  // Cache tiers:
  - [ ] L1: 30-second volatile stock cache (Redis/memory)
  - [ ] L2: 5-minute sector composition cache  
  - [ ] L3: 1-hour market intelligence cache
  - [ ] L4: Daily static fallback cache
  ```

- [ ] **Cache Invalidation Logic**
  - [ ] Market close: Clear volatile caches
  - [ ] Major news events: Selective cache clearing
  - [ ] Error conditions: Cache warming strategies

#### 3.2 Performance Monitoring (1 hour)
- [ ] **Response Time Tracking**
  - [ ] Target: <200ms with L1 cache hits
  - [ ] Target: <500ms with cold cache  
  - [ ] Alert: >1000ms response times
  - [ ] Fallback: >2000ms triggers static lists

- [ ] **Success Rate Monitoring**  
  - [ ] Track MCP API success rates
  - [ ] Monitor TradingView symbol validation  
  - [ ] Alert on <95% success rates
  - [ ] Dashboard for real-time monitoring

#### 3.3 Error Handling & Fallbacks (0.5 hours)
- [ ] **Graceful Degradation Chain**
  1. Primary: MCP dynamic selection (23 symbols)
  2. Secondary: Enhanced static selection (23 symbols)  
  3. Tertiary: Basic fallback selection (5 symbols)
  4. Emergency: Hardcoded blue chips (SPY, QQQ, etc.)

### Phase 4: Quality Assurance (1-2 hours)

#### 4.1 Data Quality Validation (1 hour)
- [ ] **Symbol Verification Pipeline**
  - [ ] TradingView symbol existence check
  - [ ] Market cap minimum thresholds ($1B for top 20)
  - [ ] Daily volume minimums (100K shares)
  - [ ] Price minimums ($5+ to exclude penny stocks)

- [ ] **Sector Classification Accuracy**
  - [ ] Verify Polygon sector codes match expectations
  - [ ] Cross-reference with manual sector assignments
  - [ ] Handle edge cases (conglomerates, dual-sector companies)

#### 4.2 User Experience Testing (1 hour)
- [ ] **Dropdown Responsiveness**
  - [ ] Test rapid sector switching (<200ms updates)
  - [ ] Verify scroller refreshes correctly
  - [ ] Test during high market volatility periods
  - [ ] Mobile device performance validation

- [ ] **Market Hours Testing**
  - [ ] Pre-market volatility detection
  - [ ] Market close behavior
  - [ ] Weekend/holiday fallback behavior
  - [ ] Extended hours data handling

## 🚀 Implementation Priority Order

### Week 1: Foundation (High Priority)
1. **Day 1-2**: Phase 1.1-1.2 (MCP Service + API Integration)
2. **Day 3**: Phase 1.3-1.4 (Volatility Detection + Testing)

### Week 2: Intelligence (Medium Priority)  
3. **Day 4-5**: Phase 2.1-2.2 (Market Intelligence + Time Logic)
4. **Day 6**: Phase 2.3 (Enhanced Sector Logic)

### Week 3: Optimization (Low Priority)
5. **Day 7-8**: Phase 3.1-3.2 (Caching + Monitoring)
6. **Day 9**: Phase 3.3 + Phase 4 (Error Handling + QA)

## ✅ Success Criteria

### Functional Requirements
- [ ] **23 Symbols Per Selection**: Exactly 20 top stocks + 3 volatile stocks
- [ ] **Real-Time Volatility**: Top 3 reflect current market movers
- [ ] **Sector Accuracy**: Top 20 represent true sector leaders
- [ ] **Performance**: <200ms cached, <500ms uncached response times

### Quality Requirements  
- [ ] **Uptime**: 99.9% availability (fallbacks ensure no failures)
- [ ] **Accuracy**: 100% valid TradingView symbols
- [ ] **Freshness**: Volatile stocks updated every 30 seconds during market hours
- [ ] **Intelligence**: Selections adapt to market conditions within 5 minutes

### User Experience Requirements
- [ ] **Seamless Integration**: No frontend changes required
- [ ] **Performance**: No noticeable slowdown in dropdown/scroller
- [ ] **Relevance**: Users see both stability and opportunity
- [ ] **Market Awareness**: Reflects current market sentiment

## 🔧 Development Commands

```bash
# Development setup
npm run dev                    # Start development server
npm run test:mcp              # Run MCP integration tests
npm run test:volatility       # Test volatility detection
npm run build                 # Production build test

# Testing commands  
npm run test:sectors          # Test all sector selections
npm run test:performance      # Performance benchmarking
npm run test:market-hours     # Market hours behavior testing
npm run test:fallbacks        # Fallback mechanism testing

# Monitoring commands
npm run monitor:response-times # Track API response times
npm run monitor:success-rates  # Track MCP success rates
npm run monitor:cache-hits     # Cache performance monitoring
```

## 📊 Expected Impact

### Before (Static Lists)
- Fixed 10-15 symbols per sector
- No market condition awareness
- Manual updates required
- Missing trading opportunities

### After (MCP Dynamic Selection)
- Intelligent 23 symbols per sector (20 + 3)
- Real-time market adaptation
- Automatic updates every 30 seconds
- Highlights both stability AND opportunity

**Result**: Transform static ticker into intelligent market intelligence tool that adapts to real-time conditions while providing comprehensive sector coverage.