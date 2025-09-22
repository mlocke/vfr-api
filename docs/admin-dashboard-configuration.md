# Admin Dashboard Configuration Guide

## Overview

The VFR Admin Dashboard provides comprehensive data source management, real-time testing capabilities, and performance monitoring for all 13+ financial data providers including Reddit WSB Sentiment API.

## Data Source Configuration

### Available Data Sources

The admin dashboard manages the following data source categories:

#### Primary Data Sources
- **Polygon.io**: Real-time market data and fundamentals
- **Alpha Vantage**: Financial data and technical indicators
- **Financial Modeling Prep (FMP)**: Fundamental ratios and financial statements

#### Enhanced Data Sources
- **EODHD**: Extended market data and enhanced fundamental ratios
- **TwelveData**: Alternative market data provider

#### Government & Institutional Sources
- **SEC EDGAR**: 13F institutional holdings and Form 4 insider trading
- **FRED (Federal Reserve)**: Economic indicators and macroeconomic data
- **Bureau of Labor Statistics (BLS)**: Employment and economic statistics
- **Energy Information Administration (EIA)**: Energy sector data

#### Social Sentiment Sources
- **Reddit WSB Sentiment**: Social sentiment analysis from r/wallstreetbets (COMPLETED)

#### Backup Sources
- **Yahoo Finance**: Fallback data provider

## Reddit WSB Sentiment Integration

### Configuration Location

Reddit WSB Sentiment is configured in the admin dashboard under the **Intelligence** category:

```typescript
// Located in app/admin/page.tsx (lines 188-197)
{
  name: 'Reddit',
  category: 'intelligence',
  description: 'Reddit WSB sentiment analysis',
  testEndpoint: '/api/admin/test-data-source',
  healthEndpoint: '/api/admin/data-source-health'
}
```

### Admin Dashboard Features

#### 1. Data Source Selection
- Reddit appears in all admin dashboard data source selection lists
- Available in the main data source switcher component
- Listed under "Intelligence" category alongside other sentiment providers

#### 2. Testing Interface
The admin dashboard provides comprehensive testing for Reddit WSB:

- **Connection Test**: Verifies Reddit API connectivity and authentication
- **Data Test**: Fetches sample WSB sentiment data for validation
- **Performance Test**: Measures response times and success rates using WSB sentiment analysis with rotating symbols ['AAPL', 'TSLA', 'GME', 'NVDA', 'MSFT']

#### 3. Real-time Monitoring
- **Response Times**: Currently averaging ~69ms
- **Success Rates**: Maintaining 100% success rate
- **Error Tracking**: Monitors and logs any API failures or timeouts
- **Rate Limiting**: Tracks usage against Reddit API limits (currently unlimited for WSB data)

### Setup Instructions

#### 1. Environment Configuration

Add Reddit API credentials to your `.env` file:

```bash
# Reddit WSB Sentiment API
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
```

#### 2. Admin Dashboard Access

1. Navigate to `/admin` in your VFR application
2. In development mode, admin access is automatically granted
3. In production, JWT authentication is required

#### 3. Reddit Configuration

1. Locate the "Data Source Management" section
2. Find "Reddit" under the "Intelligence" category
3. Click "Test Connection" to verify Reddit API setup
4. Use "Test Data" to validate sentiment data retrieval
5. Monitor performance metrics in the real-time dashboard

#### 4. Data Source Switching

Reddit can be enabled/disabled via the Data Source Switcher:

1. Click on the data source preference toggle
2. Locate "Reddit" in the provider list
3. Toggle on/off as needed
4. Changes are persistent and stored in `.admin-datasource-states.json`

## Testing and Validation

### Connection Testing

The admin dashboard provides several test types for Reddit WSB:

```typescript
// Test types available in admin interface
testTypes: [
  'connection',    // Basic connectivity test
  'data',         // Sample data retrieval
  'performance',  // Response time benchmarking
  'health'        // Overall API health check
]
```

### Expected Performance Metrics

- **Response Time**: 50-100ms (currently ~69ms average)
- **Success Rate**: >95% (currently 100%)
- **Data Freshness**: Real-time WSB sentiment updates
- **Rate Limits**: No current limits on WSB-specific endpoints

### Sample Test Output

```json
{
  "provider": "Reddit",
  "testType": "data",
  "success": true,
  "responseTime": 69,
  "data": {
    "sentiment": {
      "averageSentiment": 0.45,
      "postCount": 127,
      "commentCount": 856,
      "mentionTrend": "increasing",
      "keywordMatches": 23,
      "confidence": 0.82
    }
  },
  "timestamp": "2024-09-22T10:30:00Z"
}
```

## Troubleshooting

### Common Issues

#### 1. Connection Failures
- **Symptom**: "Reddit connection test failed"
- **Solution**: Verify REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in `.env`
- **Check**: Ensure Reddit API credentials are valid and active

#### 2. Data Retrieval Issues
- **Symptom**: "No Reddit sentiment data available"
- **Solution**: Check Reddit API status and WSB subreddit accessibility
- **Fallback**: Other sentiment sources will automatically be used

#### 3. Performance Degradation
- **Symptom**: Response times >200ms
- **Solution**: Check Reddit API status and network connectivity
- **Monitoring**: Use admin dashboard performance tests to diagnose

#### 4. Admin Dashboard Not Showing Reddit
- **Symptom**: Reddit missing from data source lists
- **Solution**: Verify DataSourceSwitcher.tsx includes Reddit in PROVIDER_NAMES (line 73)
- **Check**: Ensure admin/page.tsx has Reddit configuration (lines 188-197)

### Health Monitoring

The admin dashboard continuously monitors Reddit WSB health:

- **API Availability**: Checks Reddit API endpoints
- **Data Quality**: Validates sentiment data structure and ranges
- **Response Times**: Tracks performance trends
- **Error Rates**: Monitors and alerts on failures

### Performance Optimization

To optimize Reddit WSB sentiment integration:

1. **Caching**: Reddit sentiment data is cached with appropriate TTL
2. **Parallel Processing**: Reddit calls are made in parallel with other data sources
3. **Error Handling**: Graceful fallback when Reddit is unavailable
4. **Rate Limiting**: Respects Reddit API guidelines (currently no limits for WSB)

## Integration Status

### Current Status: COMPLETED ✅

- ✅ Backend Reddit WSB sentiment API fully functional
- ✅ Admin dashboard data source integration complete
- ✅ DataSourceSwitcher.tsx updated with Reddit provider
- ✅ Admin testing interface fully operational
- ✅ Performance monitoring active (~69ms response times)
- ✅ Real-time sentiment data retrieval working
- ✅ Error handling and fallback mechanisms in place
- ✅ **Performance Testing Fixed**: Reddit performance test now properly implemented in admin dashboard (September 2024)

### Recent Technical Improvements

#### Reddit Performance Test Implementation (September 2024)
- **Issue Resolved**: Fixed "Data source 'reddit' is not implemented or recognized" error in admin dashboard performance testing
- **Technical Fix**: Added Reddit to supported data sources array in `/app/api/admin/test-data-sources/route.ts` (line 958)
- **API Integration**: Implemented Reddit API instance creation in performance test switch statement (lines 1003-1005)
- **Test Logic**: Added Reddit-specific performance test using `getWSBSentiment()` with symbol rotation (lines 1046-1062)
- **TypeScript Fixes**: Updated SecurityValidator instantiation to use singleton pattern in RedditAPI.ts
- **Performance Test Symbols**: Tests rotate through ['AAPL', 'TSLA', 'GME', 'NVDA', 'MSFT'] for comprehensive WSB sentiment analysis

### Future Enhancements

1. **Additional Subreddits**: Expand beyond r/wallstreetbets
2. **Sentiment Trending**: Historical sentiment trend analysis
3. **Alert Integration**: Automated alerts for sentiment changes
4. **Advanced Filtering**: Filter by post quality, user reputation
5. **Cross-platform Social**: Integration with Twitter, Discord

The Reddit WSB Sentiment integration is now fully operational within the VFR admin dashboard, providing real-time social sentiment intelligence with enterprise-grade reliability and monitoring capabilities.