### TIER 1 (Essential - Start Here):

- Real-time price/volume data ✅ IMPLEMENTED
- Basic fundamental ratios ✅ IMPLEMENTED
- Options put/call ratios ✅ IMPLEMENTED
- **VIX and major indices** ✅ IMPLEMENTED via MarketIndicesService
- Treasury rates ✅ IMPLEMENTED
- **Analyst ratings/targets** ✅ IMPLEMENTED via Financial Modeling Prep

#### Mapping to Data Sources:
Tier 1 Data Sources Mapping to Your APIs
Based on your implemented APIs, here's exactly where to source each Tier 1 data point:
1. Real-time Price/Volume Data
   - PRIMARY SOURCES (Best Quality):
        - Polygon.io ⭐ - Premium real-time data, excellent for intraday
        - TwelveData - 800 requests/day, good backup source
        - Financial Modeling Prep - Has 1-year historical OHLCV

   - FALLBACK SOURCES:
        - Yahoo Finance - Free but unofficial, good for backup
        - Alpha Vantage - Limited to 25 requests/day (free tier)

     ```typescript
     // Recommended data collection priority
     const priceDataSources = [
     'polygon',      // Primary - best quality
     'twelveData',   // Secondary - good rate limits
     'fmp',          // Tertiary - has historical
     'yahoo'         // Emergency fallback
     ];
     ```

2. **VIX and Major Indices** ✅ IMPLEMENTED
   - **MarketIndicesService** - Internal service aggregating multiple providers

   **IMPLEMENTED FEATURES:**
   - **Core Indices**: VIX, SPY, QQQ, DIA, IWM (Russell 2000)
   - **Sector ETFs**: XLF, XLK, XLE, XLV, XLI, XLC, XLU, XLRE, XLB, XLP, XLY
   - **International**: EFA (Developed Markets), EEM (Emerging Markets)
   - **Market Analysis**: Risk level assessment, sector rotation detection
   - **Provider Fallback**: TwelveData → Polygon → FMP → Yahoo Finance

   ```typescript
   // MarketIndicesService usage
   const marketIndices = new MarketIndicesService();

   // Get VIX for volatility analysis
   const vix = await marketIndices.getVIX();

   // Get comprehensive market data
   const allIndices = await marketIndices.getAllIndices();

   // Get market conditions analysis
   const conditions = await marketIndices.analyzeMarketConditions();
   // Returns: vixLevel, marketTrend, sectorRotation, riskLevel
   ```

   **DATA QUALITY FEATURES:**
   - 1-minute cache TTL for real-time data
   - Automatic provider failover
   - Data quality scoring (0-1)
   - Performance monitoring

3. **Analyst Ratings and Price Targets** ✅ IMPLEMENTED
   - **Primary Source**: Financial Modeling Prep (comprehensive analyst coverage)
   - **Fallback Source**: TwelveData (limited analyst data)

   **IMPLEMENTED FEATURES:**
   - **Consensus Ratings**: Strong Buy/Buy/Hold/Sell/Strong Sell
   - **Price Targets**: Average, high, low targets with upside calculations
   - **Rating Changes**: Recent upgrades/downgrades tracking
   - **Sentiment Scoring**: 1-5 scale based on consensus ratings
   - **Integration**: Analyst-based warnings and opportunities in stock analysis

   ```typescript
   // FinancialModelingPrepAPI analyst methods
   const fmpAPI = new FinancialModelingPrepAPI();

   // Get consensus ratings
   const consensus = await fmpAPI.getAnalystConsensus('AAPL');

   // Get price targets
   const priceTargets = await fmpAPI.getPriceTargets('AAPL');

   // Get recent rating changes
   const ratingChanges = await fmpAPI.getRatingChanges('AAPL');
   ```

   **API ENDPOINTS USED:**
   - `/upgrades-downgrades-consensus` - Rating consensus data
   - `/price-target-consensus` - Average price targets
   - `/price-target-latest-news` - Recent target changes

   **DATA FEATURES:**
   - Daily cache TTL for analyst data
   - Real API integration (no mock data)
   - Upside percentage calculations
   - Type-safe implementations with comprehensive error handling
   - Automatic fallback to TwelveData when FMP unavailable