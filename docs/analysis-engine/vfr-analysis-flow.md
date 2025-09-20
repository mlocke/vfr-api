# VFR Deep Analysis Data Flow Architecture

## User Journey & System Flow

### 1. User Input Stage
```
User enters "AAPL" → Form validation → Symbol normalization → "Deep Analysis" click
```

### 2. Data Collection Orchestration
When user clicks "Deep Analysis", here's what happens:

```typescript
// Main orchestration function
async function performDeepAnalysis(symbol: string) {
  // 1. Initiate loading state
  showLoadingIndicator(`Analyzing ${symbol}...`);
  
  // 2. Trigger parallel data collection
  const dataCollectionPromises = [
    collectTier1Data(symbol),
    checkCacheForRecentData(symbol),
    validateSymbolExists(symbol)
  ];
  
  // 3. Wait for all data collection
  const collectedData = await Promise.allSettled(dataCollectionPromises);
  
  // 4. Pass to analysis engine
  const analysis = await runAnalysisEngine(collectedData);
  
  // 5. Display results
  renderAnalysisResults(analysis);
}
```

## Data Collection Strategy: Multi-Tiered Approach

### Option 1: Real-Time Collection (Recommended for MVP)
**Best for**: Fast user experience, always fresh data

```typescript
async function collectTier1Data(symbol: string) {
  const startTime = Date.now();
  
  // Parallel API calls for speed
  const dataPromises = {
    priceVolume: getPolygonData(symbol),        // ~200ms
    fundamentals: getFMPFundamentals(symbol),   // ~400ms
    options: getOptionsData(symbol),            // ~300ms
    marketIndices: getMarketIndicesService(),   // ~300ms (VIX, SPY, QQQ, sectors)
    treasury: getTreasuryRates(),               // ~100ms (cached daily)
    analyst: getAnalystRatings(symbol)          // ~250ms
  };
  
  // Wait for all with timeout
  const results = await Promise.allSettled(
    Object.values(dataPromises), 
    { timeout: 5000 }
  );
  
  console.log(`Data collection took: ${Date.now() - startTime}ms`);
  return normalizeCollectedData(results);
}
```

### Option 2: Cache-First with Real-Time Updates
**Best for**: Scale, cost optimization

```typescript
async function collectTier1Data(symbol: string) {
  // 1. Check cache first
  const cachedData = await checkDataCache(symbol);
  
  // 2. Determine what needs refreshing
  const staleData = identifyStaleData(cachedData);
  
  // 3. Fetch only stale data
  const freshData = await fetchStaleData(symbol, staleData);
  
  // 4. Merge cached + fresh data
  return mergeCachedAndFreshData(cachedData, freshData);
}
```

## Data Storage Strategy

### Immediate Processing (No Storage)
```typescript
// For MVP - process immediately, no storage
async function processImmediately(symbol: string) {
  const rawData = await collectAllTier1Data(symbol);
  const processedData = await analysisEngine.process(rawData);
  return processedData; // Return directly to frontend
}
```

### Smart Caching Strategy (Recommended)
```typescript
interface DataCacheEntry {
  symbol: string;
  timestamp: Date;
  ttl: number; // Time to live in minutes
  data: {
    priceVolume: PriceVolumeData;
    fundamentals: FundamentalData;
    options: OptionsData;
    // ... other data
  };
}

// Cache rules by data type
const CACHE_RULES = {
  priceVolume: { ttl: 1 },      // 1 minute (real-time)
  fundamentals: { ttl: 1440 },  // 24 hours (daily updates)
  options: { ttl: 15 },         // 15 minutes
  marketIndices: { ttl: 1 },    // 1 minute (VIX, SPY, sectors - real-time)
  treasury: { ttl: 1440 },      // 24 hours
  analyst: { ttl: 720 }         // 12 hours
};
```

## Analysis Engine Integration

### Data Preparation for Analysis
```typescript
interface AnalysisInput {
  symbol: string;
  timestamp: Date;
  tier1Data: {
    currentPrice: number;
    volume: number;
    fundamentalRatios: FundamentalRatios;
    optionsFlow: OptionsData;
    marketContext: MarketContext;
    analystSentiment: AnalystData;
  };
  metadata: {
    dataQuality: number;        // 0-1 confidence score
    sourcesUsed: string[];      // Which APIs provided data
    collectionTime: number;     // Ms to collect
  };
}

async function prepareAnalysisData(rawData: RawTier1Data): Promise<AnalysisInput> {
  return {
    symbol: rawData.symbol,
    timestamp: new Date(),
    tier1Data: {
      currentPrice: rawData.polygon.price,
      volume: rawData.polygon.volume,
      fundamentalRatios: calculateRatios(rawData.fmp.fundamentals),
      optionsFlow: processOptionsData(rawData.polygon.options),
      marketContext: {
        vix: rawData.marketIndices.vix,
        majorIndices: {
          spy: rawData.marketIndices.spy,
          qqq: rawData.marketIndices.qqq,
          dia: rawData.marketIndices.dia,
          iwm: rawData.marketIndices.iwm
        },
        sectorRotation: rawData.marketIndices.sectors,
        marketConditions: rawData.marketIndices.analysis,
        treasuryYield: rawData.treasury.tenYear
      },
      analystSentiment: aggregateAnalystData(rawData.fmp.analyst)
    },
    metadata: {
      dataQuality: calculateDataQuality(rawData),
      sourcesUsed: identifyDataSources(rawData),
      collectionTime: rawData.collectionMetrics.totalTime
    }
  };
}
```

## Recommended Architecture for VFR MVP

### Frontend User Experience
```typescript
// When user clicks "Deep Analysis"
async function onDeepAnalysisClick(symbol: string) {
  try {
    // 1. Immediate feedback
    setAnalysisState('loading');
    updateProgress(0, 'Collecting market data...');
    
    // 2. Start data collection
    const collectedData = await collectTier1Data(symbol);
    updateProgress(50, 'Running analysis...');
    
    // 3. Process through analysis engine
    const analysis = await analysisEngine.analyze(collectedData);
    updateProgress(100, 'Complete!');
    
    // 4. Display results
    setAnalysisState('complete');
    displayAnalysisResults(analysis);
    
  } catch (error) {
    setAnalysisState('error');
    handleAnalysisError(error);
  }
}
```

### Backend API Structure
```typescript
// /api/analysis/:symbol endpoint
app.post('/api/analysis/:symbol', async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // 1. Validate symbol
    if (!isValidSymbol(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    
    // 2. Check rate limits
    await checkRateLimit(req.ip);
    
    // 3. Collect data (with caching)
    const tier1Data = await collectTier1DataWithCache(symbol);
    
    // 4. Run analysis
    const analysis = await analysisEngine.process(tier1Data);
    
    // 5. Return results
    res.json({
      symbol,
      timestamp: new Date(),
      analysis,
      dataQuality: tier1Data.metadata.dataQuality
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Analysis failed', details: error.message });
  }
});
```

## Data Storage Recommendations

### For MVP (Keep It Simple):
**✅ In-Memory Cache**: Redis for recent data (1-60 min TTL)
**✅ No Database**: Process and return immediately
**✅ JSON Format**: Easy to work with, flexible structure

### For Production Scale:
**✅ Time-Series Database**: InfluxDB or TimescaleDB for price data
**✅ Document Store**: MongoDB for analysis results
**✅ Cache Layer**: Redis for hot data
**✅ CDN**: For static market data (indices, treasury rates)

## Key Implementation Points

### 1. Speed is Critical
- Target: < 3 seconds total analysis time
- Parallel API calls reduce collection time from ~1.5s to ~500ms
- Cache frequently requested symbols

### 2. Error Handling
```typescript
// Graceful degradation when APIs fail
if (polygonData.failed) {
  fallbackData = await getTwelveDataPrice(symbol);
}

// Partial analysis if some data missing
const analysis = await analysisEngine.analyze(availableData, { 
  allowPartial: true 
});
```

### 3. User Feedback
- Progressive loading indicators
- Show which data sources are being queried
- Display confidence levels in analysis

### 4. Cost Optimization
- Cache expensive API calls (fundamentals)
- Batch related requests
- Use free tiers intelligently (Yahoo for backup)

## Answer to Your Questions:

**Q: Do we collect all data first before analysis?**
**A: Yes** - Analysis engine needs complete context for accurate insights.

**Q: Do we store as JSON?**
**A: For MVP, yes** - JSON in Redis cache, pass directly to analysis engine.

**Q: Do we put it in database?**
**A: For MVP, no** - Cache only. Database later for user history, backtesting.

The key is starting simple (cache + immediate processing) and evolving to more sophisticated storage as you scale.