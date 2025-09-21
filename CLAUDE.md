# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT** Number 1 rule: NO MOCK DATA!! ANYWHERE!! EVER!!

Veritak Financial Research LLC - A Next.js 15 cyberpunk-themed financial analysis platform aggregating 12+ data sources. See `docs/vision.md` for project vision.

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
- `npm test` - Run Jest tests with memory optimization (maxWorkers: 1)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report
- `npm test -- --testNamePattern="name"` - Run specific test by name
- `npm test -- path/to/test.ts` - Run specific test file

### Development Utilities
- `npm run dev:port-check` - Check if port 3000 is available
- `npm run dev:kill` - Kill all development processes
- `npm run dev:status` - Check development server status
- `npm run dev:monitor` - Monitor development server
- `npm run dev:health` - Run daily health check
- `./scripts/dev-clean.sh` - Clean development environment script

## Key Services & Architecture

### Financial Data Layer
- **Primary Sources**: Polygon.io, Alpha Vantage, Financial Modeling Prep (premium APIs)
- **Enhanced Sources**: EODHD (100k req/day), TwelveData (800 req/day free)
- **Secondary Sources**: Yahoo Finance (backup/fallback)
- **Government APIs**: SEC EDGAR, FRED (Treasury rates), Bureau of Labor Statistics, EIA
- **Analyst Data**: Financial Modeling Prep (consensus ratings, price targets, rating changes)
- **Fundamental Ratios**: Dual-source capability - Financial Modeling Prep (250 req/day) + EODHD (100k req/day when paid) providing 15 key ratios: P/E, P/B, ROE, ROA, debt ratios, margins, dividend metrics
- **Treasury Analysis**: Enhanced yield curve analysis via FRED API (unlimited/free)
- **Enterprise Security**: SecurityValidator service with OWASP Top 10 protection (~80% risk reduction)
- **Performance Optimization**: Promise.allSettled parallel execution (83.8% improvement)
- **Fallback Strategy**: Automatic source switching with rate limiting and error handling
- **Location**: `app/services/financial-data/` (individual API classes and FallbackDataService)

### Stock Analysis Engine
- **Multi-modal Input**: Single stocks, sectors, or multiple symbols
- **Analysis Algorithms**: Located in `app/services/algorithms/`
- **Selection Service**: `app/services/stock-selection/StockSelectionService.ts`
- **Real-time Processing**: Combines multiple data sources for comprehensive analysis
- **Analyst Integration**: Real-time analyst ratings, price targets, and sentiment scoring
- **Fundamental Analysis**: 15 key fundamental ratios integrated into analysis (P/E, P/B, ROE, margins, liquidity ratios) with dual-source redundancy (FMP + EODHD)
- **Intelligence Features**: Analyst-based and fundamental-based warnings, opportunities, and upside calculations

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
- **Real-time Testing**: Direct API calls with comprehensive test types
- **Performance Monitoring**: Response times, success rates, error tracking
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
- **Framework**: Jest with ts-jest preset
- **Memory Optimization**: `maxWorkers: 1` and explicit garbage collection
- **Pattern**: `**/__tests__/**/*.test.ts`
- **Coverage**: Outputs to `docs/test-output/coverage/`

### Testing Philosophy
- **TDD Approach**: Tests written before implementation
- **Real Data Only**: Always use real APIs, never mock data
- **Memory Management**: Tests run with increased heap size (4096MB)

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

## Environment Configuration

### Development vs Production
| Environment | Cache TTL | Rate Limits | Data Quality | Admin Access | Analyst Data |
|-------------|-----------|-------------|--------------|--------------|---------------|
| Development | 2 minutes | Relaxed     | Basic        | Auto-granted | Daily refresh |
| Production  | 10 minutes| Strict      | Enhanced     | JWT Required | Daily refresh |

### Required Environment Variables
- **API Keys**: Alpha Vantage, Polygon, Financial Modeling Prep, FRED, etc.
- **Database URLs**: PostgreSQL, Redis, InfluxDB connections
- **Security**: JWT secrets, bcrypt salt rounds
- **Application**: Debug flags, log levels, rate limiting

## Development Guidelines

### Code Standards
- **KISS Principles**: Avoid over-engineering, prioritize simplicity
- **TypeScript Strict**: All code must pass TypeScript strict checks
- **No Comments**: Code should be self-documenting
- **Real Data**: Never use mock data - always connect to real APIs
- **Performance First**: Optimize for Core Web Vitals and response times

### Architecture Patterns
- **Service Layer**: All business logic isolated in service classes
- **Dependency Injection**: Services initialized through ServiceInitializer
- **Error Handling**: Centralized ErrorHandler with standardized error types, codes, and severity levels
- **Security First**: SecurityValidator integration across all API endpoints
- **Performance Optimized**: Promise.allSettled parallel execution patterns (83.8% improvement)
- **Production Ready**: Circuit breaker patterns and retry mechanisms with exponential backoff
- **Caching Strategy**: Multi-layer caching with intelligent invalidation
- **KISS Principles**: Clean architecture with single responsibility classes

### Development Workflow
1. Run `npm run dev:clean` for port conflicts or fresh start
2. Use `npm run type-check` before committing
3. Run test suite with `npm test` to ensure no regressions
4. For server issues: Kill all httpd processes, then restart Next.js dev server

## Important File Locations

### Core Services
- **Stock Selection**: `app/services/stock-selection/StockSelectionService.ts`
- **Authentication**: `app/services/auth/AuthService.ts`
- **Caching**: `app/services/cache/RedisCache.ts` and `InMemoryCache.ts`
- **Data Sources**: `app/services/financial-data/` (individual API classes)
- **Fallback Service**: `app/services/financial-data/FallbackDataService.ts`
- **Security**: `app/services/security/SecurityValidator.ts` (enterprise-grade protection)
- **Error Handling**: `app/services/error-handling/ErrorHandler.ts` (centralized error management)
- **Base Provider**: `app/services/financial-data/BaseFinancialDataProvider.ts` (reusable API patterns)
- **Logging**: `app/services/error-handling/Logger.ts` (structured logging with sanitization)
- **Retry Logic**: `app/services/error-handling/RetryHandler.ts` (configurable retry mechanisms)

### Configuration Files
- **Jest**: `jest.config.js` (memory optimization settings)
- **TypeScript**: `tsconfig.json` (strict mode configuration)
- **Next.js**: `next.config.js` (framework configuration)
- **Environment**: `.env` (API keys and database URLs)

### Documentation
- **Vision**: `docs/vision.md` - Project goals and problem statement
- **Standards**: `docs/claude-standards.md` and `docs/comprehensive-coding-standards.md`
- **Architecture**: `docs/database-architecture.md` and `docs/implementation-guide.md`
- **Security**: `docs/security-architecture.md` - Enterprise security implementation
- **Performance**: `docs/performance-optimizations.md` - 83.8% performance improvements
- **Error Handling**: `docs/error-handling-standards.md` - Standardized error management

## Troubleshooting

### Common Issues
- **Port Conflicts**: Use `npm run dev:clean` to reset development environment
- **Redis Connection**: Application works with in-memory fallback if Redis unavailable
- **API Rate Limits**: FallbackDataService automatically switches between sources
- **Memory Issues**: Jest configured with memory optimization for stability

### Debug Tools
- **Health Check**: `/api/health` endpoint for system status
- **Admin Dashboard**: `/admin` for real-time API monitoring
- **Test Scripts**: Various test files in root directory for debugging specific APIs
- **Logs**: Development logs available via `npm run dev:monitor`

### API Lookup  
- For API documentation always use context7 MCP.