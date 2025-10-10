Based on Polygon.io's endpoint capabilities and VFR's current needs, here are the endpoints that will bring the most strategic benefit:

Critical Priority

1. News API (/v2/reference/news - lines 452-486)
- Impact: Directly solves sentiment fusion news extraction blocker (currently 100% missing data)
- Capability: 1000 articles/request, 5-year history, publisher info, insights
- Why Critical: Sentiment Fusion model failed (45.9% accuracy) due to complete lack of news data
- Integration: Replace broken FMP news extraction with Polygon.io endpoint
- Unique Value: Only reliable news source in your stack

## API ENDPOINTS
- Find endpoints for all APIs in docs/api/*-endpoints.md
- 
High Priority

2. Corporate Actions - Splits & Dividends (lines 280-349)
- Impact: Improves ML training data quality and historical analysis accuracy
- Capability: Historical splits with ratios, dividend dates/amounts
- Why Important: Price adjustments affect all ML model training data
- Integration: Add to data pipeline for ML dataset preparation
- Unique Value: Not currently tracked in VFR

3. Daily Open/Close with Extended Hours (lines 124-156)
- Impact: Adds pre-market and after-hours price data (lines 148-149)
- Capability: preMarket and afterHours pricing not available from FMP
- Why Important: Captures overnight events and earnings reactions
- Integration: Enhance existing price data collection
- Unique Value: Extended hours data unavailable elsewhere

4. Pre-Calculated Technical Indicators (SMA/EMA/MACD/RSI, lines 353-447)
- Impact: Offload computation to Polygon.io, validate existing calculations
- Capability: Server-side indicator calculation with configurable windows
- Why Important: Reduces compute load, provides validation source
- Integration: Replace or cross-validate current manual calculations
- Unique Value: Pre-calculated vs manual computation

Medium Priority

5. Market Snapshots - Gainers/Losers (lines 189-216)
- Impact: Enables market overview and sector analysis features
- Capability: Top 20 gainers/losers with 10K+ volume filter
- Why Important: Market context for individual stock analysis
- Integration: New feature - market movers identification
- Unique Value: Bulk market data not in current VFR

6. Aggregate Bars (lines 92-121)
- Impact: Redundant with FMP but unlimited calls vs FMP rate limits
- Capability: OHLC data, 50K record limit, 5-year history
- Why Important: Failover/validation for FMP data
- Integration: Add as secondary source with failover logic
- Unique Value: Unlimited calls (FMP limited to 300/min)

Recommended Integration Order:
1. News API - Unblock sentiment fusion (CRITICAL)
2. Corporate Actions - Fix ML training data quality
3. Extended Hours Data - Add new capability with minimal effort
4. Technical Indicators - Optimize existing analysis

### OTHER NOTES
- Replace FMP news extraction with Polygon.io News API or where similar data is rate limited or missing.
- Supplement FMP data with Polygon.io endpoints for redundancy and validation.
- Supplement EODHD options data with Polygon.io if needed.
- Should be just as eaisly integrated into the existing architecture as FMP and EODHD.
The News API alone justifies the $29/mo subscription by solving your sentiment fusion blocker.