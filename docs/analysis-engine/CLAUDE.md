# VFR Analysis Engine - AI Agent Operational Context

**Purpose**: Specialized guidance for AI agents working with the VFR financial analysis engine, providing operational procedures, error boundaries, and implementation context.

**⚠️ CRITICAL CONSTRAINT**: NO MOCK DATA in any implementation - Production reliability depends on real API integration.

## Analysis Engine Context and Mental Model

### System Function and Purpose
**Primary Role**: Transform fragmented financial data into actionable investment insights through AI-powered analysis
**Core Process**: Multi-source data → Weighted analysis → Confidence-scored recommendations
**Business Impact**: Democratizing institutional-grade financial research for individual investors

### Operational Context
This `/docs/analysis-engine` directory provides specialized documentation for the analysis engine subsystem within the main VFR API project. All implementation files are located in the project root under `app/services/`.

**Decision Framework for AI Agents**:
```
Analysis Request → Data Collection → Weighted Scoring → Recommendation
       ↓               ↓              ↓              ↓
   Validate Input   15+ API Sources  5-Factor Analysis  BUY/SELL/HOLD
   ├─ Symbol format   ├─ Premium APIs   ├─ Technical 40%   ├─ Confidence score
   ├─ Sector valid    ├─ Government     ├─ Fundamental 25% ├─ Supporting data
   └─ Multi support   └─ Social intel   └─ Macro 20%      └─ Risk assessment
                                     ├─ Sentiment 10%
                                     └─ Alternative 5%
```

### Directory Structure

```
analysis-engine/
├── analysis-engine-vision.md    # Core data priorities and AI strategy
├── vfr-analysis-flow.md         # Complete data flow architecture
├── data-flow.md                 # Data collection and processing flow
├── feedback-loop.md             # AI learning and optimization
├── api-upgrade-strategy.md      # API integration strategy
├── teir-one-data-inputs.md      # Essential data inputs
├── type-script/                 # TypeScript implementations
├── plans/                       # Strategic planning documents
├── todos/                       # Task management and tracking
└── logs/                        # Development logs
```

## Analysis Engine Architecture

### Core Components
- **Data Collection Layer**: Multi-tiered approach with 15+ financial APIs
- **Analysis Engine**: AI-powered analysis with weighted factor scoring
- **Cache Strategy**: Redis-based caching with TTL optimization
- **Real-time Processing**: Parallel API calls with fallback mechanisms

### Analysis Engine Weighting Strategy with Implementation Status

#### Weighted Factor Analysis (Total: 100%)
| Factor | Weight | Implementation Status | Data Sources | Performance Target | Error Boundary |
|--------|--------|----------------------|--------------|-------------------|---------------|
| **Technical Analysis** | 40% | ✅ IMPLEMENTED | VWAP + indicators | <500ms | Fallback to basic TA if VWAP fails |
| **Fundamental Health** | 25% | ✅ IMPLEMENTED | FMP + EODHD ratios | <1s | Dual-source redundancy |
| **Macroeconomic Context** | 20% | ✅ IMPLEMENTED | FRED + BLS + EIA | <2s | Cache recent data if APIs slow |
| **Sentiment Analysis** | 10% | ✅ IMPLEMENTED | News + Reddit WSB | <1.5s | Graceful degradation with defaults |
| **Alternative Data** | 5% | ✅ IMPLEMENTED | ESG + short interest | <1s | Skip if unavailable |

#### Factor Scoring Logic
```
Factor Analysis → Weighted Scoring → Confidence Calculation → Final Recommendation
       ↓                ↓                  ↓                    ↓
   Individual       Weight × Score     Data Quality Check    BUY/SELL/HOLD
   ├─ Technical 40%  ├─ Max 40 points    ├─ Source reliability  ├─ Confidence %
   ├─ Fundamental    ├─ Weighted sum     ├─ Timestamp fresh     ├─ Risk level
   ├─ Macroeconomic  ├─ Normalization    ├─ Fallback usage      └─ Supporting rationale
   ├─ Sentiment      └─ Range 0-100     └─ Confidence score
   └─ Alternative
```

#### Implementation State Matrix
| Component | Status | File Location | Test Coverage | Performance |
|-----------|--------|---------------|---------------|-------------|
| VWAP Analysis | Production | `VWAPService.ts` | ✅ Comprehensive | <200ms |
| Reddit WSB Sentiment | Production | `RedditAPI.ts` | ✅ Multi-subreddit | <1.5s |
| Macroeconomic Data | Production | `MacroeconomicAnalysisService.ts` | ✅ All APIs | <2s |
| Institutional Intelligence | Production | `InstitutionalDataService.ts` | ✅ 608-line test | <3s |
| ESG Integration | Production | `ESGDataService.ts` | ✅ Comprehensive | <1s |
| Short Interest Analysis | Production | `ShortInterestService.ts` | ✅ FINRA integration | <1s |
| Extended Market Data | Production | `ExtendedMarketDataService.ts` | ✅ Polygon integration | <800ms |

## Development Commands (From Root Directory)

Run these commands from `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/`:

```bash
# Development
npm run dev              # Start development server
npm run type-check       # TypeScript validation
npm run lint            # Code quality check
npm test                # Run all tests

# Analysis Engine Specific
npm test -- app/services/algorithms/  # Test analysis algorithms
npm test -- app/services/stock-selection/  # Test stock selection service
```

## Key File Locations (Relative to Project Root)

### Analysis Engine Implementation
- **Main Service**: `app/services/stock-selection/StockSelectionService.ts`
- **Algorithms**: `app/services/algorithms/` (scheduling and analysis)
- **Data Sources**: `app/services/financial-data/` (API integrations)
- **Caching**: `app/services/cache/RedisCache.ts`

### API Endpoints
- **Stock Analysis**: `app/api/stocks/select/route.ts`
- **Health Check**: `app/api/health/route.ts`
- **Admin Testing**: `app/api/admin/test-data-sources/route.ts`

## Documentation Workflow

### When Adding New Analysis Engine Features
1. Document architecture decisions in relevant `.md` files
2. Update type definitions in `type-script/` directory
3. Add planning documents to `plans/` for complex features
4. Track development tasks in `todos/` directory

### Documentation Standards
- **Real Data Focus**: All examples use real market data, never mock data
- **TypeScript First**: All code examples include proper typing
- **Performance Metrics**: Include timing and optimization details
- **Error Handling**: Document fallback strategies and error scenarios

## Analysis Engine Data Flow

### Single Stock Analysis Process
1. **Input Validation**: Symbol normalization and validation
2. **Parallel Data Collection**: 6+ APIs called simultaneously (~500ms total)
3. **Data Normalization**: Standardize data formats across sources
4. **Analysis Engine**: AI-powered weighted analysis
5. **Result Caching**: Store results in Redis with appropriate TTL
6. **Response**: BUY/SELL/HOLD recommendation with confidence scores

### Data Collection Strategy
- **Primary APIs**: Polygon, Alpha Vantage, Financial Modeling Prep
- **Secondary APIs**: Yahoo Finance, TwelveData
- **Government APIs**: FRED, Treasury, BLS, EIA
- **Fallback Logic**: Automatic source switching on failures

## Testing Philosophy

### Analysis Engine Testing
- **Real API Integration**: Always test with live data connections
- **Performance Testing**: Measure data collection and analysis timing
- **Fallback Testing**: Verify graceful degradation when APIs fail
- **Memory Optimization**: Tests run with `maxWorkers: 1` for stability

### Test Patterns
```bash
# Run specific analysis engine tests
npm test -- --testNamePattern="StockSelectionService"
npm test -- app/services/financial-data/__tests__/
npm test -- --testNamePattern="PolygonAPI"
```

## Development Guidelines

### Analysis Engine Specific Rules
- **KISS Principles**: Keep solutions simple and readable - avoid over-engineering
- **No Mock Data**: Always use real financial APIs for testing and development
- **Performance First**: Target < 3 seconds for complete analysis
- **Graceful Degradation**: Handle API failures without breaking user experience (Live Market Sentiment fix ✅)
- **Confidence Scoring**: All analysis results include confidence levels
- **Caching Strategy**: Implement appropriate TTL for different data types
- **Rate Limit Handling**: Provide meaningful user feedback during API constraints

### Data Quality Standards
- **Source Attribution**: Track which APIs provided each data point
- **Timestamp Accuracy**: Precise timing for all market data
- **Error Logging**: Comprehensive logging for debugging API issues
- **Rate Limiting**: Respect API limits and implement backoff strategies

## Analysis Engine Error Boundaries and Recovery Procedures

### Error Classification and Recovery Matrix

#### Data Collection Errors
| Error Type | Symptoms | Root Cause | Recovery Action | Prevention |
|------------|----------|------------|-----------------|------------|
| **API Rate Limits** | 429 responses, missing data | Daily/hourly limits exceeded | FallbackDataService auto-switch | Monitor usage in admin dashboard |
| **API Timeouts** | Slow responses, incomplete data | Network/server issues | 5s timeout → fallback source | Health monitoring |
| **Invalid Responses** | Data format errors | API changes/outages | Schema validation → cache/backup | Version tracking |
| **Authentication Failures** | 401/403 errors | Invalid/expired keys | Key rotation → admin notification | Key management |

#### Analysis Engine Errors
| Issue | Detection | Impact | Immediate Response | Long-term Fix |
|-------|-----------|--------|--------------------|---------------|
| **Cache Misses** | Redis connection fails | Slower responses | In-memory fallback | Redis health monitoring |
| **Analysis Timeouts** | >3s processing time | User experience degradation | Return partial results | Optimize algorithms |
| **Data Quality Issues** | Inconsistent scoring | Unreliable recommendations | Confidence score adjustment | Data validation |
| **Memory Pressure** | High heap usage | Performance degradation | Garbage collection | Memory optimization |

### Diagnostic Decision Tree
```
Issue Detected → Categorize → Gather Context → Apply Recovery → Monitor
      ↓             ↓            ↓             ↓           ↓
  User Report    Data/Engine   Run Diagnostics  Execute Fix   Verify Fix
     │          ├─ Data       ├─ /api/health   ├─ Auto-retry   ├─ Success metrics
     │          ├─ Analysis   ├─ Admin panel   ├─ Fallback     ├─ Error reduction
     │          └─ System     └─ Log analysis └─ Manual fix   └─ Performance
     └─ Log incident for pattern analysis
```

### Analysis Engine Diagnostic Commands
```bash
# System Health (Run from project root)
curl http://localhost:3000/api/health              # Overall system status
curl http://localhost:3000/api/admin/data-sources  # Individual API health

# Performance Monitoring
npm run dev:monitor                               # Real-time request logs
npm run test:performance                          # Memory and timing analysis

# Data Source Testing
node test-polygon-updates.ts                      # Polygon API connectivity
node test-fallback-service.mjs                    # Fallback logic validation

# Analysis Engine Specific
npm test -- --testNamePattern="StockSelectionService"  # Core analysis tests
npm test -- app/services/financial-data/              # Data service validation
```

### Emergency Recovery Procedures
1. **Analysis Engine Down**: Check `/api/health` → Restart services → Verify data flow
2. **Data Quality Degradation**: Admin dashboard → Check source status → Enable manual overrides
3. **Performance Issues**: Monitor memory → Check cache hit rates → Optimize queries
4. **Partial Service Failure**: Identify failed component → Enable fallbacks → Monitor confidence scores

## Important Notes

- This directory documents the analysis engine architecture and strategy
- All implementation files are in the main project structure under `app/`
- When making changes to analysis logic, update relevant documentation here
- TypeScript examples in `type-script/` should reflect actual implementation
- Focus on real-world performance and data quality over theoretical optimization