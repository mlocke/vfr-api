# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is Veritak Financial Platform - a Next.js 15 financial analysis and stock prediction platform that aggregates data from 15+ financial APIs to provide institutional-grade investment insights with AI-powered analysis.

## Essential Development Commands

### Development Server
- `npm run dev:clean` - Clean start with port conflict resolution (preferred)
- `npm run dev` - Standard development server on port 3000
- `npm run dev:api` - API-only server on port 3002
- `npm run dev:status` - Check development environment status
- `npm run dev:health` - Daily health check script

### Testing
- `npm test` - Run all tests with memory optimization (26 test files, 13,200+ lines)
- `npm run test:coverage` - Generate coverage report (80% minimum)
- `npm run test:watch` - Watch mode for development
- `npm run test:performance` - Performance-specific tests

### Code Quality
- `npm run type-check` - TypeScript validation (must pass before commits)
- `npm run lint` - ESLint validation
- `npm run format` - Prettier code formatting
- `npm run format:check` - Check formatting without changes

### Build & Production
- `npm run build` - Production build
- `npm start` - Start production server

## Architecture Overview

### Core Structure
```
app/
├── api/                    # Next.js API routes (REST endpoints)
├── services/               # Business logic layer
├── components/             # React UI components
├── [pages]/               # Next.js App Router pages
└── globals.css            # Tailwind CSS styles
```

### Key Service Categories
- **Financial Data Services** (`app/services/financial-data/`) - 15+ API integrations
- **Stock Selection Service** (`app/services/stock-selection/`) - Multi-modal analysis engine
- **Security Layer** (`app/services/security/`) - OWASP compliance and validation
- **Error Handling** (`app/services/error-handling/`) - Centralized error management
- **Cache Management** (`app/services/cache/`) - Redis + in-memory caching

### Data Sources Integration
The platform integrates 15+ financial APIs with intelligent fallback strategies:
- Premium: Polygon, Alpha Vantage, FMP, EODHD, TwelveData
- Government: SEC EDGAR, FRED, BLS, EIA
- Social Intelligence: Reddit WSB, Yahoo Finance Sentiment
- Alternative: ESG providers, FINRA short interest

## Development Guidelines

### Testing Philosophy
- **NO MOCK DATA** policy - all tests use real APIs
- 5-minute timeout for comprehensive integration tests
- Memory optimization with `maxWorkers: 1`
- Test files must be in `__tests__/` directories

### TypeScript Configuration
- Strict mode enabled with `strict: true`
- Path aliases configured: `@/*`, `@/app/*`, `@/components/*`, `@/services/*`
- Target ES2017 for compatibility

### Performance Requirements
- Sub-3-second analysis completion target
- 85%+ cache hit ratio requirement
- Redis caching (2min dev, 10min prod TTL)
- Memory optimization in all services

### Security Standards
- OWASP compliance enforced via SecurityValidator
- JWT authentication for protected routes
- Input validation and sanitization required
- Rate limiting on all API endpoints

## Environment Setup

### Required Environment Variables
```bash
# Core APIs (Required)
ALPHA_VANTAGE_API_KEY=your_key
POLYGON_API_KEY=your_key
FMP_API_KEY=your_key
FRED_API_KEY=your_key

# Database URLs
DATABASE_URL=postgresql://postgres:dev_password_123@localhost:5432/vfr_api
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your_jwt_secret
NODE_ENV=development
```

### Prerequisites
- Node.js 18+
- PostgreSQL database
- Redis cache server
- API keys for 15+ financial data sources

## Important API Endpoints

### Core Endpoints
- `GET /api/health` - System health check
- `POST /api/stocks/select` - Multi-modal stock analysis
- `POST /api/user_auth` - JWT authentication
- `GET /api/admin/data-sources` - API source monitoring

### Admin Routes
- `/admin` - Data source management dashboard
- `/api/admin/test-data-sources` - Test API connectivity

### Analysis Routes
- `/stock-intelligence` - Main analysis interface
- `POST /api/stocks/analyze` - Enhanced stock analysis
- `GET /api/stocks/dialog/[symbol]` - Stock detail dialog

## Development Scripts

The `scripts/` directory contains automation:
- `dev-clean.sh` - Clean development start
- `dev-status.sh` - Environment status check
- `emergency-cleanup.sh` - Port conflict resolution
- `dev-monitor.sh` - Real-time monitoring

## Key Implementation Notes

### Service Layer Pattern
All business logic is in service classes extending `BaseFinancialDataProvider`. Each service implements:
- Intelligent fallback mechanisms
- Rate limiting compliance
- Caching strategies
- Error handling

### Cache Strategy
- Redis primary cache (configurable TTL)
- In-memory fallback cache
- Cache-aside pattern implementation
- Automatic cache invalidation

### Error Handling
Centralized error management through:
- `ErrorHandler` class for consistent responses
- `RetryHandler` for API resilience
- `TimeoutHandler` for performance guarantees
- `Logger` for structured logging

### Real-Time Features
- WebSocket manager for live data
- Real-time portfolio tracking
- Live sentiment analysis updates
- Extended hours market data

## Performance Considerations

### Memory Management
- Memory optimization enforced in tests
- Heap usage monitoring enabled
- Worker memory limits configured
- Garbage collection strategies

### API Rate Limiting
- Built-in rate limiting for all external APIs
- Intelligent request queuing
- Fallback source rotation
- Performance monitoring

## Common Development Tasks

### Adding New Financial Data Source
1. Create service in `app/services/financial-data/`
2. Extend `BaseFinancialDataProvider`
3. Add to `FallbackDataService` configuration
4. Create integration tests with real API
5. Update admin dashboard monitoring

### Implementing New Analysis Feature
1. Add business logic to appropriate service
2. Create API route in `app/api/`
3. Add UI components in `app/components/`
4. Write comprehensive tests
5. Update type definitions

### Debugging API Issues
-- IMPORTANT -- Use api-architect to fix API issues.
1. Check `/api/health` endpoint status
2. Review admin dashboard at `/admin`
3. Check Redis cache connectivity
4. Validate API key configurations
5. Review error logs in structured format
6. NEVER assume the fix works. Test thoroughly and validate.
7. If the issues persist, iterate through the above steps again.

### IMPORTANT
- Always employ all relevant agents in parallel when possible.
- Always follow KISS principles.