# VFR Financial Analysis Platform - AI Agent Quick Start Guide

**Enterprise Financial Intelligence | Next.js 15 | TypeScript 5.2 | React 19 | 15+ Financial APIs**

## Immediate Action Framework for AI Agents

### 🎯 Primary Context
**System Purpose**: Democratize institutional-grade financial analysis through AI-powered multi-source data aggregation
**Business Value**: Transform fragmented market data into actionable BUY/SELL/HOLD recommendations
**Technical Stack**: Production-ready Next.js 15 platform with enterprise security and performance optimization

### ⚡ Instant Setup (30 Seconds)
```bash
# Essential setup sequence
git clone <repository> && cd vfr-api
npm install
cp .env.example .env    # Configure 15+ API keys (see Environment section)
npm run dev:clean       # Auto-resolves port conflicts, starts on 3000

# Verify setup
curl http://localhost:3000/api/health  # Should return {"status": "healthy"}
```

### 🔍 AI Agent Decision Matrix
| Task Type | Immediate Action | Verification | Next Steps |
|-----------|------------------|--------------|------------|
| **Development** | `npm run type-check` | Zero TS errors | Follow TDD with real APIs |
| **Testing** | `npm test` | All 26 tests pass | Check coverage with `npm run test:coverage` |
| **Debugging** | Check `/api/health` + `/admin` | System status green | Use troubleshooting matrix |
| **Deployment** | Verify all API keys | 15+ sources configured | Follow deployment guide |
| **Integration** | Study service layer | Understand fallback patterns | Use API documentation |

## System Context and Mental Model

### Problem-Solution Context
**Market Problem**: Individual investors lack access to institutional-grade analysis tools and real-time comprehensive data
**Technical Solution**: AI-driven analysis engine aggregating 15+ financial data sources with enterprise-grade reliability
**Business Mission**: Democratize sophisticated financial research through single-click actionable insights

### AI Agent Mental Model
**Think of this system as**: A financial intelligence aggregator that transforms fragmented market data into institutional-quality investment recommendations

**Core Data Flow**:
```
User Input → Input Validation → Parallel API Collection → AI Analysis → Cached Results → Actionable Insights
     ↓              ↓                    ↓                ↓            ↓              ↓
Symbol(s)    SecurityValidator    15+ Financial APIs    Weighted    Redis Cache    BUY/SELL/HOLD
Sector       OWASP protection     Premium + Government  Scoring     + In-memory    + Confidence
Multiple     Rate limiting        + Social intelligence 5 Factors   Fallback       + Reasoning
```

**Success Metrics**:
- Sub-3-second analysis completion
- 99.5% uptime via fallback strategies
- 80% security risk reduction (OWASP compliance)
- 85%+ cache hit ratio for performance

## Technology Stack with Context and Decision Rationale

| Category | Technology | Business Purpose | Technical Benefits | AI Agent Considerations |
|----------|------------|------------------|-------------------|------------------------|
| **Frontend** | React 19 + Next.js 15 App Router | Modern user experience | SSR/SSG performance | Use App Router patterns, TypeScript strict |
| **Data Layer** | 15+ APIs with intelligent fallback | Comprehensive market intelligence | Multi-source reliability | Always implement fallback logic |
| **Intelligence** | SEC EDGAR + VWAP + Multi-Reddit sentiment | Institutional-grade insights | Real insider/sentiment data | Respect rate limits, cache aggressively |
| **Performance** | Redis + in-memory caching | Sub-3-second analysis | 85%+ cache hit ratio | Implement cache-aside pattern |
| **Security** | JWT + bcrypt + OWASP validation | Enterprise protection | 80% risk reduction | Validate all inputs, sanitize errors |
| **Interface** | Tailwind CSS + Cyberpunk theme | Professional aesthetics | Component consistency | Follow design system |
| **Quality** | Jest + Playwright + TDD | Production reliability | Real API testing | NO MOCK DATA policy |

### Key Technology Decisions
- **Next.js 15**: Chosen for App Router performance and TypeScript integration
- **Multi-API Strategy**: Ensures 99.5% uptime through intelligent fallbacks
- **Redis Caching**: Critical for meeting sub-3-second analysis targets
- **Real API Testing**: Ensures production reliability (26 test files, 13,200+ lines)

## Architecture

```
app/
├── api/                     # Next.js API routes
│   ├── stocks/             # Stock analysis endpoints
│   ├── admin/              # Admin dashboard APIs
│   └── user_auth/          # JWT authentication
├── services/               # Business logic layer
│   ├── financial-data/     # 15+ API integrations
│   ├── stock-selection/    # Multi-modal analysis
│   ├── security/           # OWASP protection
│   ├── cache/              # Redis + fallback
│   └── error-handling/     # Centralized errors
├── components/             # React UI components
└── [admin|stock-intelligence]/ # Pages
```

**Databases**: PostgreSQL (main), Redis (cache), InfluxDB (optional)

## Development Setup

### Prerequisites & Installation
```bash
# Requirements: Node.js 18+, PostgreSQL, Redis
git clone <repository-url> && cd vfr-api
npm install
cp .env.example .env  # Add API keys

# Database URLs (defaults):
# PostgreSQL: postgresql://postgres:dev_password_123@localhost:5432/vfr_api
# Redis: redis://localhost:6379

npm run dev:clean  # Starts on port 3000
```

## Development Commands

| Category | Command | Purpose |
|----------|---------|---------|
| **Server** | `npm run dev:clean` | Clean start (port conflicts) |
| **Server** | `npm run dev` | Standard development (port 3000) |
| **Quality** | `npm run type-check` | TypeScript validation |
| **Testing** | `npm test` | Jest with memory optimization |
| **Testing** | `npm run test:coverage` | Coverage report |
| **Build** | `npm run build` | Production build |

## Environment Configuration

### Required .env Variables
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

### Data Sources (15+ APIs)
| Tier | Source | Type | Purpose | Status |
|------|--------|------|---------|---------|
| Premium | Polygon, Alpha Vantage, FMP | Paid | Primary data + ratios + VWAP + extended hours | ✅ IMPLEMENTED |
| Enhanced | EODHD, TwelveData | Paid | Secondary + ratios + ESG data | ✅ IMPLEMENTED |
| Government | SEC EDGAR, FRED, BLS, EIA | Free | Institutional/macro/energy | ✅ IMPLEMENTED |
| Social Intelligence | Reddit WSB Multi-Subreddit, Yahoo Finance Sentiment | Free/Paid | High-performance sentiment analysis | ✅ IMPLEMENTED |
| Alternative Data | ESG Providers, FINRA | Free/Paid | ESG scoring + short interest | ✅ IMPLEMENTED |
| Extended Market | Polygon Extended Hours, Bid/Ask | Paid | Pre/post market + liquidity | ✅ IMPLEMENTED |
| Primary | Yahoo Finance REST API | Free | Direct API integration for stocks, fundamentals | ✅ IMPLEMENTED |
| Backup | Yahoo Finance | Free | Multi-tier fallback system | ✅ IMPLEMENTED |

## API Usage

### Key Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | System status |
| `/api/stocks/select` | POST | Stock analysis |
| `/api/ml/early-signal` | POST | ML-powered analyst rating predictions (PRODUCTION) |
| `/api/user_auth` | POST | JWT authentication |
| `/api/admin/data-sources` | GET | API monitoring |

### UI Routes
- `/stock-intelligence` - Multi-modal stock analysis
- `/admin` - Data source management & health monitoring

### Machine Learning Features
- **Early Signal Detection** - ML-powered prediction of analyst rating changes (2-week horizon) ✅ PRODUCTION DEPLOYED
  - Endpoint: `POST /api/ml/early-signal`
  - Model: LightGBM Gradient Boosting v1.0.0 (PRODUCTION-READY)
  - Performance: 97.6% test accuracy, 94.3% validation accuracy, 0.998 AUC
  - Response Time: 600-900ms average (optimization opportunities identified)
  - Training Data: 1,051 examples from real market data (early-signal-combined-1051.csv)
  - Features: 20 engineered features across price momentum, volume, sentiment, fundamentals, technical indicators
  - Top Features: earnings_surprise (36.9%), macd_histogram_trend (27.8%), rsi_momentum (22.5%)
  - Deployment Date: October 2025
  - Integration: Python-Node.js bridge with subprocess model serving

## Testing

### Philosophy & Commands
- **TDD Approach**: Tests before implementation
- **Real Data Only**: NO MOCK DATA policy
- **Memory Optimized**: `maxWorkers: 1` for stability

```bash
npm test                    # All tests (26 test files, 13,200+ lines)
npm run test:coverage      # Coverage report (80% minimum)
npm test -- --testNamePattern="ServiceName"  # Specific test
```

### Integration Test Status
**Comprehensive Test Suite**: ✅ **26 TEST FILES PASSING** (13,200+ lines of test code)
- **VWAP Service**: Volume Weighted Average Price analysis and integration ✅ IMPLEMENTED
- **Yahoo Finance Sentiment API**: High-performance sentiment analysis replacing NewsAPI ✅ IMPLEMENTED
- **Enhanced Reddit API**: Multi-subreddit sentiment analysis with performance testing ✅ IMPLEMENTED
- **Sentiment Analysis**: Yahoo Finance + Reddit WSB integration with <1.5s response time ✅ IMPLEMENTED
- **Macroeconomic Data**: FRED + BLS + EIA integration testing ✅ IMPLEMENTED
- **Currency Data**: International currency analysis validation ✅ IMPLEMENTED
- **Institutional Data**: SEC EDGAR 13F + Form 4 comprehensive integration ✅ IMPLEMENTED
- **ESG Data Service**: ESG scoring with industry-specific baselines ✅ IMPLEMENTED
- **Short Interest Service**: FINRA data integration with squeeze detection ✅ IMPLEMENTED
- **Extended Market Data**: Pre/post market data + bid/ask spread analysis ✅ IMPLEMENTED
- **Security & Performance**: OWASP compliance + memory optimization ✅ IMPLEMENTED

All tests use real APIs with 5-minute timeout for comprehensive integration validation.

## Architecture Details

### Core Services
| Service | File | Purpose | Status |
|---------|------|---------|---------|
| StockSelectionService | `app/services/stock-selection/` | Multi-modal analysis | ✅ IMPLEMENTED |
| VWAPService | `app/services/financial-data/` | Volume Weighted Average Price analysis | ✅ IMPLEMENTED |
| SentimentAnalysisService | `app/services/financial-data/` | Yahoo Finance + Reddit multi-subreddit sentiment | ✅ IMPLEMENTED |
| MacroeconomicAnalysisService | `app/services/financial-data/` | FRED + BLS + EIA integration | ✅ IMPLEMENTED |
| InstitutionalDataService | `app/services/financial-data/` | SEC 13F + Form 4 parsing | ✅ IMPLEMENTED |
| CurrencyDataService | `app/services/financial-data/` | International currency analysis | ✅ IMPLEMENTED |
| ESGDataService | `app/services/financial-data/` | ESG scoring with industry baselines | ✅ IMPLEMENTED |
| ShortInterestService | `app/services/financial-data/` | FINRA short interest + squeeze detection | ✅ IMPLEMENTED |
| ExtendedMarketDataService | `app/services/financial-data/` | Pre/post market data + bid/ask spreads | ✅ IMPLEMENTED |
| YahooFinanceAPI | `app/services/financial-data/` | Direct Yahoo Finance REST API integration | ✅ IMPLEMENTED |
| YahooFinanceSentimentAPI | `app/services/financial-data/providers/` | High-performance sentiment analysis | ✅ IMPLEMENTED |
| FallbackDataService | `app/services/financial-data/` | API orchestration + failover | ✅ IMPLEMENTED |
| SecurityValidator | `app/services/security/` | OWASP protection | ✅ IMPLEMENTED |
| **EarlySignalMLService** | `app/services/ml/early-signal/` | **ML-powered analyst rating predictions** | **✅ PRODUCTION DEPLOYED** |

### Data Flow
1. **Input** → Stock symbols/sectors
2. **Parallel APIs** → 15+ sources via FallbackDataService
3. **AI Analysis** → Proprietary algorithms + institutional intelligence
4. **Cache** → Redis (2min dev, 10min prod) + in-memory fallback
5. **Output** → Actionable insights + BUY/SELL/HOLD recommendations

## Production & Standards

### Environment Differences
| Environment | Cache TTL | Rate Limits | Admin Access |
|-------------|-----------|-------------|--------------|
| Development | 2 minutes | Relaxed | Auto-granted |
| Production | 10 minutes | Strict | JWT Required |

### Development Rules
1. **NO MOCK DATA** - Always use real APIs
2. **TypeScript Strict** - All code must pass strict checks
3. **KISS Principles** - Avoid over-engineering
4. **80% Test Coverage** - Minimum requirement
5. **Performance First** - Core Web Vitals optimization

### Key Documentation
- `docs/vision.md` - Project goals
- `docs/security-architecture.md` - Security implementation
- `docs/error-handling-standards.md` - Error management
- `CLAUDE.md` - AI agent instructions

**License**: Private - Veritak Financial Research LLC