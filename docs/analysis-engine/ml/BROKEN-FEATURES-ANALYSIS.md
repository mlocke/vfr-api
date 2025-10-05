# Broken Features Analysis - Early Signal Detection Model

**Analysis Date**: 2025-10-04
**Model Version**: v1.0.0
**Current Confidence**: 30.5%
**Target Confidence**: 60-80%

---

## Critical Finding

**20 out of 34 features have 0% importance** - they are returning constant values (likely all zeros) during feature extraction.

### Model is only using 5 features:

| Feature | Importance | Status |
|---------|-----------|--------|
| `earnings_surprise` | 36.7% | ✅ Working |
| `macd_histogram_trend` | 30.0% | ✅ Working |
| `rsi_momentum` | 22.4% | ✅ Working |
| `analyst_coverage_change` | 4.2% | ✅ Working |
| `volume_trend` | 2.1% | ✅ Working |

---

## Dead Features (20 total - All showing 0% importance)

### Category 1: Sentiment Features (3 features - DEAD)
❌ `sentiment_news_delta` - News sentiment change rate
❌ `sentiment_reddit_accel` - Reddit sentiment acceleration
❌ `sentiment_options_shift` - Options flow sentiment shift

**Root Cause**: Not integrated with SentimentAnalysisService
**Fix Location**: `app/services/ml/early-signal/FeatureExtractor.ts`
**Fix Method**:
```typescript
async calculateSentimentNewsDelta(): Promise<number> {
  const sentiment = await this.sentimentService.analyzeSentiment(symbol);
  const historicalSentiment = await this.sentimentService.getHistoricalSentiment(symbol, 7);
  return sentiment.score - historicalSentiment.averageScore;
}
```

---

### Category 2: Social Features (6 features - DEAD)
❌ `social_stocktwits_24h_change` - StockTwits 24h sentiment change
❌ `social_stocktwits_hourly_momentum` - StockTwits hourly momentum
❌ `social_stocktwits_7d_trend` - StockTwits 7-day trend
❌ `social_twitter_24h_change` - Twitter 24h sentiment change
❌ `social_twitter_hourly_momentum` - Twitter hourly momentum
❌ `social_twitter_7d_trend` - Twitter 7-day trend

**Root Cause**: Social media APIs not implemented
**Fix Priority**: **LOW** - Social data less predictive, API costs high
**Recommendation**: Remove from model or use existing Reddit sentiment instead

---

### Category 3: Macroeconomic Features (5 features - DEAD) **HIGH PRIORITY**
❌ `fed_rate_change_30d` - Federal funds rate change
❌ `unemployment_rate_change` - Unemployment rate change
❌ `cpi_inflation_rate` - CPI inflation rate
❌ `gdp_growth_rate` - GDP growth rate
❌ `treasury_yield_10y` - 10-year treasury yield

**Root Cause**: Not calling MacroeconomicAnalysisService methods
**Fix Priority**: **HIGHEST** - Macro data is free (government APIs) and highly predictive
**Fix Location**: `app/services/ml/early-signal/FeatureExtractor.ts`

**Fixes Required**:

```typescript
// 1. Fed Rate Change (30 days)
async calculateFedRateChange30d(): Promise<number> {
  const fredData = await this.macroService.getFederalFundsRate();
  if (!fredData || fredData.length < 2) return 0;

  const latest = fredData[0].value;
  const prev30d = fredData[1].value; // Get rate from 30 days ago
  return latest - prev30d;
}

// 2. Unemployment Rate Change
async calculateUnemploymentRateChange(): Promise<number> {
  const blsData = await this.macroService.getUnemploymentRate();
  if (!blsData || blsData.length < 2) return 0;

  const latest = blsData[0].value;
  const previous = blsData[1].value;
  return latest - previous;
}

// 3. CPI Inflation Rate
async calculateCPIInflationRate(): Promise<number> {
  const cpiData = await this.macroService.getCPIData();
  if (!cpiData || cpiData.length < 12) return 0;

  // Calculate year-over-year inflation
  const latest = cpiData[0].value;
  const yearAgo = cpiData[11].value;
  return ((latest - yearAgo) / yearAgo) * 100;
}

// 4. GDP Growth Rate
async calculateGDPGrowthRate(): Promise<number> {
  const gdpData = await this.macroService.getGDPData();
  if (!gdpData || gdpData.length < 2) return 0;

  const latest = gdpData[0].value;
  const previous = gdpData[1].value;
  return ((latest - previous) / previous) * 100;
}

// 5. Treasury Yield 10Y
async calculateTreasuryYield10y(): Promise<number> {
  const yieldData = await this.macroService.getTreasuryYield('10Y');
  return yieldData?.value || 0;
}
```

**Expected Impact**: +15-20% confidence improvement

---

### Category 4: SEC Features (3 features - DEAD) **HIGH PRIORITY**
❌ `sec_insider_buying_ratio` - Insider buy/sell ratio
❌ `sec_institutional_ownership_change` - Institutional ownership change
❌ `sec_8k_filing_count_30d` - Material event filings count

**Root Cause**: SEC EDGAR API integration not implemented
**Fix Priority**: **HIGH** - Free government data, strong signals
**Fix Location**: `app/services/ml/early-signal/FeatureExtractor.ts`

**Fixes Required**:

```typescript
// 1. Insider Buying Ratio (Form 4 filings)
async calculateInsiderBuyingRatio(): Promise<number> {
  const insiderTrades = await this.edgarService.getInsiderTrades(symbol, 90);
  if (!insiderTrades || insiderTrades.length === 0) return 0;

  const buys = insiderTrades.filter(t => t.transactionType === 'BUY').length;
  const sells = insiderTrades.filter(t => t.transactionType === 'SELL').length;

  if (buys + sells === 0) return 0;
  return buys / (buys + sells); // 0-1 ratio, >0.5 = net buying
}

// 2. Institutional Ownership Change (13F filings)
async calculateInstitutionalOwnershipChange(): Promise<number> {
  const latest13F = await this.edgarService.get13FHoldings(symbol, 'latest');
  const previous13F = await this.edgarService.get13FHoldings(symbol, 'previous');

  if (!latest13F || !previous13F) return 0;

  const latestPercent = latest13F.institutionalOwnershipPercent;
  const previousPercent = previous13F.institutionalOwnershipPercent;

  return latestPercent - previousPercent; // Change in percentage points
}

// 3. 8-K Filing Count (Material events)
async calculate8KFilingCount30d(): Promise<number> {
  const filings = await this.edgarService.get8KFilings(symbol, 30);
  return filings?.length || 0;
}
```

**Expected Impact**: +10-15% confidence improvement

---

### Category 5: Premium Features (4 features - DEAD) **MEDIUM PRIORITY**
❌ `analyst_price_target_change` - Analyst price target change
❌ `earnings_whisper_vs_estimate` - Whisper number vs. estimate
❌ `short_interest_change` - Short interest change
❌ `institutional_ownership_momentum` - Institutional momentum

**Root Cause**: FMP Premium API calls not implemented
**Fix Priority**: **MEDIUM** - Requires FMP API (already have access)
**Fix Location**: `app/services/ml/early-signal/FeatureExtractor.ts`

**Fixes Required**:

```typescript
// 1. Analyst Price Target Change
async calculateAnalystPriceTargetChange(): Promise<number> {
  const targets = await this.fmpService.getAnalystPriceTargets(symbol);
  if (!targets || targets.length < 2) return 0;

  const latest = targets[0].targetPrice;
  const previous = targets[1].targetPrice;
  return ((latest - previous) / previous) * 100;
}

// 2. Earnings Whisper vs Estimate
async calculateEarningsWhisperVsEstimate(): Promise<number> {
  const whisper = await this.fmpService.getEarningsWhisper(symbol);
  const estimate = await this.fmpService.getEarningsEstimate(symbol);

  if (!whisper || !estimate) return 0;
  return ((whisper - estimate) / estimate) * 100;
}

// 3. Short Interest Change
async calculateShortInterestChange(): Promise<number> {
  const shortData = await this.shortInterestService.getShortInterest(symbol);
  if (!shortData || shortData.length < 2) return 0;

  const latest = shortData[0].shortInterestPercent;
  const previous = shortData[1].shortInterestPercent;
  return latest - previous;
}

// 4. Institutional Ownership Momentum
async calculateInstitutionalOwnershipMomentum(): Promise<number> {
  const holdings = await this.institutionalService.getOwnershipHistory(symbol, 90);
  if (!holdings || holdings.length < 3) return 0;

  // Calculate trend: positive = increasing institutional ownership
  const recent = holdings[0].percentOwned;
  const month ago = holdings[1].percentOwned;
  const twoMonthsAgo = holdings[2].percentOwned;

  const recentChange = recent - monthAgo;
  const previousChange = monthAgo - twoMonthsAgo;

  return recentChange - previousChange; // Acceleration
}
```

**Expected Impact**: +5-10% confidence improvement

---

### Category 6: Market Data Features (3 features - DEAD) **MEDIUM PRIORITY**
❌ `options_put_call_ratio_change` - Put/call ratio change
❌ `dividend_yield_change` - Dividend yield change
❌ `market_beta_30d` - 30-day market beta

**Root Cause**: EODHD API calls not fully integrated
**Fix Priority**: **MEDIUM** - Already have EODHD API access
**Fix Location**: `app/services/ml/early-signal/FeatureExtractor.ts`

**Fixes Required**:

```typescript
// 1. Put/Call Ratio Change
async calculatePutCallRatioChange(): Promise<number> {
  const optionsData = await this.optionsService.getOptionsChain(symbol);
  if (!optionsData) return 0;

  const currentRatio = optionsData.putCallRatio;
  const historicalRatio = optionsData.avgPutCallRatio30d;

  return currentRatio - historicalRatio;
}

// 2. Dividend Yield Change
async calculateDividendYieldChange(): Promise<number> {
  const dividends = await this.financialDataService.getDividendHistory(symbol);
  if (!dividends || dividends.length < 2) return 0;

  const currentYield = dividends[0].yield;
  const previousYield = dividends[1].yield;

  return currentYield - previousYield;
}

// 3. Market Beta (30 days)
async calculateMarketBeta30d(): Promise<number> {
  const beta = await this.financialDataService.calculate Beta(symbol, 30);
  return beta || 1.0; // Default to market beta of 1.0
}
```

**Expected Impact**: +3-5% confidence improvement

---

## Priority Fix Order

### Week 1: High-Impact Macro Features (Estimated +15-20% confidence)
1. ✅ Fix `fed_rate_change_30d`
2. ✅ Fix `unemployment_rate_change`
3. ✅ Fix `cpi_inflation_rate`
4. ✅ Fix `gdp_growth_rate`
5. ✅ Fix `treasury_yield_10y`

**Rationale**: Free government APIs, macro data highly predictive of market moves

### Week 2: SEC Features (Estimated +10-15% confidence)
6. ✅ Fix `sec_insider_buying_ratio`
7. ✅ Fix `sec_institutional_ownership_change`
8. ✅ Fix `sec_8k_filing_count_30d`

**Rationale**: Free EDGAR data, strong leading indicators

### Week 3: Sentiment Features (Estimated +5-8% confidence)
9. ✅ Fix `sentiment_news_delta`
10. ⚠️ Fix `sentiment_reddit_accel` (if Reddit API available)
11. ⚠️ Fix `sentiment_options_shift` (if options sentiment working)

**Rationale**: Sentiment drives short-term moves, existing SentimentAnalysisService

### Week 4: Premium & Market Features (Estimated +8-15% confidence)
12. ✅ Fix 4 FMP Premium features
13. ✅ Fix 3 Market data features

**Rationale**: Enhanced signals from premium APIs we already pay for

### Remove: Social Features
14. ❌ Remove 6 StockTwits/Twitter features OR replace with existing Reddit data

**Rationale**: High API costs, low signal, redundant with news sentiment

---

## Expected Cumulative Confidence Improvement

| Phase | Features Fixed | Confidence Gain | Cumulative Confidence |
|-------|----------------|-----------------|----------------------|
| Baseline | 5/34 features | - | 30% |
| Week 1 | +5 macro | +15-20% | 45-50% |
| Week 2 | +3 SEC | +10-15% | 55-65% |
| Week 3 | +3 sentiment | +5-8% | 60-73% |
| Week 4 | +7 premium/market | +8-15% | **68-88%** |

**Realistic Target After 1 Month**: **65-75% confidence**

---

## Implementation Checklist

### Prerequisites
- [x] MacroeconomicAnalysisService implemented
- [ ] EDGARDataService implemented (for SEC features)
- [x] SentimentAnalysisService accessible
- [x] OptionsDataService accessible
- [x] FinancialDataService (FMP) accessible

### Phase 1: Macro Features (Week 1)
- [ ] Add MacroeconomicAnalysisService to FeatureExtractor constructor
- [ ] Implement `calculateFedRateChange30d()`
- [ ] Implement `calculateUnemploymentRateChange()`
- [ ] Implement `calculateCPIInflationRate()`
- [ ] Implement `calculateGDPGrowthRate()`
- [ ] Implement `calculateTreasuryYield10y()`
- [ ] Test with validation script
- [ ] Retrain model
- [ ] Measure confidence improvement

### Phase 2: SEC Features (Week 2)
- [ ] Create/integrate EDGARDataService
- [ ] Implement Form 4 insider trades parsing
- [ ] Implement 13F institutional holdings parsing
- [ ] Implement 8-K filing count
- [ ] Test SEC feature extraction
- [ ] Retrain model
- [ ] Measure confidence improvement

### Phase 3: Sentiment Features (Week 3)
- [ ] Integrate SentimentAnalysisService
- [ ] Implement news sentiment delta calculation
- [ ] Implement Reddit sentiment acceleration
- [ ] Implement options sentiment shift
- [ ] Test sentiment features
- [ ] Retrain model
- [ ] Measure confidence improvement

### Phase 4: Premium Features (Week 4)
- [ ] Implement FMP premium API calls
- [ ] Implement EODHD market data calls
- [ ] Test all premium features
- [ ] Final model retraining
- [ ] Production deployment

---

## Verification Steps

After each phase:

1. **Run validation script**: `npx tsx scripts/ml/validate-feature-extraction.ts`
2. **Check feature statistics**: Verify features are no longer zero
3. **Retrain model**: `python scripts/ml/train-lightgbm.py`
4. **Compare feature importance**: Verify newly added features show >0% importance
5. **Test predictions**: Ensure confidence scores increase
6. **Monitor production**: Track real-world prediction accuracy

---

## Success Criteria

✅ **Primary Goal**: Increase average confidence from 30% to 65-75%
✅ **Secondary Goal**: Activate 15-20 additional features (currently only 5 active)
✅ **Validation**: Feature importance distribution should be more balanced
✅ **Production**: Real-world predictions should be more reliable

---

## Next Steps

1. **Immediate (Today)**:
   - Review this analysis
   - Prioritize which features to fix first
   - Set up MacroeconomicAnalysisService integration

2. **Week 1**:
   - Fix 5 macro features
   - Run validation
   - Retrain and deploy

3. **Ongoing**:
   - Monitor confidence improvements after each phase
   - Adjust priorities based on actual importance gains
   - Document learnings for future model improvements
