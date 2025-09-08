# Polygon.io MCP Server Test Summary

**Test Date**: 2025-09-08T10:28:04.602974
**Test Duration**: 17.57s
**Server Version**: 1.13.1
**Protocol Version**: 2024-11-05

## Test Results

- **Success Rate**: 100.0%
- **Tests Passed**: 7/7
- **Average Response Time**: 1.505s
- **Tools Available**: 53
- **Categories Tested**: 5

## Tool Categories

### Market Data (21 tools)
- get_aggs
- list_aggs
- get_grouped_daily_aggs
- get_daily_open_close_agg
- get_previous_close_agg
- ... and 16 more

### Forex/Crypto (1 tools)
- get_real_time_currency_conversion

### Market Status (3 tools)
- get_market_holidays
- get_market_status
- list_futures_market_statuses

### Reference Data (5 tools)
- list_tickers
- get_ticker_details
- get_ticker_types
- list_conditions
- get_exchanges

### News & Fundamentals (5 tools)
- list_ticker_news
- list_stock_financials
- list_ipos
- list_benzinga_earnings
- list_benzinga_news

### Corporate Actions (2 tools)
- list_splits
- list_dividends

### Other (16 tools)
- list_short_interest
- list_short_volume
- list_treasury_yields
- list_inflation
- list_benzinga_analyst_insights
- ... and 11 more

## Individual Test Results

### get_market_status - ✅ PASSED
- **Description**: Market trading status
- **Category**: Market Status
- **Response Time**: 1.505s

### get_last_quote - ✅ PASSED
- **Description**: Latest stock quote - AAPL
- **Category**: Market Data
- **Response Time**: 1.504s

### get_ticker_details - ✅ PASSED
- **Description**: Company details - MSFT
- **Category**: Reference Data
- **Response Time**: 1.505s

### get_previous_close_agg - ✅ PASSED
- **Description**: Previous close - TSLA
- **Category**: Market Data
- **Response Time**: 1.505s

### list_ticker_news - ✅ PASSED
- **Description**: Recent news - GOOGL
- **Category**: News & Fundamentals
- **Response Time**: 1.507s

### get_last_forex_quote - ✅ PASSED
- **Description**: Forex quote - EUR/USD
- **Category**: Forex/Crypto
- **Response Time**: 1.505s

### get_snapshot_direction - ✅ PASSED
- **Description**: Market gainers
- **Category**: Market Data
- **Response Time**: 1.505s

