# VFR Financial Analysis Platform - System Architecture

**Created**: 2025-09-30
**Purpose**: Comprehensive system architecture documentation providing context-first understanding of VFR platform design, data flow, and operational patterns

## When to Use This Document

**Primary Use Cases**:

- Understanding system-wide architecture and design patterns
- Designing new services or features that integrate with existing system
- Making architectural decisions about data flow or service communication
- Debugging cross-service issues or data flow problems
- Onboarding new developers to the platform
- Planning infrastructure changes or scaling strategies

**Related Documents**:

- `SERVICE_DOCUMENTATION.md` - Detailed service implementation specs
- `API_DOCUMENTATION.md` - REST API endpoint specifications
- `DEPLOYMENT_CONFIGURATION.md` - Infrastructure and deployment
- `analysis-engine/CLAUDE.md` - Analysis engine specifics

## Overview

The VFR (Veritak Financial Research) Platform is a cyberpunk-themed, institutional-grade financial analysis system built on Next.js 15 with TypeScript. The platform aggregates data from 15+ financial APIs to provide comprehensive stock intelligence for institutional and retail investors.

## Architecture Principles

### Core Design Philosophy

- **Context-First**: Every component provides business context before technical implementation
- **Real Data Only**: No mock data - all services connect to live APIs
- **Performance-Optimized**: Promise.allSettled parallel execution achieving 83.8% performance improvement
- **Enterprise Security**: OWASP Top 10 protection with ~80% risk reduction
- **Fault Tolerance**: Multi-tier fallback systems with automatic API switching

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
│  Next.js 15 App Router + TypeScript + Tailwind CSS            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Admin     │ │   Stock     │ │   Market    │               │
│  │ Dashboard   │ │Intelligence │ │ Overview    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                         API Gateway                             │
│                    Next.js API Routes                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   /admin    │ │   /stocks   │ │  /economic  │               │
│  │   /health   │ │   /market   │ │  /currency  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
│           Business Logic & Data Orchestration                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Stock     │ │ Financial   │ │ Technical   │               │
│  │ Selection   │ │    Data     │ │  Analysis   │               │
│  │  Service    │ │  Services   │ │  Service    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ Algorithm   │ │   Cache     │ │  Security   │               │
│  │   Engine    │ │  Service    │ │ Validator   │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌──────────────────────────────────────────────┐ ✅ NEW       │
│  │   Machine Learning Services (PRODUCTION)    │               │
│  │   Early Signal Detection - LightGBM v1.0.0  │               │
│  └──────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                     Data Provider Layer                         │
│                  12+ Financial Data APIs                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  Polygon.io │ │Alpha Vantage│ │    FMP      │               │
│  │   (Primary) │ │ (Secondary) │ │ (Enhanced)  │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  SEC EDGAR  │ │    FRED     │ │ Reddit WSB  │               │
│  │(Regulatory) │ │ (Macro Econ)│ │ (Sentiment) │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                                │
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │ PostgreSQL  │ │    Redis    │ │  InfluxDB   │               │
│  │ (App Data)  │ │  (Cache)    │ │(Time Series)│               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
```

## Service Layer Architecture

### Core Services

#### 1. Stock Selection Service (`app/services/stock-selection/`)

**Purpose**: Multi-modal stock analysis engine supporting single stocks, sectors, and portfolio analysis

**Key Components**:

- `StockSelectionService.ts` - Main orchestration service
- `AlgorithmIntegration.ts` - Algorithm engine integration
- `SectorIntegration.ts` - Sector-based analysis
- `SelectionCache.ts` - Result caching with TTL management

**Data Flow**:

```
User Input → Security Validation → Service Orchestration →
Parallel API Calls → Data Aggregation → Algorithm Processing →
Cache Storage → Response Formatting
```

#### 2. Financial Data Services (`app/services/financial-data/`)

**Purpose**: Real-time financial data aggregation from 12+ providers

**Primary APIs**:

- **Polygon.io**: Real-time market data, VWAP calculations
- **Alpha Vantage**: Technical indicators, fundamental data
- **Financial Modeling Prep**: Enhanced ratios, analyst ratings
- **SEC EDGAR**: 13F filings, Form 4 insider trading
- **FRED**: Macroeconomic indicators
- **Reddit WSB**: Sentiment analysis

**Fallback Strategy**:

```
Primary API → Secondary API → Tertiary API → Cache Fallback → Error Response
```

#### 3. Technical Analysis Service (`app/services/technical-analysis/`)

**Purpose**: Advanced technical indicator calculations

**Capabilities**:

- VWAP analysis with multi-timeframe support
- Moving averages (SMA, EMA)
- Momentum indicators (RSI, MACD)
- Volume analysis
- Price pattern recognition

#### 4. Machine Learning Service (`app/services/ml/early-signal/`) ✅ NEW

**Purpose**: Production-grade ML-powered analyst rating change prediction

**Architecture**:

- **Model**: LightGBM Gradient Boosting v1.0.0
- **Performance**: 97.6% test accuracy, 94.3% validation accuracy, 0.998 AUC
- **Deployment**: Python-Node.js subprocess bridge for model serving
- **Features**: 20 engineered features (earnings, technical, sentiment, fundamentals)
- **API**: `POST /api/ml/early-signal` with 600-900ms response time
- **Status**: PRODUCTION DEPLOYED (October 2, 2025)

**Key Capabilities**:

- 2-week analyst upgrade/downgrade prediction
- 100% recall (catches all upgrade opportunities)
- Feature importance analysis (earnings_surprise 36.9%, macd_histogram 27.8%, rsi_momentum 22.5%)
- Real-time prediction with feature caching
- Comprehensive integration testing (4/4 scenarios passed)

#### 5. Cache Service (`app/services/cache/`)

**Purpose**: High-performance caching with Redis primary and in-memory fallback

**Architecture**:

- **Primary**: Redis with configurable TTL (2min dev, 10min prod)
- **Fallback**: In-memory cache for high availability
- **Strategy**: Cache-aside pattern with automatic invalidation
- **ML Extension**: Feature caching for ML prediction optimization

## Data Flow Architecture and Decision Trees

### Request Processing Pipeline with Decision Points

```
User Request → Security Gate → Rate Limit → Cache Check → Service Layer → Response
     ↓             ↓              ↓            ↓             ↓            ↓
  Validate     Check JWT      Check quota   Lookup key   Orchestrate  Format
  ├─ Valid     ├─ Valid       ├─ Under     ├─ Hit →     ├─ Parallel  ├─ Success
  └─ Invalid   ├─ Invalid     ├─ Over →    └─ Miss →    ├─ Fallback  └─ Error
     ↓            ↓ 401          ↓ 429         ↓           ↓
   400 Error    Reject         Retry-After   API Calls   Cache + Return
```

### Data Flow Decision Tree for API Aggregation

```
Data Request Initiated
    ↓
Determine Data Requirements
    ├─ Technical Data → Polygon → Alpha Vantage → FMP → Cache → Error
    ├─ Fundamental Data → FMP → EODHD → Alpha Vantage → Cache → Error
    ├─ Macro Data → FRED → BLS → EIA → Cache → Skip
    ├─ Sentiment Data → News API → Reddit → Yahoo → Default Neutral
    └─ Regulatory Data → SEC EDGAR → FMP → Skip
    ↓
Execute Parallel API Calls (Promise.allSettled)
    ├─ All Success → Merge data with quality scoring
    ├─ Partial Success → Use available data, log failures, adjust confidence
    └─ All Failed → Use cache if available, else return error with explanation
    ↓
Data Quality Validation
    ├─ Timestamp fresh (<10min) → Proceed
    ├─ Stale data (>10min) → Flag in response, lower confidence
    └─ Invalid/corrupt data → Discard, use fallback source
    ↓
Algorithm Processing → Cache Storage → Response
```

### Multi-API Data Aggregation Strategy

**Execution Pattern**:

1. **Parallel Execution**: Promise.allSettled for concurrent API calls (83.8% performance improvement)
2. **Quality Scoring**: Each data source receives quality scores (1-10) based on reliability, latency, freshness
3. **Fallback Logic**: Automatic switching on API failures following priority chain
4. **Data Fusion**: Intelligent merging when multiple sources provide same data (weighted by quality)
5. **Validation**: Real-time data quality checks (schema validation, timestamp verification, range checking)

### Fallback Chain Decision Matrix

| Data Type                | Primary Source | Secondary     | Tertiary      | Cache Fallback  | Final Action            |
| ------------------------ | -------------- | ------------- | ------------- | --------------- | ----------------------- |
| **Real-time Prices**     | Polygon        | Alpha Vantage | FMP           | Last known      | Error if >1hr old       |
| **Technical Indicators** | Alpha Vantage  | Polygon       | TwelveData    | Calculated      | Error if no source      |
| **Fundamental Ratios**   | FMP            | EODHD         | Alpha Vantage | Last quarter    | Error if >1 quarter     |
| **Macroeconomic**        | FRED           | BLS           | EIA           | Last release    | Skip if unavailable     |
| **Sentiment**            | News API       | Reddit        | Yahoo         | Neutral default | Use neutral if all fail |
| **Regulatory (13F)**     | SEC EDGAR      | FMP           | None          | Last filing     | Skip if unavailable     |

## Security Architecture

### OWASP Top 10 Protection

**Implementation**: `app/services/security/SecurityValidator.ts`

1. **Input Validation**: Symbol validation with regex patterns
2. **SQL Injection Prevention**: Parameterized queries
3. **XSS Protection**: Content sanitization
4. **Authentication**: JWT-based with bcrypt password hashing
5. **Rate Limiting**: Circuit breaker patterns
6. **Error Handling**: Secure error messages preventing information disclosure

### API Security Patterns

```typescript
// Example: Secure API endpoint pattern
export async function POST(request: Request) {
	try {
		// 1. Input validation
		const validatedInput = SecurityValidator.validateStockSymbols(input);

		// 2. Rate limiting
		await rateLimiter.checkLimit(clientId);

		// 3. Business logic execution
		const result = await service.processRequest(validatedInput);

		// 4. Secure response
		return SecurityValidator.sanitizeResponse(result);
	} catch (error) {
		// 5. Secure error handling
		return ErrorHandler.handleSecurely(error);
	}
}
```

## Performance Optimization and Targets

### Performance Targets Quick Reference Table

| Metric Category           | Development Target | Production Target | Current Achievement | Monitoring Method    |
| ------------------------- | ------------------ | ----------------- | ------------------- | -------------------- |
| **Single Stock Analysis** | <1s                | <500ms            | ✅ ~400ms avg       | `/api/health` timing |
| **Multi-Stock Analysis**  | <3s                | <2s               | ✅ ~1.8s avg        | Performance tests    |
| **VWAP Calculation**      | <300ms             | <200ms            | ✅ ~150ms avg       | Service metrics      |
| **Cache Hit Ratio**       | >80%               | >85%              | ✅ ~87%             | Redis INFO stats     |
| **Memory Usage (Heap)**   | <4GB               | <6GB              | ✅ ~3.2GB avg       | Node heap metrics    |
| **API Availability**      | >95%               | >99.5%            | ✅ ~99.7%           | Admin dashboard      |
| **Error Rate**            | <5%                | <1%               | ✅ ~0.3%            | Error logs           |

### Caching Strategy with Decision Logic

**Multi-Layer Caching**:

```
Data Request
    ↓
Layer 1: In-Memory Cache (fastest, smallest)
    ├─ Hit → Return immediately (<10ms)
    └─ Miss ↓
Layer 2: Redis Cache (fast, shared across instances)
    ├─ Hit → Return + update in-memory cache (<50ms)
    └─ Miss ↓
Layer 3: Database Cache (slower, persistent)
    ├─ Hit → Return + update Redis + in-memory (<200ms)
    └─ Miss ↓
Layer 4: External API Call (slowest, most complete)
    └─ Success → Return + update all cache layers
    └─ Failure → Check stale cache, else error
```

**Cache TTL Configuration by Data Type**:
| Data Type | Development TTL | Production TTL | Rationale |
|-----------|-----------------|----------------|-----------|
| **Real-time Prices** | 30s | 30s | Market moves continuously |
| **Technical Indicators** | 2min | 5min | Intraday updates sufficient |
| **Fundamental Ratios** | 10min | 1hr | Updated quarterly, slow-changing |
| **Macroeconomic Data** | 10min | 1hr | Updated monthly, very stable |
| **Analyst Ratings** | 5min | 30min | Updated weekly, moderately stable |
| **News Sentiment** | 2min | 5min | High velocity, frequent updates |

### Memory Management

**Jest Configuration** (`jest.config.js`):

- Heap Size: 4096MB allocation
- Garbage Collection: Explicit GC with `--expose-gc`
- Concurrency: `maxWorkers: 1` for memory optimization
- Execution: `runInBand` for sequential test execution

## Integration Patterns

### API Provider Integration

**Base Provider Pattern**:

```typescript
abstract class BaseFinancialDataProvider {
	abstract async getStockData(symbol: string): Promise<StockData>;
	abstract async validateConnection(): Promise<boolean>;
	abstract getRateLimit(): RateLimitInfo;
}
```

**Concrete Implementation**:

```typescript
export class PolygonAPI extends BaseFinancialDataProvider {
	async getStockData(symbol: string): Promise<StockData> {
		// Implementation with error handling, rate limiting, caching
	}
}
```

### Fallback Mechanism

**Priority-Based Fallback**:

1. **Tier 1**: Polygon.io, Alpha Vantage (Premium APIs)
2. **Tier 2**: FMP, EODHD (Enhanced APIs)
3. **Tier 3**: Yahoo Finance (Backup)
4. **Tier 4**: Cache fallback
5. **Tier 5**: Graceful degradation

## Environment Configuration

### Development vs Production

| Aspect            | Development  | Production   |
| ----------------- | ------------ | ------------ |
| Cache TTL         | 2 minutes    | 10 minutes   |
| Rate Limits       | Relaxed      | Strict       |
| Admin Access      | Auto-granted | JWT Required |
| Logging Level     | Debug        | Info         |
| Memory Allocation | 4GB          | 8GB+         |

### Required Environment Variables

```bash
# API Keys
ALPHA_VANTAGE_API_KEY=your_key
POLYGON_API_KEY=your_key
FMP_API_KEY=your_key
FRED_API_KEY=your_key

# Database URLs
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
INFLUXDB_URL=http://...

# Security
JWT_SECRET=your_secret
BCRYPT_ROUNDS=12

# Features
ENABLE_ADMIN_AUTO_ACCESS=true
ENABLE_PERFORMANCE_MONITORING=true
```

## Quality Assurance

### Testing Strategy

**Test Architecture**:

- **Unit Tests**: Individual service testing
- **Integration Tests**: Real API testing with 5-minute timeouts
- **Performance Tests**: Memory leak detection and optimization
- **Security Tests**: OWASP compliance validation

**Current Test Coverage**:

- Service Layer: 85%+ coverage
- API Endpoints: 90%+ coverage
- Security Components: 95%+ coverage
- Critical Paths: 100% coverage

### Performance Metrics

**Response Time Targets**:

- Single Stock Analysis: <500ms
- Multi-Stock Analysis: <2s
- Sector Analysis: <3s
- VWAP Calculations: <200ms additional latency

**Availability Targets**:

- Primary APIs: 99.9% uptime
- Cache Layer: 99.99% uptime
- Overall System: 99.5% uptime

## Monitoring and Observability

### Health Check System

**Endpoint**: `/api/health`
**Monitoring**:

- Database connectivity
- Redis availability
- External API status
- Memory usage
- Response times

### Admin Dashboard

**Location**: `/admin`
**Capabilities**:

- Real-time API status monitoring
- Data source toggling
- Performance metrics
- Error rate tracking
- Cache hit ratio analysis

## Deployment Architecture

### Infrastructure Requirements

**Minimum Production Requirements**:

- **CPU**: 4 cores
- **Memory**: 8GB RAM
- **Storage**: 100GB SSD
- **Network**: 1Gbps
- **Redis**: 2GB memory allocation
- **PostgreSQL**: 50GB storage

### Scalability Considerations

**Horizontal Scaling**:

- Stateless service design
- Redis-based session management
- Load balancer compatibility
- Database connection pooling

**Vertical Scaling**:

- Memory optimization patterns
- CPU-intensive calculation optimization
- Database query optimization
- Cache efficiency improvements

This architecture document serves as the foundation for understanding the VFR Financial Analysis Platform's technical implementation and provides context for all subsequent service and API documentation.
