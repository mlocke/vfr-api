# AI Agent Reference - VFR Financial Platform

**Quick Context**: Next.js 15 financial analysis platform aggregating 15+ APIs for institutional-grade stock intelligence.

## Critical Rules & Standards

### Non-Negotiable Rules

1. **NO MOCK DATA** - Always use real APIs
2. **TypeScript Strict** - All code must pass strict checks
3. **KISS Principles** - Avoid over-engineering
4. **Performance First** - <3s analysis target
5. **TDD Approach** - Tests before implementation

### Essential Commands

| Command                 | Purpose                       |
| ----------------------- | ----------------------------- |
| `npm run dev:clean`     | Clean start (port conflicts)  |
| `npm run type-check`    | TypeScript validation         |
| `npm test`              | Jest with memory optimization |
| `npm run test:coverage` | Coverage report (80% minimum) |

## Architecture Overview

### Core Service Files

| Component          | File Path                                                 | Purpose                       |
| ------------------ | --------------------------------------------------------- | ----------------------------- |
| Stock Analysis     | `app/services/stock-selection/StockSelectionService.ts`   | Multi-modal analysis engine   |
| Institutional Data | `app/services/financial-data/InstitutionalDataService.ts` | SEC 13F + Form 4 parsing      |
| SEC EDGAR API      | `app/services/financial-data/SECEdgarAPI.ts`              | Enhanced SEC integration      |
| Security           | `app/services/security/SecurityValidator.ts`              | OWASP Top 10 protection       |
| Error Handling     | `app/services/error-handling/ErrorHandler.ts`             | Centralized error management  |
| Caching            | `app/services/cache/RedisCache.ts`                        | Redis + in-memory fallback    |
| Data Fallback      | `app/services/financial-data/FallbackDataService.ts`      | API orchestration + switching |

### Data Sources (15+ APIs)

| Tier       | Source                      | Rate Limit        | Purpose                     |
| ---------- | --------------------------- | ----------------- | --------------------------- |
| Premium    | Polygon, Alpha Vantage, FMP | 250-5000/day      | Primary data + ratios       |
| Enhanced   | EODHD, TwelveData           | 100k/day, 800/day | Secondary + enhanced ratios |
| Government | SEC EDGAR, FRED, BLS, EIA   | Unlimited         | Institutional/macro         |
| Backup     | Yahoo Finance               | N/A               | Fallback only               |

## Analysis Engine Architecture

### Composite Scoring Weights

```typescript
interface AnalysisResult {
	technical: number; // 40% - RSI, MACD, moving averages
	fundamental: number; // 25% - P/E, ROE, margins, ratios
	macroeconomic: number; // 20% - FRED indicators, Treasury rates
	sentiment: number; // 10% - Institutional + analyst ratings
	alternative: number; // 5% - ESG, short interest
}
```

### Data Flow

1. **Input** → Symbol validation & normalization
2. **Parallel APIs** → 15+ sources via FallbackDataService (Promise.allSettled)
3. **Analysis** → Weighted composite scoring
4. **Cache** → Redis (2min dev, 10min prod) + in-memory fallback
5. **Output** → BUY/SELL/HOLD + confidence scores

### Performance Metrics

- **Response Time**: 0.331s average (83.8% improvement via parallel processing)
- **Cache Strategy**: Multi-tier (Memory → Redis → File)
- **Error Handling**: Circuit breakers + retry with exponential backoff

## Key API Endpoints

| Endpoint                  | Method | Purpose                |
| ------------------------- | ------ | ---------------------- |
| `/api/stocks/select`      | POST   | Stock analysis         |
| `/api/health`             | GET    | System status          |
| `/api/admin/data-sources` | GET    | API monitoring         |
| `/admin`                  | UI     | Data source management |
| `/stock-intelligence`     | UI     | Multi-modal analysis   |

## Error Handling Standards

### Error Classification

```typescript
enum ErrorType {
	VALIDATION = "validation", // Invalid input format
	API_TIMEOUT = "api_timeout", // External API timeouts
	RATE_LIMIT = "rate_limit", // API rate limiting
	SECURITY = "security", // OWASP violations
	DATABASE = "database", // DB connection issues
	CACHE = "cache", // Redis failures
}

enum ErrorSeverity {
	LOW = "low", // Continue normally
	MEDIUM = "medium", // Some functionality affected
	HIGH = "high", // Significant impact
	CRITICAL = "critical", // System-threatening
}
```

### Implementation Pattern

```typescript
try {
	const result = await retryHandler.executeWithRetry(
		() =>
			timeoutHandler.executeWithTimeout(
				() => service.performOperation(),
				15000 // 15s timeout
			),
		{ maxRetries: 3, backoffStrategy: "exponential" }
	);
} catch (error) {
	const standardError = await errorHandler.handleError(error, "service-name", { context });
	throw new ServiceError(standardError.message, standardError.code);
}
```

## Security Implementation

### SecurityValidator Service

- **OWASP Top 10 Protection**: ~80% risk reduction
- **Input Validation**: Regex patterns preventing injection
- **Rate Limiting**: Circuit breaker patterns
- **Data Sanitization**: Secure error handling

### Authentication

- **JWT**: Token-based with bcrypt password hashing
- **Development**: Auto-granted admin access
- **Production**: JWT required for admin endpoints

## Environment Configuration

| Environment | Cache TTL  | Rate Limits | Admin Access |
| ----------- | ---------- | ----------- | ------------ |
| Development | 2 minutes  | Relaxed     | Auto-granted |
| Production  | 10 minutes | Strict      | JWT Required |

### Required .env Variables

```bash
# Core APIs
ALPHA_VANTAGE_API_KEY=your_key
POLYGON_API_KEY=your_key
FMP_API_KEY=your_key
FRED_API_KEY=your_key

# Database
DATABASE_URL=postgresql://postgres:dev_password_123@localhost:5432/vfr_api
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=your_jwt_secret
NODE_ENV=development
```

## Institutional Data Implementation (COMPLETED)

### Services & Files

- **SECEdgarAPI.ts**: Enhanced for 13F holdings + Form 4 insider trading
- **InstitutionalDataService.ts**: Complete institutional intelligence
- **InstitutionalAnalysisEngine.ts**: Sentiment scoring engine
- **InstitutionalCacheManager.ts**: Multi-tier caching strategy

### Key Methods

```typescript
// Institutional intelligence (combined 13F + Form 4)
getInstitutionalIntelligence(symbol: string): Promise<InstitutionalIntelligence>

// 13F quarterly holdings with historical data
getInstitutionalHoldings(symbol: string, quarters: number): Promise<Holding[]>

// Form 4 insider transactions
getInsiderTransactions(symbol: string, days: number): Promise<Transaction[]>

// Sentiment analysis
getInstitutionalSentiment(symbol: string): Promise<SentimentScore>
```

### Integration

- **Weight**: 10% in composite scoring
- **Caching**: 6hrs (holdings), 2hrs (insider), 4hrs (intelligence)
- **Rate Limiting**: SEC EDGAR 10 req/sec compliance

## Testing Standards

### Philosophy

- **TDD**: Tests before implementation
- **Real Data**: NO MOCK DATA policy
- **Memory Optimized**: `maxWorkers: 1` for stability
- **Coverage**: 80% minimum requirement

### Commands

```bash
npm test                              # All tests
npm test -- --testNamePattern="Service"  # Specific service
npm test -- app/services/cache/      # Directory tests
npm run test:coverage                 # Coverage report
```

## Troubleshooting

| Issue          | Solution                   | Command                 |
| -------------- | -------------------------- | ----------------------- |
| Port conflicts | Clean environment          | `npm run dev:clean`     |
| Redis down     | Uses in-memory fallback    | Automatic               |
| Rate limits    | Auto-switches sources      | Via FallbackDataService |
| Memory issues  | Jest optimization          | `maxWorkers: 1`         |
| API failures   | Circuit breaker activation | Check admin dashboard   |

### Debug Endpoints

- `/api/health` - System status
- `/admin` - Real-time API monitoring
- `npm run dev:monitor` - Development logs

## Next Implementation Priorities

### High Priority (Weeks 3-4)

1. **Macroeconomic Enhancement**: Expand FREDAPI for GDP, CPI, money supply
2. **Currency/Commodity Data**: Dollar Index, oil/gold prices via EIA

### Medium Priority (Weeks 5-8)

1. **Sentiment Analysis**: Reddit WSB, Google Trends, news sentiment
2. **Technical Indicators**: Complete RSI/MACD integration
3. **Short Interest**: FINRA data for squeeze detection

### Development Pattern for New Services

1. Extend `BaseFinancialDataProvider`
2. Implement error handling via `ErrorHandler`
3. Add Redis caching with appropriate TTL
4. Integrate via `FallbackDataService`
5. Add to composite scoring algorithm
6. Write real API integration tests
7. Update documentation and type definitions

**Rule**: Every new feature must maintain <3s analysis response time and follow existing architectural patterns.
