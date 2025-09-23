# CLAUDE.md

**AI Agent Instructions for VFR Financial Analysis Platform**

## Quick Reference
- **Rule #1**: NO MOCK DATA - Always use real APIs
- **Platform**: Next.js 15 + TypeScript (App Router)
- **Data Sources**: 12+ financial APIs with fallback patterns
- **Architecture**: Service layer + caching + enterprise security
- **Commands**: `npm run dev:clean` (ports), `npm test` (TDD), `npm run type-check`
- **Key Paths**: `app/services/`, `app/api/`, `docs/`

## Project Identity
**Veritak Financial Research LLC** - Cyberpunk-themed financial analysis platform aggregating 12+ data sources for institutional-grade stock intelligence.

## Architecture

Next.js 15 App Router with TypeScript:

```
app/
├── api/                        # API routes (health, stocks, admin, auth)
│   ├── admin/                  # Admin dashboard APIs (data sources, testing)
│   ├── stocks/                 # Stock analysis and selection APIs
│   ├── health/                 # Health check endpoints
│   ├── user_auth/              # JWT authentication API
│   └── economic/               # Economic data endpoints
├── components/                 # React components (UI, admin, stock selection)
├── services/                   # Core business logic services
│   ├── algorithms/             # Stock analysis algorithms & scheduling
│   ├── auth/                   # Authentication service (JWT, bcrypt)
│   ├── cache/                  # Redis caching with in-memory fallback
│   ├── financial-data/         # Financial data providers (Polygon, Alpha Vantage, etc.)
│   ├── stock-selection/        # Multi-modal stock analysis service
│   ├── admin/                  # Admin configuration management
│   ├── database/               # Database connection and query services
│   ├── security/               # Enterprise-grade security services (validation, rate limiting)
│   ├── error-handling/         # Centralized error handling and logging infrastructure
│   └── types/                  # TypeScript type definitions
├── hooks/                      # React hooks
├── admin/                      # Admin dashboard page
├── stock-intelligence/         # Stock analysis page
└── globals.css                 # Cyberpunk-themed styles
src/
├── components/economic-data/   # Economic data visualization components
├── types/                      # TypeScript type definitions
└── utils/                      # Utility functions
```

## Development Commands

### Essential Commands
- `npm run dev` - Start main development server on port 3000
- `npm run dev:api` - Start API development server on port 3002
- `npm run dev:clean` - Clean development environment and start fresh server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

### Testing Commands
- `npm test` - Run Jest tests with memory optimization (4096MB heap, maxWorkers: 1, runInBand)
- `npm run test:watch` - Run tests in watch mode with memory optimization
- `npm run test:coverage` - Generate comprehensive test coverage report (outputs to docs/test-output/coverage/)
- `npm run test:performance` - Run performance tests with memory monitoring and garbage collection tracking
- `npm run test:performance:single` - Run individual performance test for SentimentAnalysisService
- `npm run test:performance:memory` - Run memory leak prevention tests
- `npm run test:performance:cache` - Run cache performance validation tests
- `npm test -- --testNamePattern="name"` - Run specific test by name
- `npm test -- path/to/test.ts` - Run specific test file
- **Test Isolation**: Tests run with explicit garbage collection and memory leak detection
- **Real API Testing**: All tests use live APIs with 5-minute timeout for comprehensive integration testing

### Integration Test Status
- **Test Suite Scale**: ✅ 26 comprehensive test files with 13,200+ lines of test code
- **VWAPService**: ✅ New comprehensive test suite for VWAP calculations and analysis integration
- **InstitutionalDataService**: ✅ 608-line comprehensive integration test covering error handling, caching, real-time processing, and security
- **MacroeconomicAnalysisService**: ✅ Enhanced test suite for macroeconomic data integration (FRED, BLS, EIA APIs)
- **CurrencyDataService**: ✅ Test suite for international currency data analysis
- **SentimentAnalysisService**: ✅ Production-ready sentiment analysis with NewsAPI + Reddit WSB integration
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

## Data Sources & Services

### Financial Data APIs
| Tier | Source | Rate Limit | Purpose | Files |
|------|--------|------------|---------|-------|
| Premium | Polygon.io, Alpha Vantage, FMP | 250-5000/day | Primary data | `app/services/financial-data/` |
| Enhanced | EODHD, TwelveData | 100k/day, 800/day | Secondary + ratios | `FallbackDataService.ts` |
| Government | SEC EDGAR, FRED, BLS, EIA | Unlimited | Institutional/macro | `SECEdgarAPI.ts` |
| Social Intelligence | Reddit WSB Sentiment | Unlimited | Social sentiment analysis | `RedditAPI.ts` |
| Backup | Yahoo Finance | N/A | Fallback only | Integrated |

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
| MarketSentimentService | `app/services/financial-data/MarketSentimentService.ts` | Comprehensive market sentiment aggregation |
| SectorDataService | `app/services/financial-data/SectorDataService.ts` | Sector-level analysis and performance tracking |
| SecurityValidator | `app/services/security/SecurityValidator.ts` | OWASP Top 10 protection |
| ErrorHandler | `app/services/error-handling/ErrorHandler.ts` | Centralized error management |
| CacheService | `app/services/cache/` | Redis + in-memory fallback |

### Stock Analysis Engine
- **Multi-modal Input**: Single stocks, sectors, or multiple symbols
- **Analysis Algorithms**: Located in `app/services/algorithms/`
- **Selection Service**: `app/services/stock-selection/StockSelectionService.ts`
- **Real-time Processing**: Combines multiple data sources for comprehensive analysis
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
- **Sentiment Analysis**: Production-ready NewsAPI + Reddit integration contributing 10% to composite scoring
- **Macroeconomic Data**: FRED + BLS + EIA integration (20% weight) with real-time economic cycle analysis
- **Institutional Intelligence**: SEC EDGAR 13F + Form 4 insider trading monitoring (10% sentiment weight)
- **Fundamental Analysis**: 15+ ratios with dual-source redundancy (FMP + EODHD) contributing 25% weight
- **Technical Indicators**: Advanced indicators with VWAP integration (40% weight)
- **Economic Calendar**: Economic events processing and calendar data integration
- **Market Indices**: Comprehensive market indices tracking and analysis
- **Sector Data**: Sector-level performance analysis and tracking

#### 🚧 In Development (Based on Active Branch: feature/trading-features)
- **Extended Trading Features**: Pre/post market data, bid/ask spread analysis
- **Short Interest Integration**: FINRA data processing and squeeze detection algorithms

#### 📋 Planned Features (From Analysis Engine Plans)
- **ESG Integration**: Alternative data component (5% weight) - planned implementation
- **Options Data Enhancement**: Put/call ratios and options flow analysis
- **Enhanced Technical Patterns**: Pattern recognition and support/resistance identification

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

### Architecture Patterns
- **Service Layer**: Business logic in `app/services/`
- **Error Handling**: Centralized via `ErrorHandler.ts`
- **Security**: `SecurityValidator` on all endpoints
- **Caching**: Redis + in-memory fallback
- **Performance**: Promise.allSettled parallel execution (83.8% improvement)

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
| VWAP Analysis | `app/services/financial-data/VWAPService.ts` | Volume Weighted Average Price calculations |
| Sentiment Analysis | `app/services/financial-data/SentimentAnalysisService.ts` | News + Reddit WSB sentiment analysis |
| Enhanced Data | `app/services/financial-data/EnhancedDataService.ts` | Enhanced financial data aggregation |
| Institutional Data | `app/services/financial-data/InstitutionalDataService.ts` | 13F + Form 4 parsing |
| Macroeconomic Analysis | `app/services/financial-data/MacroeconomicAnalysisService.ts` | FRED + BLS + EIA data orchestration |
| Currency Data | `app/services/financial-data/CurrencyDataService.ts` | International currency analysis |
| SEC EDGAR | `app/services/financial-data/SECEdgarAPI.ts` | Enhanced SEC integration |
| FRED API | `app/services/financial-data/FREDAPI.ts` | Enhanced Federal Reserve data |
| BLS API | `app/services/financial-data/BLSAPI.ts` | Bureau of Labor Statistics data |
| EIA API | `app/services/financial-data/EIAAPI.ts` | Energy Information Administration data |
| Reddit WSB API | `app/services/financial-data/providers/RedditAPI.ts` | WSB sentiment analysis with performance testing |
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

## Troubleshooting

| Issue | Solution | Command |
|-------|----------|---------|
| Port conflicts | Clean environment | `npm run dev:clean` |
| Redis down | Uses in-memory fallback | Automatic |
| Rate limits | Auto-switches sources | Via FallbackDataService |
| Memory issues | Jest optimization | `maxWorkers: 1` |
| Server issues | Kill httpd processes | Manual kill + restart |

### Debug Endpoints
- `/api/health` - System status
- `/admin` - Real-time API monitoring
- `npm run dev:monitor` - Development logs

**API Documentation**: Always use context7 MCP for API lookups