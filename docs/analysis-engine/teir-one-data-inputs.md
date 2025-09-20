### TIER 1 (Essential - Start Here):

- Real-time price/volume data
- Basic fundamental ratios
- Options put/call ratios
- VIX and major indices
- Treasury rates
- Analyst ratings/targets

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

     - typescript// Recommended data collection priority
     <code>
     `const priceDataSources = [
     'polygon',      // Primary - best quality
     'twelveData',   // Secondary - good rate limits  
     'fmp',          // Tertiary - has historical
     'yahoo'         // Emergency fallback
     ];`</code>