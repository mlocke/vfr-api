# EODHD UnicornBay Options API Integration

## Overview

The VFR platform has been enhanced with comprehensive UnicornBay Options API integration, providing institutional-grade options data with 40+ fields per contract. This integration extends the existing EODHDAPI.ts service with advanced options analytics capabilities.

## Key Features

### 🦄 Enhanced Options Data (40+ Fields)

- **Basic Contract Data**: Symbol, strike, expiration, type, volume, open interest
- **Advanced Greeks**: Delta, gamma, theta, vega, rho (complete Greek suite)
- **Volatility Metrics**: Implied volatility, IV change, IV change percentage
- **Liquidity Metrics**: Bid/ask sizes, midpoint, spread, spread percentage
- **Trading Data**: Trade count, last trade time, theoretical price
- **Quality Indicators**: Liquidity scores, bid-ask spread quality, volume quality

### 🚀 Advanced Analytics

#### 1. Options Flow Analysis (`getUnicornBayOptionsFlow`)

- **Purpose**: Track institutional sentiment through options flow
- **Metrics**: Call/put flow, net flow, flow ratios, unusual activity detection
- **Sentiment Analysis**: Automated bullish/bearish/neutral classification
- **Multi-Symbol Support**: Batch processing for portfolio analysis

#### 2. Greeks Risk Management (`getUnicornBayGreeksAnalysis`)

- **Portfolio Greeks**: Aggregated delta, gamma, theta, vega, rho
- **Risk Metrics**: Pin risk, gamma squeeze risk, volatility risk assessment
- **Market Maker Exposure**: Gamma exposure estimates for positioning analysis
- **Expiration Filtering**: Focus analysis on specific expiration cycles

#### 3. Implied Volatility Surface (`getUnicornBayIVSurface`)

- **IV Analysis**: Complete volatility surface across strikes and expirations
- **Market Metrics**: ATM IV, IV rank, term structure analysis
- **Skew Detection**: Put/call skew identification and quantification
- **Moneyness Analysis**: Strike-relative volatility patterns

#### 4. Enhanced Put/Call Ratios (`getUnicornBayPutCallRatio`)

- **Liquidity Filtering**: High-quality contracts only for accurate ratios
- **Enhanced Metadata**: Liquidity scores, contract quality metrics
- **Comparative Analysis**: Standard vs liquidity-filtered ratios

## Architecture Design

### 🏗️ Fallback Strategy

```typescript
Primary: UnicornBay API (40+ fields) → Fallback: Standard EODHD → Error Handling
```

### 🔄 Method Enhancement Pattern

All existing methods (`getOptionsChain`, `getPutCallRatio`) now support:

- **Enhanced Mode** (default): Uses UnicornBay when available
- **Standard Mode**: Forces standard EODHD API
- **Automatic Fallback**: Seamless degradation on UnicornBay unavailability

### 📊 Data Transformation

- **Unified Interface**: UnicornBay data mapped to existing OptionsContract types
- **Extended Fields**: Additional properties added without breaking compatibility
- **Quality Scoring**: Automated liquidity and quality assessment

## Implementation Details

### Core Methods

#### Primary Options Chain

```typescript
async getUnicornBayOptionsChain(symbol: string, options?: {
  expiration?: string
  strikeMin?: number
  strikeMax?: number
  type?: 'call' | 'put'
  compact?: boolean
}): Promise<OptionsChain | null>
```

#### Enhanced Put/Call Ratio

```typescript
async getUnicornBayPutCallRatio(symbol: string): Promise<PutCallRatio | null>
```

#### Options Flow Analysis

```typescript
async getUnicornBayOptionsFlow(symbols: string[], timeframe: '1D' | '5D' | '1M'): Promise<FlowData[] | null>
```

#### Greeks Analysis

```typescript
async getUnicornBayGreeksAnalysis(symbol: string, expirations?: string[]): Promise<GreeksAnalysis | null>
```

#### IV Surface

```typescript
async getUnicornBayIVSurface(symbol: string): Promise<IVSurface | null>
```

### 🛡️ Error Handling & Resilience

- **Timeout Management**: 8-second timeout with 3 retry attempts
- **Graceful Degradation**: Automatic fallback to standard EODHD
- **Comprehensive Logging**: Detailed success/failure tracking
- **Rate Limit Handling**: Built-in rate limit detection and backoff

### 🧪 Availability Testing

Enhanced `checkOptionsAvailability()` method tests:

- Standard EODHD options functionality
- UnicornBay enhanced features
- Advanced analytics capabilities
- Comprehensive feature matrix reporting

## Usage Examples

### Basic Enhanced Options Chain

```typescript
const eodhdAPI = new EODHDAPI(process.env.EODHD_API_KEY);

// Get enhanced options chain with UnicornBay data
const optionsChain = await eodhdAPI.getOptionsChain("AAPL");
if (optionsChain?.source === "eodhd-unicornbay") {
	console.log("Using enhanced UnicornBay data with 40+ fields");
}
```

### Options Flow Analysis

```typescript
// Analyze options flow for multiple symbols
const flowData = await eodhdAPI.getUnicornBayOptionsFlow(["AAPL", "TSLA", "NVDA"]);
flowData?.forEach(({ symbol, flowMetrics }) => {
	console.log(`${symbol}: ${flowMetrics.institutionalSentiment} sentiment`);
	console.log(`Flow Ratio: ${flowMetrics.flowRatio.toFixed(2)}`);
	console.log(`Unusual Activity: ${flowMetrics.unusualActivity}`);
});
```

### Greeks Risk Analysis

```typescript
// Comprehensive Greeks analysis
const greeksAnalysis = await eodhdAPI.getUnicornBayGreeksAnalysis("SPY");
if (greeksAnalysis) {
	const { portfolioGreeks, riskMetrics } = greeksAnalysis;
	console.log(`Net Gamma: ${portfolioGreeks.netGamma}`);
	console.log(`Gamma Squeeze Risk: ${riskMetrics.gammaSqueezeRisk}`);
	console.log(`Volatility Risk: ${riskMetrics.volatilityRisk}`);
}
```

### IV Surface Analysis

```typescript
// Implied volatility surface
const ivSurface = await eodhdAPI.getUnicornBayIVSurface("QQQ");
if (ivSurface) {
	const { marketMetrics } = ivSurface;
	console.log(`ATM IV: ${marketMetrics.atmIV}`);
	console.log(`Term Structure: ${marketMetrics.termStructure}`);
	console.log(`Skew Direction: ${marketMetrics.skewDirection}`);
}
```

## Integration Benefits

### 🎯 For VFR Platform

- **Enhanced Accuracy**: 40+ fields provide superior analysis precision
- **Institutional Intelligence**: Options flow reveals institutional positioning
- **Risk Management**: Comprehensive Greeks analysis for portfolio risk
- **Market Timing**: IV surface analysis for volatility trading opportunities

### 🔧 For Developers

- **Backward Compatibility**: Existing code continues to work unchanged
- **Progressive Enhancement**: Opt-in to advanced features
- **Robust Fallbacks**: Automatic degradation ensures reliability
- **Comprehensive Testing**: Built-in availability and feature testing

### 📈 For Analysis Engine

- **Improved Options Scoring**: Enhanced data feeds better analysis algorithms
- **Sentiment Integration**: Options flow contributes to market sentiment
- **Risk Quantification**: Greeks analysis enables better risk assessment
- **Volatility Intelligence**: IV surface provides volatility regime insights

## Performance Characteristics

### ⚡ Response Times

- **UnicornBay Options Chain**: ~2-3 seconds (enhanced data processing)
- **Options Flow Analysis**: ~1-2 seconds per symbol
- **Greeks Analysis**: ~1-2 seconds
- **IV Surface**: ~2-4 seconds (complex calculations)

### 💾 Caching Strategy

- **TTL**: Options data cached for 2 minutes (development) / 10 minutes (production)
- **Cache Keys**: Symbol-specific with expiration awareness
- **Invalidation**: Automatic cache refresh on market hours

### 🔐 Security & Compliance

- **API Key Management**: Secure EODHD_API_KEY handling
- **Rate Limit Compliance**: Respects EODHD marketplace limits
- **Data Privacy**: No sensitive data logging or storage
- **Error Sanitization**: Secure error handling prevents information disclosure

## Subscription Requirements

### 📋 Prerequisites

1. **EODHD Options Add-on**: Required for base options functionality
2. **UnicornBay Marketplace**: Enhanced features require marketplace subscription
3. **API Rate Limits**: 10 API calls consumed per UnicornBay request

### 💰 Cost Optimization

- **Beta Pricing**: $29.99/month (limited time, normally $39.99)
- **Intelligent Fallbacks**: Reduces API consumption through smart caching
- **Selective Enhancement**: Choose when to use enhanced features vs standard

## Monitoring & Observability

### 📊 Logging

- **Request Tracking**: All UnicornBay requests logged with performance metrics
- **Fallback Monitoring**: Automatic tracking of fallback usage patterns
- **Error Analysis**: Comprehensive error categorization and reporting

### 🎯 Key Metrics

- **Enhancement Rate**: % of requests using UnicornBay vs standard EODHD
- **Feature Utilization**: Usage patterns across advanced analytics features
- **Performance Impact**: Response time comparison between data sources
- **Reliability Score**: Success rate for enhanced vs standard options data

## Future Enhancements

### 🚀 Planned Features

1. **Historical Options Data**: Backtesting capabilities with UnicornBay history
2. **Real-time Streaming**: Live options flow monitoring
3. **Machine Learning Integration**: Options data feeding ML models
4. **Custom Alerts**: Options flow and Greeks-based alert system

### 🔬 Research Applications

- **Volatility Forecasting**: IV surface trend analysis
- **Market Maker Detection**: Flow pattern recognition
- **Sentiment Quantification**: Options-based sentiment scoring
- **Risk Model Enhancement**: Greeks-based portfolio optimization

---

## Summary

The UnicornBay Options API integration represents a significant enhancement to VFR's options analysis capabilities. By providing 40+ fields per contract and advanced analytics, this integration enables institutional-grade options intelligence while maintaining the robust fallback patterns that ensure reliability. The implementation follows VFR's KISS principles with clean interfaces, comprehensive error handling, and progressive enhancement that doesn't break existing functionality.

This integration positions VFR as a leader in retail options analytics, democratizing access to institutional-quality options data and analysis tools.
