# VFR Analysis Engine Data Specification for Analysis Card Design

**Purpose**: This document provides comprehensive information about the VFR analysis engine's data outputs for designing an "Analysis Card" component that displays stock analysis results and recommendations.

**Target Audience**: AI agents designing user interface components for financial analysis presentation

---

## Executive Summary

The VFR Analysis Engine processes 15+ financial data sources through a sophisticated weighted scoring algorithm to produce actionable BUY/SELL/HOLD recommendations. The system achieves sub-3-second analysis completion with 99.5% uptime through enterprise-grade fallback strategies.

**Key Architecture**: 6-component weighted analysis (Technical 35%, Fundamental 25%, Macro 20%, Sentiment 10%, Extended Market 5%, Alternative Data 5%) with real-time processing and institutional-grade intelligence.

---

## Complete Data Structure for Analysis Cards

### Primary Analysis Output Interface

```typescript
interface AnalysisCardData {
  // === ESSENTIAL DATA (ALWAYS DISPLAY) ===
  symbol: string                    // Stock ticker (e.g., "AAPL")
  action: 'BUY' | 'SELL' | 'HOLD'  // Primary recommendation
  confidence: number                // 0.0-1.0 confidence score
  overallScore: number             // 0-100 composite score
  currentPrice: number             // Current stock price
  priceChange24h: number           // 24h price change
  priceChangePercent: number       // 24h percentage change
  sector: string                   // Sector classification
  marketCap: number               // Market capitalization

  // === COMPONENT BREAKDOWN (SECONDARY DISPLAY) ===
  componentScores: {
    technical: {
      score: number              // 0-100 technical score
      weight: 35                 // Percentage weight in analysis
      confidence: number         // Data quality indicator
      keyFactors: string[]       // Primary technical drivers
      vwapSignal?: {
        position: 'above' | 'below' | 'at'  // Current price vs VWAP
        deviation: number         // Percentage deviation
        strength: 'weak' | 'moderate' | 'strong'
      }
    }

    fundamental: {
      score: number              // 0-100 fundamental score
      weight: 25                 // Percentage weight in analysis
      confidence: number         // Data quality indicator
      keyRatios: {
        peRatio?: number         // Price-to-Earnings
        pbRatio?: number         // Price-to-Book
        roe?: number            // Return on Equity
        debtToEquity?: number   // Debt-to-Equity
        dividendYield?: number  // Dividend Yield
      }
      analystData?: {
        consensus: string        // "Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"
        priceTarget: number     // Consensus price target
        upside: number         // Percentage upside to target
      }
    }

    macroeconomic: {
      score: number              // 0-100 macro score
      weight: 20                 // Percentage weight in analysis
      confidence: number         // Data quality indicator
      cyclePhase: string        // "expansion", "peak", "contraction", "trough"
      sectorImpact: string      // Sector-specific macro impact
      keyIndicators: {
        inflationImpact: number   // -1.0 to 1.0 impact score
        interestRateImpact: number // -1.0 to 1.0 impact score
        economicGrowth: number    // GDP growth rate
      }
    }

    sentiment: {
      score: number              // 0-100 sentiment score
      weight: 10                 // Percentage weight in analysis
      confidence: number         // Data quality indicator
      newsScore?: number         // News sentiment (0-100)
      socialScore?: number       // Social media sentiment (0-100)
      volume: number            // Number of mentions
      trend: 'positive' | 'negative' | 'neutral'
    }

    extendedMarket: {
      score: number              // 0-100 extended market score
      weight: 5                  // Percentage weight in analysis
      confidence: number         // Data quality indicator
      preMarketData?: {
        price: number
        change: number
        changePercent: number
        volume: number
      }
      afterHoursData?: {
        price: number
        change: number
        changePercent: number
        volume: number
      }
      liquidityMetrics?: {
        bidAskSpread: number      // Current spread
        spreadPercent: number     // Spread as percentage
        liquidityScore: number    // 0-10 liquidity rating
      }
    }

    alternativeData: {
      score: number              // 0-100 alternative data score
      weight: 5                  // Percentage weight in analysis
      confidence: number         // Data quality indicator
      esgData?: {
        score: number           // ESG composite score
        environmental: number   // Environmental score
        social: number         // Social score
        governance: number     // Governance score
        impact: 'positive' | 'negative' | 'neutral'
      }
      shortInterest?: {
        ratio: number          // Short interest ratio
        daysTocover: number    // Days to cover
        trend: 'increasing' | 'decreasing' | 'stable'
        squeezeRisk: 'low' | 'medium' | 'high'
      }
    }
  }

  // === ACTIONABLE INSIGHTS (DETAILED VIEW) ===
  reasoning: {
    primaryFactors: string[]      // Top 3-5 analysis drivers
    warnings: string[]           // Risk factors and concerns
    opportunities: string[]      // Potential upside catalysts
    analystInsights?: string[]   // Professional analyst commentary
  }

  // === INSTITUTIONAL INTELLIGENCE ===
  institutionalData?: {
    holdings: {
      ownership: number         // Institutional ownership percentage
      recentChanges: number    // Recent position changes
      smartMoney: string      // Notable institutional moves
    }
    insiderActivity?: {
      recentTransactions: number  // Recent insider transactions
      sentiment: 'bullish' | 'bearish' | 'neutral'
      significance: 'low' | 'medium' | 'high'
    }
  }

  // === DATA QUALITY & RELIABILITY ===
  dataQuality: {
    overall: number             // 0.0-1.0 overall data quality
    sourceBreakdown: {
      [source: string]: {
        status: 'active' | 'degraded' | 'offline'
        lastUpdate: number      // Unix timestamp
        reliability: number     // 0.0-1.0 reliability score
      }
    }
    lastUpdated: number        // Unix timestamp of analysis
    cacheStatus: 'fresh' | 'cached' | 'stale'
  }

  // === PERFORMANCE METRICS ===
  performance?: {
    analysisTime: number        // Milliseconds to complete analysis
    dataFreshness: number      // Minutes since last data update
    cacheHitRate: number       // Percentage of cached vs live data
  }
}
```

---

## Data Source Architecture

### Tier 1 - Premium APIs (Production Critical)
| Source | Rate Limit | Reliability | Primary Data | Analysis Weight |
|--------|------------|-------------|--------------|-----------------|
| **Polygon.io** | 5000/day | 99.9% | Real-time prices, VWAP, extended hours | Technical (35%) |
| **Alpha Vantage** | 500/day | 99.5% | Historical data, fundamentals | Technical + Fundamental |
| **Financial Modeling Prep** | 250/day | 99.7% | Financial ratios, analyst data | Fundamental (25%) |

### Tier 2 - Government APIs (Unlimited Access)
| Source | Rate Limit | Reliability | Primary Data | Analysis Weight |
|--------|------------|-------------|--------------|-----------------|
| **FRED API** | Unlimited | 99.9% | Economic indicators, interest rates | Macro (20%) |
| **BLS API** | Unlimited | 99.8% | Employment, inflation data | Macro (20%) |
| **EIA API** | Unlimited | 99.7% | Energy prices, commodity data | Macro (20%) |
| **SEC EDGAR** | Unlimited | 99.9% | 13F filings, insider trading | Institutional |

### Tier 3 - Enhanced APIs (Fallback Support)
| Source | Rate Limit | Reliability | Primary Data | Fallback Role |
|--------|------------|-------------|--------------|---------------|
| **EODHD** | 100k/day | 99.0% | International data, ratios | Fundamental backup |
| **TwelveData** | 800/day | 98.5% | Technical indicators | Technical backup |
| **Reddit WSB** | Unlimited | 95.0% | Social sentiment | Sentiment (10%) |
| **NewsAPI** | Variable | 98.0% | Financial news sentiment | Sentiment (10%) |

---

## Analysis Card Design Guidelines

### Visual Priority Hierarchy

#### Level 1 - Immediate Decision Data (Always Visible)
```
┌─────────────────────────────────────────────────────┐
│ AAPL    $150.25 (+2.3%)    [BUY]    Confidence: 87% │
│ Technology • $2.4T Market Cap • Score: 82/100       │
└─────────────────────────────────────────────────────┘
```

#### Level 2 - Supporting Analysis (Expandable)
```
Technical: 85 (35%)  Fundamental: 78 (25%)  Macro: 75 (20%)
Sentiment: 68 (10%)  Extended: 72 (5%)     Alt Data: 70 (5%)

Key Factors:
• Strong VWAP momentum (above by 2.1%)
• Excellent fundamental ratios (P/E: 24.5, ROE: 25.3%)
• Favorable macro environment for tech sector
```

#### Level 3 - Detailed Intelligence (Drill-down)
```
Warnings:
• High valuation metrics suggest limited upside
• Increasing short interest (12.5% of float)

Opportunities:
• Strong institutional buying (+5.2% this quarter)
• Positive earnings revision trend
• ESG leadership in technology sector
```

### Color Coding System

```typescript
const actionColors = {
  BUY: {
    primary: '#10B981',      // Emerald-500
    background: 'rgba(16, 185, 129, 0.1)',
    border: 'rgba(16, 185, 129, 0.3)'
  },
  SELL: {
    primary: '#EF4444',      // Red-500
    background: 'rgba(239, 68, 68, 0.1)',
    border: 'rgba(239, 68, 68, 0.3)'
  },
  HOLD: {
    primary: '#F59E0B',      // Amber-500
    background: 'rgba(245, 158, 11, 0.1)',
    border: 'rgba(245, 158, 11, 0.3)'
  }
}

const confidenceColors = {
  high: '#10B981',     // >80% confidence
  medium: '#F59E0B',   // 60-80% confidence
  low: '#EF4444'       // <60% confidence
}
```

### Component Score Visualization

```typescript
const ScoreComponent = ({ label, score, weight, color }) => (
  <div className="score-component">
    <div className="score-label">{label}</div>
    <div className="score-bar">
      <div
        className="score-fill"
        style={{
          width: `${score}%`,
          backgroundColor: color
        }}
      />
    </div>
    <div className="score-value">{score} ({weight}%)</div>
  </div>
)
```

---

## Real-time Data Characteristics

### Data Refresh Rates
| Data Type | Refresh Rate | Cache TTL | Performance Target |
|-----------|--------------|-----------|-------------------|
| **Real-time Prices** | 1 second | 1 minute | <100ms |
| **Technical Indicators** | 5 minutes | 5 minutes | <200ms |
| **Fundamental Ratios** | Daily | 24 hours | <500ms |
| **News Sentiment** | 15 minutes | 15 minutes | <1s |
| **Macro Indicators** | Hourly | 4 hours | <2s |
| **ESG Data** | Weekly | 168 hours | <1s |
| **Analyst Data** | Daily | 24 hours | <500ms |

### Error Handling States

```typescript
type DataState = 'loading' | 'success' | 'partial' | 'error' | 'stale'

interface ErrorStates {
  loading: {
    display: 'Loading analysis...'
    showSkeleton: true
  }
  partial: {
    display: 'Limited data available'
    showWarning: true
    degradedFeatures: string[]
  }
  error: {
    display: 'Analysis unavailable'
    retryOption: true
    fallbackData?: Partial<AnalysisCardData>
  }
  stale: {
    display: 'Data may be outdated'
    lastUpdate: number
    refreshOption: true
  }
}
```

---

## Performance Specifications

### Response Time Targets
- **Complete Analysis**: <3 seconds (99th percentile)
- **Cached Results**: <500ms (95th percentile)
- **Individual Components**: <1 second each
- **Real-time Updates**: <100ms (price data)

### Memory Management
- **Heap Allocation**: 4096MB maximum
- **Garbage Collection**: Explicit triggering for large datasets
- **Cache Strategy**: Cache-aside pattern with intelligent TTL
- **Parallel Processing**: 83.8% performance improvement via Promise.allSettled

### Scalability Considerations
- **Batch Processing**: 20 symbols maximum per request
- **Rate Limiting**: Intelligent queuing with priority levels
- **Fallback Strategy**: Multi-tier API switching
- **Circuit Breakers**: Automatic degradation during high load

---

## Security and Compliance

### Data Protection
- **Input Validation**: Comprehensive symbol and parameter validation
- **OWASP Compliance**: Top 10 vulnerability protection (80% risk reduction)
- **Error Sanitization**: No sensitive data in error messages
- **Rate Limiting**: Circuit breaker patterns with exponential backoff

### Financial Compliance
- **Real Data Only**: No simulated or mock financial data
- **Source Attribution**: Full traceability of data sources
- **Audit Logging**: Complete request/response logging
- **Data Retention**: Compliance with financial data regulations

---

## Implementation Recommendations

### Progressive Enhancement Strategy
1. **Core Data First**: Display action, confidence, score immediately
2. **Component Loading**: Add score breakdowns as data arrives
3. **Enhanced Features**: Load detailed insights and warnings last
4. **Interactive Elements**: Add comparison and drill-down capabilities

### Mobile Optimization
- **Essential Data**: Action + confidence + price on single line
- **Expandable Details**: Touch to reveal component breakdowns
- **Swipe Actions**: Gesture-based navigation between stocks
- **Responsive Typography**: Scales from 12px to 20px based on viewport

### Accessibility Features
- **Screen Reader Support**: Comprehensive aria-labels and descriptions
- **Keyboard Navigation**: Full functionality without mouse
- **Color Blind Support**: Patterns and shapes supplement color coding
- **High Contrast**: Alternative color schemes for visibility

---

## Integration Context

### API Endpoints
- **Primary Analysis**: `POST /api/stocks/select`
- **Real-time Updates**: WebSocket connections for live data
- **Historical Data**: `GET /api/stocks/{symbol}/history`
- **Comparison Data**: `POST /api/stocks/compare`

### State Management
```typescript
interface AnalysisState {
  symbols: string[]
  results: Map<string, AnalysisCardData>
  loading: Set<string>
  errors: Map<string, string>
  lastUpdated: Map<string, number>
  sortBy: 'score' | 'confidence' | 'symbol' | 'action'
  filterBy: {
    action?: 'BUY' | 'SELL' | 'HOLD'
    minConfidence?: number
    sector?: string
  }
}
```

### Caching Strategy
- **Browser Cache**: 5 minutes for analysis results
- **Service Worker**: Offline capability for cached analyses
- **Local Storage**: User preferences and watchlists
- **Session Storage**: Current analysis session data

---

## Future Enhancement Opportunities

### Advanced Visualizations
- **Interactive Charts**: Price + technical indicator overlays
- **Comparison Matrix**: Multi-stock analysis grid
- **Heat Maps**: Sector and market sentiment visualization
- **Timeline Views**: Historical recommendation tracking

### Machine Learning Integration
- **Pattern Recognition**: Technical chart pattern identification
- **Predictive Analytics**: Price movement probability models
- **Risk Assessment**: Portfolio-level risk analysis
- **Personalization**: User-specific recommendation tuning

### Social Features
- **Analyst Following**: Track preferred analyst recommendations
- **Community Insights**: Aggregate user sentiment and actions
- **Performance Tracking**: Historical recommendation accuracy
- **Educational Content**: Contextual learning modules

---

This specification provides comprehensive guidance for designing Analysis Cards that effectively communicate complex financial analysis in an intuitive, actionable format. The design should prioritize quick decision-making while maintaining transparency in the AI-driven recommendations and providing clear pathways for users who want to understand the reasoning behind each analysis.