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
- `npm test -- --testNamePattern="name"` - Run specific test by name
- `npm test -- path/to/test.ts` - Run specific test file
- **Test Isolation**: Tests run with explicit garbage collection and memory leak detection
- **Real API Testing**: All tests use live APIs with 5-minute timeout for comprehensive integration testing

### Integration Test Status
- **Test Suite Scale**: ✅ 17 comprehensive test files with 8,449+ lines of test code
- **InstitutionalDataService**: ✅ 608-line comprehensive integration test covering error handling, caching, real-time processing, and security
- **MacroeconomicAnalysisService**: ✅ New enhanced test suite for macroeconomic data integration (FRED, BLS, EIA APIs)
- **CurrencyDataService**: ✅ New test suite for international currency data analysis
- **Cache Integration**: ✅ RedisCache + in-memory fallback with cache-aside pattern verification
- **Rate Limiting**: ✅ Circuit breaker patterns and concurrent request handling
- **Security Compliance**: ✅ OWASP Top 10 protection with input validation and error sanitization
- **Performance Optimization**: ✅ Memory management with 4096MB heap allocation and maxWorkers: 1
- **Technical Analysis**: ✅ Advanced indicators and signal processing tests

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
| RedditAPI | `app/services/financial-data/providers/RedditAPI.ts` | WSB sentiment analysis with performance testing |
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
- `docs/vision.md` - Project goals
- `docs/security-architecture.md` - Security implementation
- `docs/error-handling-standards.md` - Error management

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