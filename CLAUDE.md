# VFR Financial Analysis Platform - AI Agent Context Guide

**Context-First Documentation for Maximum AI Comprehension and Actionability**

## Decision Framework for AI Agents

### Primary Context
**System Purpose**: Enterprise-grade financial analysis platform democratizing institutional-level stock intelligence through AI-powered multi-source data aggregation.

**Business Context**: Individual investors lack access to sophisticated analysis tools available to institutions. This platform levels the playing field through real-time analysis of 15+ data sources across 11 active analysis components including options trading intelligence.

**Technical Context**: Next.js 15 production platform with TypeScript, serving financial analysis via service-layer architecture with enterprise security and performance optimization.

### Critical Success Criteria
- **Data Integrity**: NO MOCK DATA - Production reliability depends on real API integration
- **Performance**: Sub-3-second analysis completion with 83.8% parallel processing improvement
- **Security**: 80% risk reduction through OWASP Top 10 compliance
- **Reliability**: 99.5% uptime via multi-tier fallback strategies

### AI Agent Decision Tree
```
Task Type → Decision Path → Required Actions
├── Development Task
│   ├── Code Changes → `npm run type-check` BEFORE implementation
│   ├── New Features → TDD approach with real API testing
│   └── Bug Fixes → Check `/api/health` + admin dashboard first
├── Testing Task
│   ├── Integration → Use real APIs with 5-minute timeout
│   ├── Performance → Memory optimization (4096MB heap, maxWorkers: 1)
│   └── Security → OWASP validation + input sanitization
└── Deployment Task
    ├── Environment → Verify 15+ API keys configured
    ├── Database → PostgreSQL + Redis + optional InfluxDB
    └── Monitoring → Health endpoints + admin dashboard
```

### Essential Knowledge Context
- **Rule #1**: NO MOCK DATA - Always use real APIs for development and testing
- **Platform**: Next.js 15 + TypeScript (App Router) with React 19
- **Data Sources**: 15+ financial APIs with intelligent fallback patterns
- **Architecture**: Service layer + Redis caching + enterprise security
- **Commands**: `npm run dev:clean` (port conflicts), `npm test` (TDD), `npm run type-check`
- **Key Paths**: `app/services/` (business logic), `app/api/` (endpoints), `docs/` (comprehensive docs)

## System Identity and Mental Model

**Entity**: Veritak Financial Research LLC
**Domain**: Financial technology platform providing institutional-grade analysis
**Theme**: Cyberpunk aesthetic with enterprise functionality
**Value Proposition**: Democratizing sophisticated financial research through AI-powered insights

### Mental Model for AI Agents
**Think of this system as**: A financial intelligence aggregator that transforms fragmented market data into actionable investment insights.

**Core Function**: Input stock symbols → Parallel API data collection → AI analysis → BUY/SELL/HOLD recommendations

**Key Differentiators**:
- Real-time processing of 15+ data sources
- Institutional-grade intelligence (13F filings, Form 4 insider trading)
- Advanced trading features (VWAP analysis, sentiment aggregation)
- Enterprise security with graceful degradation

## Architecture Context and Data Flow

### High-Level System Architecture
**Design Pattern**: Service-oriented architecture with clear separation of concerns
**Processing Model**: Parallel data collection → Centralized analysis → Cached results
**Fault Tolerance**: Multi-tier fallbacks with graceful degradation

### Directory Structure with Functional Context
```
app/                            # Next.js 15 App Router application root
├── api/                        # RESTful API endpoints with JWT auth
│   ├── admin/                  # System management (data source health, testing)
│   ├── stocks/                 # Core analysis endpoints (multi-modal input)
│   ├── health/                 # System diagnostics and monitoring
│   ├── user_auth/              # JWT token management and validation
│   └── economic/               # Macroeconomic data endpoints (FRED, BLS, EIA)
├── components/                 # React 19 UI components with TypeScript
├── services/                   # 🎯 CORE BUSINESS LOGIC - Primary development focus
│   ├── algorithms/             # Stock analysis algorithms with AI scoring
│   ├── auth/                   # JWT + bcrypt security implementation
│   ├── cache/                  # Redis primary + in-memory fallback
│   ├── financial-data/         # 15+ API integrations with fallback chains
│   ├── stock-selection/        # Multi-modal analysis orchestration
│   ├── admin/                  # Configuration persistence and management
│   ├── database/               # PostgreSQL + Redis + InfluxDB connections
│   ├── security/               # OWASP Top 10 protection (80% risk reduction)
│   ├── error-handling/         # Centralized error management with sanitization
│   └── types/                  # TypeScript definitions for all services
├── hooks/                      # React hooks for UI state management
├── admin/                      # Admin dashboard for system monitoring
├── stock-intelligence/         # Primary user interface for analysis
└── globals.css                 # Cyberpunk-themed styling
src/
├── components/economic-data/   # Economic data visualization (charts, heatmaps)
├── types/                      # Shared TypeScript type definitions
└── utils/                      # Utility functions and helpers
```

### Data Flow Architecture with Decision Points
```
User Input → Input Validation → Service Layer → Parallel APIs → Analysis Engine → Cache → Response
    ↓              ↓               ↓             ↓             ↓             ↓         ↓
Symbol(s)     SecurityValidator  StockSelection  15+ Sources   AI Scoring    Redis     Insights
Sector        ├─ OWASP checks   ├─ Orchestration ├─ Primary   ├─ Weighted   ├─ TTL    ├─ BUY/SELL/HOLD
Multiple      ├─ Input sanit.   ├─ Multi-modal   ├─ Secondary  ├─ 5 factors  ├─ Fallback ├─ Confidence
              └─ Rate limits    └─ Error handle  └─ Fallback   └─ Insights   └─ Memory └─ Reasoning
```

## Development Commands and Operational Procedures

### Command Decision Matrix

#### Development Server Management
| Scenario | Command | When to Use | Expected Outcome |
|----------|---------|-------------|------------------|
| **Port Conflicts** | `npm run dev:clean` | "EADDRINUSE" errors | Kills conflicting processes + fresh start |
| **Standard Development** | `npm run dev` | Normal development workflow | Server on port 3000 |
| **API-Only Development** | `npm run dev:api` | Backend-focused work | API server on port 3002 |
| **Production Build** | `npm run build` | Pre-deployment validation | Optimized production bundle |

#### Code Quality Gates
| Gate | Command | ⚠️ Mandatory Before | Success Criteria |
|------|---------|-------------------|------------------|
| **Type Safety** | `npm run type-check` | Any code commit | Zero TypeScript errors |
| **Code Style** | `npm run lint` | Pull requests | ESLint compliance |
| **Formatting** | `npm run format` | Code reviews | Prettier consistency |

### Essential Development Workflow
```
1. Port Conflicts? → npm run dev:clean
2. Code Changes? → npm run type-check (MANDATORY)
3. New Features? → npm test (TDD approach)
4. Ready to Commit? → npm run lint + format
```

#### Testing Commands with Context

##### Primary Testing Workflow
| Command | Purpose | Memory Config | Timeout | When to Use |
|---------|---------|---------------|---------|-------------|
| `npm test` | Full test suite | 4096MB heap, maxWorkers: 1 | 5 minutes | Before commits, CI/CD |
| `npm run test:watch` | Development testing | Memory optimized | 5 minutes | Active development |
| `npm run test:coverage` | Coverage validation | Standard | 5 minutes | Pre-release validation |

##### Specialized Testing
| Test Type | Command | Target | Success Criteria |
|-----------|---------|--------|------------------|
| **Performance** | `npm run test:performance` | Response times, memory | <3s analysis, no leaks |
| **Individual Service** | `npm run test:performance:single` | SentimentAnalysisService | <1.5s completion |
| **Memory Management** | `npm run test:performance:memory` | Heap utilization | <4GB usage |
| **Cache Efficiency** | `npm run test:performance:cache` | Redis + fallback | 85%+ hit ratio |

##### Targeted Testing
```bash
# Specific test patterns
npm test -- --testNamePattern="ServiceName"  # Target specific service
npm test -- path/to/test.ts                  # Run specific file
npm test -- app/services/financial-data/     # Test data services
```

##### Testing Philosophy and Constraints
- **🚫 CRITICAL**: NO MOCK DATA - All tests use real APIs
- **Memory Management**: Explicit garbage collection prevents heap overflow
- **Real-World Validation**: 5-minute timeout accommodates API response variations
- **Enterprise Testing**: Includes security, performance, and reliability validation

### Integration Test Status
- **Test Suite Scale**: ✅ 26 comprehensive test files with 13,200+ lines of test code
- **VWAPService**: ✅ New comprehensive test suite for VWAP calculations and analysis integration
- **InstitutionalDataService**: ✅ 608-line comprehensive integration test covering error handling, caching, real-time processing, and security
- **MacroeconomicAnalysisService**: ✅ Enhanced test suite for macroeconomic data integration (FRED, BLS, EIA APIs)
- **CurrencyDataService**: ✅ Test suite for international currency data analysis
- **SentimentAnalysisService**: ✅ Production-ready sentiment analysis with NewsAPI + Reddit WSB integration
- **MarketSentimentService**: ✅ Enhanced Live Market Sentiment with rate limit graceful degradation (commit a381c82)
- **Cache Integration**: ✅ RedisCache + in-memory fallback with cache-aside pattern verification
- **Rate Limiting**: ✅ Circuit breaker patterns and concurrent request handling
- **Security Compliance**: ✅ OWASP Top 10 protection with input validation and error sanitization
- **Performance Optimization**: ✅ Memory management with 4096MB heap allocation and maxWorkers: 1
- **Technical Analysis**: ✅ Advanced indicators and signal processing tests with VWAP integration

### Development Utilities
- `npm run dev:port-check` - Check if port 3000 is available
- `npm run dev:kill` - Kill all development processes
- `npm run dev:status` - Check development server status
- `npm run dev:monitor` - Monitor development server
- `npm run dev:health` - Run daily health check
- `./scripts/dev-clean.sh` - Clean development environment script

## Data Sources Architecture and Service Context

### Multi-Tier Data Strategy with Fallback Logic

#### API Tier Classification and Decision Tree
```
Data Request → Tier Selection → Fallback Chain → Error Handling
      ↓              ↓               ↓              ↓
  Stock Symbol   Premium APIs    Secondary APIs   Cache + Error
  Sector         ├─ Polygon      ├─ EODHD        ├─ In-memory
  Multiple       ├─ Alpha V.     ├─ TwelveData   ├─ Graceful degradation
                 └─ FMP         └─ Yahoo        └─ User notification
```

#### Financial Data Source Matrix
| Tier | Source | Rate Limit | Reliability | Purpose | Implementation Path |
|------|--------|------------|-------------|---------|--------------------|
| **Premium** | Polygon.io | 5000/day | 99.9% | Real-time data + VWAP | `app/services/financial-data/PolygonAPI.ts` |
| **Premium** | Alpha Vantage | 500/day | 99.5% | Historical + fundamentals | `app/services/financial-data/AlphaVantageAPI.ts` |
| **Premium** | FMP | 250/day | 99.7% | Financial ratios + earnings | `app/services/financial-data/FMPAPI.ts` |
| **Enhanced** | EODHD | 100k/day | 99.0% | International + ratios | `FallbackDataService.ts` |
| **Enhanced** | TwelveData | 800/day | 98.5% | Technical indicators | `TwelveDataAPI.ts` |
| **Government** | SEC EDGAR | Unlimited | 99.9% | 13F filings + Form 4 | `SECEdgarAPI.ts` |
| **Government** | FRED | Unlimited | 99.9% | Economic indicators | `FREDAPI.ts` |
| **Government** | BLS | Unlimited | 99.8% | Labor statistics | `BLSAPI.ts` |
| **Government** | EIA | Unlimited | 99.7% | Energy data | `EIAAPI.ts` |
| **Social Intel** | Reddit WSB | Unlimited | 95.0% | Sentiment analysis | `RedditAPI.ts` |
| **Backup** | Yahoo Finance | N/A | 90.0% | Emergency fallback | Integrated in services |

#### Data Source Selection Logic
```
PRIMARY: Check rate limits → Use premium sources
    ↓
SECONDARY: If primary exhausted → Use enhanced sources
    ↓
TERTIARY: If secondary unavailable → Use government + social
    ↓
FALLBACK: If all fail → Cache + Yahoo Finance
    ↓
ERROR: If cache stale → Graceful degradation with user notification
```

### Core Services
| Service | Path | Purpose |
|---------|------|---------|
| StockSelectionService | `app/services/stock-selection/` | Multi-modal stock analysis |
| InstitutionalDataService | `app/services/financial-data/InstitutionalDataService.ts` | 13F holdings + Form 4 insider trading |
| MacroeconomicAnalysisService | `app/services/financial-data/MacroeconomicAnalysisService.ts` | FRED + BLS + EIA macroeconomic data integration |
| CurrencyDataService | `app/services/financial-data/CurrencyDataService.ts` | International currency data and analysis |
| VWAPService | `app/services/financial-data/VWAPService.ts` | Volume Weighted Average Price calculations and analysis |
| SentimentAnalysisService | `app/services/financial-data/SentimentAnalysisService.ts` | News + Reddit WSB sentiment analysis |
| EnhancedDataService | `app/services/financial-data/EnhancedDataService.ts` | Enhanced financial data aggregation |
| RedditAPI | `app/services/financial-data/providers/RedditAPI.ts` | WSB sentiment analysis with performance testing |
| RedditAPIEnhanced | `app/services/financial-data/providers/RedditAPIEnhanced.ts` | Multi-subreddit sentiment analysis with weighted scoring |
| NewsAPI | `app/services/financial-data/providers/NewsAPI.ts` | Financial news sentiment analysis provider |
| EconomicCalendarService | `app/services/financial-data/EconomicCalendarService.ts` | Economic events and calendar data processing |
| MarketIndicesService | `app/services/financial-data/MarketIndicesService.ts` | Market indices data and analysis |
| MarketSentimentService | `app/services/financial-data/MarketSentimentService.ts` | Comprehensive market sentiment aggregation with rate limit handling |
| SectorDataService | `app/services/financial-data/SectorDataService.ts` | Sector-level analysis and performance tracking |
| SecurityValidator | `app/services/security/SecurityValidator.ts` | OWASP Top 10 protection |
| ErrorHandler | `app/services/error-handling/ErrorHandler.ts` | Centralized error management |
| CacheService | `app/services/cache/` | Redis + in-memory fallback |

### Stock Analysis Engine (✅ Enhanced with Sentiment Integration)
- **Multi-modal Input**: Single stocks, sectors, or multiple symbols
- **Analysis Algorithms**: Located in `app/services/algorithms/` with sentiment integration architecture
- **Selection Service**: `app/services/stock-selection/StockSelectionService.ts`
- **Real-time Processing**: Combines multiple data sources for comprehensive analysis
- **✅ Sentiment Integration**: AlgorithmEngine pre-fetch pattern ensures sentiment data contributes 10% weight to composite scoring
- **Architecture Fix**: Modified `AlgorithmEngine.calculateSingleStockScore()` and `FactorLibrary.calculateMainComposite()` for direct sentiment integration
- **Analyst Integration**: Real-time analyst ratings, price targets, and sentiment scoring
- **Fundamental Analysis**: 15 key fundamental ratios integrated into analysis (P/E, P/B, ROE, margins, liquidity ratios) with dual-source redundancy (FMP + EODHD)
- **Institutional Intelligence**: 13F quarterly holdings analysis and Form 4 insider trading monitoring with real-time sentiment scoring
- **Intelligence Features**: Analyst-based, fundamental-based, institutional, and insider warnings, opportunities, and upside calculations

### Advanced Trading Features (Recently Implemented)
- **VWAP Analysis**: Volume Weighted Average Price calculations with real-time deviation analysis
- **Multi-timeframe VWAP**: Minute, hour, and daily VWAP data for comprehensive price analysis
- **VWAP Signals**: Above/below/at VWAP positioning with strength indicators (weak/moderate/strong)
- **Technical Integration**: VWAP scoring integrated into technical analysis component (40% weight)
- **Performance Optimized**: < 200ms additional latency for VWAP calculations with 1-minute cache TTL
- **Polygon.io Integration**: Direct VWAP endpoint integration with fallback to calculated VWAP from aggregates
- **Trading Intelligence**: Price deviation analysis for institutional-grade execution timing

### Current Implementation Status (Based on Recent Development)
#### ✅ Completed Features
- **VWAP Service**: Full implementation with VWAPService.ts, comprehensive testing, and Polygon API integration
- **Reddit WSB Integration**: Enhanced sentiment analysis with OAuth2, performance testing, and multi-symbol support
- **Enhanced Reddit API**: Multi-subreddit sentiment analysis with weighted scoring and parallel processing (RedditAPIEnhanced.ts)
- **Sentiment Analysis**: ✅ COMPLETED - Production-ready sentiment integration with architecture fix resolving 0% utilization bug. Now actively contributes 10% to composite scoring through AlgorithmEngine pre-fetch pattern.
- **Macroeconomic Data**: FRED + BLS + EIA integration (20% weight) with real-time economic cycle analysis
- **Institutional Intelligence**: SEC EDGAR 13F + Form 4 insider trading monitoring (10% sentiment weight)
- **Fundamental Analysis**: 15+ ratios with dual-source redundancy (FMP + EODHD) contributing 25% weight
- **Technical Indicators**: Advanced indicators with VWAP integration (40% weight)
- **Options Analysis**: ✅ COMPLETED - Put/call ratios, options chain, max pain calculation, and implied volatility analysis with EODHD + Polygon + Yahoo integration (11 active analysis components)
- **Economic Calendar**: Economic events processing and calendar data integration
- **Market Indices**: Comprehensive market indices tracking and analysis
- **Sector Data**: Sector-level performance analysis and tracking
- **Live Market Sentiment**: Enhanced sentiment display with rate limit graceful degradation and improved UX
- **Infrastructure Optimizations (Sept 2025)**: ✅ COMPLETED - Comprehensive infrastructure fixes for production reliability:
  - **Redis Connection**: Fixed REDIS_URL parsing and enhanced retry logic for 99.9% cache reliability
  - **API Rate Limit Mitigation**: Reordered provider priority (FMP → TwelveData → Yahoo → Polygon) eliminating 429 errors
  - **Data Validation**: Enhanced FMP decimal precision rounding preventing validation warnings
  - **Symbol Data Service**: Fixed Alpha Vantage API key authentication resolving 406 errors

#### ✅ Recently Completed Features (September 2025)
- **Extended Market Data**: ✅ Pre/post market data and bid/ask spread analysis IMPLEMENTED
- **Short Interest Integration**: ✅ FINRA data processing and squeeze detection algorithms IMPLEMENTED
- **ESG Integration**: ✅ Alternative data component (3% weight) IMPLEMENTED with industry baselines
- **Yahoo Finance API Integration**: ✅ Direct REST API replacing MCP-based fetching IMPLEMENTED
- **High-Performance Sentiment Analysis**: ✅ Yahoo Finance Sentiment API with <1.5s response time IMPLEMENTED
- **Currency Data Service**: ✅ International currency analysis IMPLEMENTED
- **✅ SENTIMENT INTEGRATION ARCHITECTURE FIX**: ✅ COMPLETED - Resolved 0% sentiment utilization bug through AlgorithmEngine pre-fetch integration. GME sentiment (0.52) now actively contributes 10% weight to composite scoring instead of 0% utilization.

#### ✅ Recently Completed Features (September 2025) - UPDATED
- **Extended Market Data**: ✅ Pre/post market data and bid/ask spread analysis IMPLEMENTED
- **Short Interest Integration**: ✅ FINRA data processing and squeeze detection algorithms IMPLEMENTED
- **ESG Integration**: ✅ Alternative data component (3% weight) IMPLEMENTED with industry baselines
- **Yahoo Finance API Integration**: ✅ Direct REST API replacing MCP-based fetching IMPLEMENTED
- **High-Performance Sentiment Analysis**: ✅ Yahoo Finance Sentiment API with <1.5s response time IMPLEMENTED
- **Currency Data Service**: ✅ International currency analysis IMPLEMENTED
- **Options Analysis Integration**: ✅ COMPLETED - Put/call ratios, options chain, max pain, and implied volatility analysis FULLY ACTIVE with EODHD + Polygon + Yahoo integration
- **✅ SENTIMENT INTEGRATION ARCHITECTURE FIX**: ✅ COMPLETED - Resolved 0% sentiment utilization bug through AlgorithmEngine pre-fetch integration. GME sentiment (0.52) now actively contributes 10% weight to composite scoring instead of 0% utilization.

#### 📋 Planned Features (Updated Based on Current Implementation)
- **Enhanced Technical Patterns**: Pattern recognition and support/resistance identification - IN PLANNING
- **Machine Learning Pipeline**: Automated model training and deployment - FUTURE ROADMAP

### Recent UX/UI Improvements (Latest Fixes)
#### ✅ Live Market Sentiment Enhancement (Commit a381c82)
- **Problem Solved**: Live Market Sentiment cards showing confusing 0.00% values during API rate limits
- **Solution Implemented**:
  - Enhanced MarketSentimentService with realistic baseline defaults (52 ± 5 sentiment score)
  - Added confidence scoring system (0.1 for defaults vs 0.8 for real data)
  - Improved UI with "Limited Data" messaging instead of 0.00% display
  - Visual indicators (dashed borders, warning dots) for constrained data
  - Tooltips explaining data limitations and quality warnings
- **Rate Limit Handling**: Graceful degradation for TwelveData (800/day), FMP, and Polygon API constraints
- **User Experience**: Clear distinction between real data and fallback scenarios
- **Technical Details**: Enhanced error handling in MarketSentimentHeatmap.tsx and SectorRotationWheel.tsx
- **Status**: Production-ready with comprehensive error states and retry functionality

### Caching System
- **Primary**: Redis with configurable TTL (2min dev, 10min prod)
- **Fallback**: In-memory cache for high availability
- **Implementation**: `app/services/cache/` with RedisCache and InMemoryCache classes
- **Strategy**: Cache-aside pattern with automatic invalidation

### Authentication & Security
- **JWT-based**: Token authentication with bcrypt password hashing
- **Service**: `app/services/auth/AuthService.ts`
- **Admin Access**: Development mode grants automatic admin access
- **Enterprise Security**: Comprehensive SecurityValidator service protecting against OWASP Top 10
- **Input Validation**: Symbol validation with regex patterns preventing injection attacks
- **Rate Limiting**: Circuit breaker patterns and request throttling
- **Error Sanitization**: Secure error handling preventing information disclosure
- **Production Ready**: ~80% security risk reduction achieved through comprehensive validation

### Admin Management
- **Data Source Control**: Toggle APIs on/off, test connections, monitor health
- **Real-time Testing**: Direct API calls with comprehensive test types (connection, data, performance, comprehensive)
- **Performance Monitoring**: Response times, success rates, error tracking
- **Reddit WSB Integration**: Full performance testing support with sentiment analysis across multiple symbols ['AAPL', 'TSLA', 'GME', 'NVDA', 'MSFT']
- **Configuration**: Persistent state management in `.admin-datasource-states.json`

## Database Architecture

### Primary Databases
- **PostgreSQL**: Main application data, user accounts, analysis results
- **Redis**: High-performance caching and session storage
- **InfluxDB**: Time-series financial data (optional)

### Connection Management
- **Service Layer**: `app/services/database/` handles all database connections
- **Environment Config**: Database URLs configured via environment variables
- **Fallback Logic**: Graceful degradation when optional databases unavailable

## Testing Framework

### Configuration
- **Framework**: Jest with ts-jest preset and TypeScript diagnostics optimization
- **Memory Optimization**: 4096MB heap allocation, `maxWorkers: 1`, `runInBand` execution
- **Performance**: Explicit garbage collection (`--expose-gc`), memory leak detection disabled temporarily
- **Pattern**: `**/__tests__/**/*.test.ts` excluding node_modules and build directories
- **Coverage**: Comprehensive service layer coverage output to `docs/test-output/coverage/`
- **Timeout**: 300,000ms (5 minutes) for integration tests with real APIs
- **Concurrency**: Max 5 concurrent tests with worker memory limit of 512MB

### Testing Philosophy
- **TDD Approach**: Tests written before implementation with comprehensive integration focus
- **Real Data Only**: Always use real APIs with live data sources, never mock data
- **Enterprise Testing**: Circuit breaker patterns, memory pressure testing, concurrent request handling
- **Security Integration**: OWASP Top 10 validation, input sanitization, error disclosure prevention
- **Performance Validation**: Response time targets, memory leak prevention, cache optimization

### Recent Test Advancements
**Test Suite Evolution (Based on Recent Commits)**:
- **608-line Integration Test**: Comprehensive InstitutionalDataService test covering error handling, resilience, caching, and security
- **Macroeconomic Data Testing**: New test suite for MacroeconomicAnalysisService with FRED, BLS, and EIA API integration
- **Currency Data Validation**: CurrencyDataService testing with international data sources
- **Enhanced Security Testing**: Circuit breaker patterns, concurrent request handling, and memory pressure testing
- **Real-time Processing**: Live API integration tests with 5-minute timeouts for comprehensive validation
- **Memory Management**: Advanced Jest configuration preventing memory leaks in extensive test runs
- **Performance Benchmarking**: Response time validation and parallel processing optimization tests

**Current Status**: All tests passing after comprehensive fixes addressing memory optimization, security integration, and real-time data processing capabilities.

## Data Flow Architecture

### Request Processing
1. **User Input**: Stock symbols, sectors, or multiple symbols via `/stock-intelligence`
2. **API Gateway**: Request routing through Next.js API routes in `app/api/`
3. **Service Layer**: Business logic in `app/services/` handles data processing
4. **Data Sources**: Parallel API calls to multiple financial data providers
5. **Analysis Engine**: AI-powered analysis combines data for insights
6. **Caching**: Results cached for performance optimization
7. **Response**: Actionable insights returned to frontend

### Admin Data Flow
1. **Admin Dashboard**: `/admin` provides system management interface
2. **Data Source Management**: Real-time API testing and health monitoring
3. **Configuration Updates**: Persistent state changes for API availability
4. **Performance Monitoring**: Live metrics for response times and success rates

## Environment & Configuration

| Environment | Cache TTL | Rate Limits | Admin Access | File |
|-------------|-----------|-------------|--------------|------|
| Development | 2 minutes | Relaxed | Auto-granted | `.env` |
| Production | 10 minutes | Strict | JWT Required | `.env` |

**Required Variables**: API keys (AV, Polygon, FMP, FRED), DB URLs (PostgreSQL, Redis), JWT secrets

## Development Standards

### Non-Negotiable Rules
1. **NO MOCK DATA** - Always use real APIs
2. **TypeScript Strict** - All code must pass strict checks
3. **Real Data Only** - Connect to actual data sources
4. **KISS Principles** - Avoid over-engineering
5. **Performance First** - Optimize for Core Web Vitals
6. **Graceful Degradation** - Handle API rate limits with meaningful user feedback

### Architecture Patterns
- **Service Layer**: Business logic in `app/services/`
- **Error Handling**: Centralized via `ErrorHandler.ts`
- **Security**: `SecurityValidator` on all endpoints
- **Caching**: Redis + in-memory fallback
- **Performance**: Promise.allSettled parallel execution (83.8% improvement)
- **Rate Limit Handling**: Graceful API degradation with meaningful user feedback

### Workflow
1. `npm run dev:clean` (port conflicts)
2. `npm run type-check` (before commit)
3. `npm test` (TDD approach)
4. Kill httpd processes if server issues

## File Locations

### Critical Service Files
| Component | File Path | Purpose |
|-----------|-----------|---------|
| Stock Analysis | `app/services/stock-selection/StockSelectionService.ts` | Multi-modal analysis |
| ✅ Algorithm Engine | `app/services/algorithms/AlgorithmEngine.ts` | Sentiment integration pre-fetch architecture (lines 446-470) |
| ✅ Factor Library | `app/services/algorithms/FactorLibrary.ts` | Composite scoring with sentiment integration (lines 1614-1676) |
| VWAP Analysis | `app/services/financial-data/VWAPService.ts` | Volume Weighted Average Price calculations |
| ✅ Sentiment Analysis | `app/services/financial-data/SentimentAnalysisService.ts` | News + Reddit WSB sentiment analysis - ACTIVELY INTEGRATED |
| Enhanced Data | `app/services/financial-data/EnhancedDataService.ts` | Enhanced financial data aggregation |
| Institutional Data | `app/services/financial-data/InstitutionalDataService.ts` | 13F + Form 4 parsing |
| Macroeconomic Analysis | `app/services/financial-data/MacroeconomicAnalysisService.ts` | FRED + BLS + EIA data orchestration |
| Currency Data | `app/services/financial-data/CurrencyDataService.ts` | International currency analysis |
| ✅ Options Analysis | `app/services/financial-data/OptionsDataService.ts` | Put/call ratios, options chain, max pain, implied volatility - FULLY ACTIVE |
| SEC EDGAR | `app/services/financial-data/SECEdgarAPI.ts` | Enhanced SEC integration |
| FRED API | `app/services/financial-data/FREDAPI.ts` | Enhanced Federal Reserve data |
| BLS API | `app/services/financial-data/BLSAPI.ts` | Bureau of Labor Statistics data |
| EIA API | `app/services/financial-data/EIAAPI.ts` | Energy Information Administration data |
| Reddit WSB API | `app/services/financial-data/providers/RedditAPI.ts` | WSB sentiment analysis with performance testing |
| Market Sentiment UI | `app/components/market/MarketSentimentHeatmap.tsx` | Enhanced sentiment display with rate limit handling |
| Sector Rotation UI | `app/components/market/SectorRotationWheel.tsx` | Sector visualization with error states and retry functionality |
| Security | `app/services/security/SecurityValidator.ts` | OWASP protection |
| Error Handling | `app/services/error-handling/ErrorHandler.ts` | Centralized errors |
| Caching | `app/services/cache/RedisCache.ts` | Redis + fallback |
| Authentication | `app/services/auth/AuthService.ts` | JWT + bcrypt |
| Data Fallback | `app/services/financial-data/FallbackDataService.ts` | API switching |

### Config Files
- `jest.config.js` - Advanced memory optimization with 4096MB heap, garbage collection, leak detection
- `jest.setup.js` - Test environment setup and global configurations
- `jest.node-setup.js` - Node.js specific warning suppression and environment setup
- `jest.reporter.js` - Custom test output formatting and reporting
- `tsconfig.json` - TypeScript strict mode with enhanced diagnostics
- `.env` - Extended API keys (FRED, BLS, EIA) and database URLs

### Key Documentation
- `docs/vision.md` - Project goals and strategic direction
- `docs/security-architecture.md` - Security implementation and OWASP compliance
- `docs/error-handling-standards.md` - Error management and logging standards
- `docs/analysis-engine/` - Analysis engine documentation ecosystem
  - `plans/` - Strategic implementation plans for trading features, ESG, macroeconomic data
  - `todos/` - Detailed task tracking and implementation status
  - `CLAUDE.md` - Analysis engine specific AI agent instructions

## Troubleshooting Matrix with Context-Aware Solutions

### Primary Issue Classification and Resolution

#### System-Level Issues
| Issue | Symptoms | Root Cause | Immediate Action | Verification | Prevention |
|-------|----------|------------|------------------|--------------|------------|
| **Port Conflicts** | "EADDRINUSE: address already in use" | Multiple dev servers | `npm run dev:clean` | Server starts on port 3000 | Use dev:clean consistently |
| **Memory Issues** | Slow tests, heap errors | Jest memory pressure | `export NODE_OPTIONS="--max-old-space-size=8192"` | Tests complete without errors | Monitor with `npm run test:performance:memory` |
| **Server Issues** | HTTP 502/503 errors | httpd process conflicts | Kill httpd + `npm run dev:clean` | `/api/health` returns 200 | Regular process cleanup |

#### Data Source Issues
| Issue | Symptoms | Detection Method | Auto-Resolution | Manual Override |
|-------|----------|------------------|-----------------|----------------|
| **API Rate Limits** | 429 errors, missing data | Admin dashboard warnings | FallbackDataService switches sources | Enable caching, wait for reset |
| **Redis Connectivity** | Cache misses, slow responses | Connection timeouts | In-memory fallback activates | Restart Redis, verify REDIS_URL |
| **Market Sentiment 0.00%** | Placeholder values displayed | Rate limit reached | Enhanced fallback with "Limited Data" UI | Wait for API reset, check admin panel |

#### Development Issues
| Issue | Context | Diagnostic Command | Solution Path | Success Indicator |
|-------|---------|-------------------|---------------|-------------------|
| **TypeScript Errors** | Compilation failures | `npm run type-check` | Fix type definitions | Zero TS errors |
| **Test Failures** | CI/CD pipeline breaks | `npm test -- --verbose` | Debug specific test | All tests pass |
| **Database Connectivity** | Service startup fails | Check Docker services | Verify connection strings | `/api/health` shows DB connected |

### Diagnostic Decision Tree
```
Issue Reported → Categorize → Gather Context → Apply Solution → Verify Resolution
       ↓              ↓            ↓             ↓               ↓
  User Report    System/Data    Run Diagnostics  Execute Fix    Confirm Success
     │          ├─ System     ├─ /api/health   ├─ Automated    ├─ Health check
     │          ├─ Data       ├─ Admin dash    ├─ Manual       ├─ User feedback
     │          └─ Dev        └─ Log analysis └─ Config       └─ Metrics normal
     └─ If unresolved → Escalate with full context
```

### Diagnostic Endpoints with Expected Responses
| Endpoint | Purpose | Expected Response | Error Indicators |
|----------|---------|-------------------|------------------|
| `/api/health` | System status | `{"status": "healthy", "database": "connected"}` | 500 errors, missing components |
| `/admin` | Data source monitoring | Real-time API health grid | Red status indicators |
| `npm run dev:monitor` | Development logs | Stream of request/response logs | Error stack traces |

### Emergency Procedures
1. **System Down**: Check `/api/health` → Restart services → Verify in admin dashboard
2. **Data Quality Issues**: Admin panel → Check fallback status → Enable manual overrides
3. **Performance Degradation**: Monitor memory → Check cache hit rates → Restart if needed
4. **Security Incidents**: Review audit logs → Disable affected endpoints → Apply patches

**📚 Reference Integration**: Always use Context7 MCP for real-time API documentation lookup