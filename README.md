# VFR Financial Analysis Platform

**Created**: 2025-10-11
**Stack**: Next.js 15 | TypeScript 5.2 | React 19 | 15+ Financial APIs
**Mission**: Democratize institutional-grade financial analysis through AI-powered multi-source aggregation

## Instant Setup (30s)

```bash
git clone <repository> && cd vfr-api
npm install
cp .env.example .env    # Configure 15+ API keys
npm run dev:clean       # Auto-resolves port conflicts, starts on :3000

# Verify
curl http://localhost:3000/api/health  # Should return {"status": "healthy"}
```

## AI Agent Decision Matrix

| Task           | Action                     | Verification               | Next Steps                  |
| -------------- | -------------------------- | -------------------------- | --------------------------- |
| **Dev**        | `npm run type-check`       | Zero TS errors             | Follow TDD with real APIs   |
| **Testing**    | `npm test`                 | All 26 tests pass          | `npm run test:coverage`     |
| **Debug**      | Check `/api/health`+`/admin` | System status green        | Use troubleshooting matrix  |
| **Deploy**     | Verify all API keys        | 15+ sources configured     | Follow deployment guide     |
| **Integration** | Study service layer        | Understand fallback patterns | Use API documentation       |

## System Context

**Problem**: Individual investors lack institutional-grade analysis tools
**Solution**: AI-driven analysis engine aggregating 15+ financial data sources
**Mission**: Democratize sophisticated financial research through single-click insights

**Core Data Flow**:
```
User Input → Validation → Parallel API Collection → AI Analysis → Cached Results → Actionable Insights
Symbol(s) → SecurityValidator → 15+ Financial APIs → Weighted Scoring → Redis+Fallback → BUY/SELL/HOLD
```

**Success Metrics**: Sub-3s analysis, 99.5% uptime (fallback strategies), 80% security risk reduction (OWASP), 85%+ cache hit ratio

## Technology Stack

| Category         | Technology                 | Purpose                       | AI Agent Considerations                    |
| ---------------- | -------------------------- | ----------------------------- | ------------------------------------------ |
| **Frontend**     | React 19 + Next.js 15      | Modern UX                     | Use App Router patterns, TypeScript strict |
| **Data**         | 15+ APIs + intelligent fallback | Comprehensive intelligence | Always implement fallback logic            |
| **Intelligence** | SEC EDGAR + VWAP + Reddit  | Institutional-grade insights  | Respect rate limits, cache aggressively    |
| **Performance**  | Redis + in-memory caching  | Sub-3s analysis               | Implement cache-aside pattern              |
| **Security**     | JWT + bcrypt + OWASP       | Enterprise protection         | Validate all inputs, sanitize errors       |
| **Interface**    | Tailwind CSS + Cyberpunk   | Professional aesthetics       | Follow design system                       |
| **Quality**      | Jest + Playwright + TDD    | Production reliability        | NO MOCK DATA policy                        |

**Key Decisions**: Next.js 15 (App Router), Multi-API (99.5% uptime), Redis (sub-3s targets), Real API Testing (26 files, 13,200+ lines)

## Architecture

```
app/
├── api/                     # Next.js API routes
│   ├── stocks/             # Analysis endpoints
│   ├── admin/              # Admin dashboard
│   └── user_auth/          # JWT auth
├── services/               # Business logic
│   ├── financial-data/     # 15+ API integrations
│   ├── stock-selection/    # Multi-modal analysis
│   ├── security/           # OWASP protection
│   ├── cache/              # Redis + fallback
│   └── error-handling/     # Centralized errors
├── components/             # React UI
└── [admin|stock-intelligence]/ # Pages
```

**Databases**: PostgreSQL (main), Redis (cache), InfluxDB (optional)

## Development Commands

| Category    | Command                 | Purpose                      |
| ----------- | ----------------------- | ---------------------------- |
| **Server**  | `npm run dev:clean`     | Clean start (port conflicts) |
| **Server**  | `npm run dev`           | Standard dev (port 3000)     |
| **Quality** | `npm run type-check`    | TypeScript validation        |
| **Testing** | `npm test`              | Jest with memory optimization |
| **Testing** | `npm run test:coverage` | Coverage report              |
| **Build**   | `npm run build`         | Production build             |

## Environment Configuration

```bash
# Core APIs (Required)
ALPHA_VANTAGE_API_KEY=key
POLYGON_API_KEY=key
FMP_API_KEY=key
FRED_API_KEY=key

# Database
DATABASE_URL=postgresql://postgres:dev_password_123@localhost:5432/vfr_api
REDIS_URL=redis://localhost:6379

# Security
SECRET_KEY=jwt_secret
NODE_ENV=development
```

## Data Sources (15+ APIs)

| Tier                | Source                  | Type      | Purpose                   | Status         |
| ------------------- | ----------------------- | --------- | ------------------------- | -------------- |
| Premium             | Polygon, Alpha Vantage, FMP | Paid  | Primary + VWAP + extended hours | ✅ IMPLEMENTED |
| Enhanced            | EODHD, TwelveData       | Paid      | Secondary + ESG           | ✅ IMPLEMENTED |
| Government          | SEC EDGAR, FRED, BLS, EIA | Free    | Institutional/macro/energy | ✅ IMPLEMENTED |
| Social Intelligence | Reddit WSB Multi, Yahoo Sentiment | Free/Paid | High-performance sentiment | ✅ IMPLEMENTED |
| Alternative         | ESG Providers, FINRA    | Free/Paid | ESG + short interest      | ✅ IMPLEMENTED |
| Extended Market     | Polygon Extended, Bid/Ask | Paid    | Pre/post market + liquidity | ✅ IMPLEMENTED |
| Primary             | Yahoo Finance REST      | Free      | Direct API integration    | ✅ IMPLEMENTED |
| Backup              | Yahoo Finance           | Free      | Multi-tier fallback       | ✅ IMPLEMENTED |

## Key Endpoints

| Endpoint                  | Method | Purpose                               |
| ------------------------- | ------ | ------------------------------------- |
| `/api/health`             | GET    | System status                         |
| `/api/stocks/analyze`     | POST   | Comprehensive stock analysis (MLEnhancedStockSelectionService) |
| `/api/ml/early-signal`    | POST   | ML-powered analyst rating predictions |
| `/api/user_auth`          | POST   | JWT authentication                    |
| `/api/admin/data-sources` | GET    | API monitoring                        |

**UI Routes**: `/stock-intelligence` (analysis), `/admin` (management)

## Machine Learning

**ML Ensemble** - 4-model weighted voting system for stock analysis ✅ PRODUCTION (Updated Oct 13, 2025)
- Endpoint: `POST /api/stocks/analyze` with `include_ml=true`
- Architecture: Weighted voting ensemble with confidence-based consensus
- Models: 4 deployed models running in parallel
  1. **Sentiment Fusion** (v1.1.0) - 45% weight, 45 features, 53.8% accuracy
  2. **Price Prediction** (v1.1.0) - 27% weight, 35 features
  3. **Early Signal Detection** (v1.0.0) - 18% weight, 28 features, 97.6% accuracy
  4. **Smart Money Flow** (v3.0.0) - 10% weight, 27 features, R² 1.67% ✨ NEW
- Integration: Parallel execution via `RealTimePredictionEngine.predictEnsemble()`
- Output: Consensus signal (BULLISH/BEARISH/NEUTRAL) with confidence and model vote breakdown
- Performance: Sub-500ms ensemble prediction with Redis caching
- Documentation: See `ML_ENSEMBLE_ARCHITECTURE_REPORT.md` and `ML_ENSEMBLE_SUMMARY.md`

**Individual Model Endpoints** (legacy, standalone access):
- `POST /api/ml/early-signal` - Analyst rating predictions
- Feature toggles available in admin dashboard for individual model control

## Testing

**Philosophy**: TDD, Real Data Only (NO MOCK DATA), Memory Optimized (`maxWorkers: 1`)

```bash
npm test                    # All tests (26 files, 13,200+ lines)
npm run test:coverage      # Coverage (80% minimum)
npm test -- --testNamePattern="ServiceName"  # Specific test
```

**Comprehensive Suite**: ✅ **26 TEST FILES PASSING**
- VWAP Service ✅
- Yahoo Finance Sentiment API ✅
- Enhanced Reddit API ✅
- Sentiment Analysis (<1.5s response) ✅
- Macroeconomic Data ✅
- Currency Data ✅
- Institutional Data (SEC EDGAR 13F + Form 4) ✅
- ESG Data Service ✅
- Short Interest Service ✅
- Extended Market Data ✅
- Security & Performance (OWASP + memory optimization) ✅

All tests use real APIs with 5-minute timeout.

## Core Services

| Service                      | File                           | Purpose                          | Status                 |
| ---------------------------- | ------------------------------ | -------------------------------- | ---------------------- |
| StockSelectionService        | `services/stock-selection/`    | Multi-modal analysis             | ✅                     |
| VWAPService                  | `services/financial-data/`     | Volume Weighted Average          | ✅                     |
| SentimentAnalysisService     | `services/financial-data/`     | Yahoo + Reddit sentiment         | ✅                     |
| MacroeconomicAnalysisService | `services/financial-data/`     | FRED + BLS + EIA                 | ✅                     |
| InstitutionalDataService     | `services/financial-data/`     | SEC 13F + Form 4                 | ✅                     |
| CurrencyDataService          | `services/financial-data/`     | International currency           | ✅                     |
| ESGDataService               | `services/financial-data/`     | ESG scoring                      | ✅                     |
| ShortInterestService         | `services/financial-data/`     | FINRA + squeeze detection        | ✅                     |
| ExtendedMarketDataService    | `services/financial-data/`     | Pre/post market + bid/ask        | ✅                     |
| YahooFinanceAPI              | `services/financial-data/`     | Direct REST integration          | ✅                     |
| YahooFinanceSentimentAPI     | `services/financial-data/providers/` | High-performance sentiment | ✅                     |
| FallbackDataService          | `services/financial-data/`     | API orchestration + failover     | ✅                     |
| SecurityValidator            | `services/security/`           | OWASP protection                 | ✅                     |
| **RealTimePredictionEngine** | `services/ml/prediction/`      | **ML ensemble orchestration**    | **✅ PRODUCTION** |
| **EarlySignalMLService**     | `services/ml/early-signal/`    | **ML analyst predictions**       | **✅ PRODUCTION** |
| **SmartMoneyFlowService**    | `services/ml/smart-money-flow/`| **Institutional activity ML**    | **✅ PRODUCTION** |

## Production Standards

| Environment | Cache TTL  | Rate Limits | Admin Access |
| ----------- | ---------- | ----------- | ------------ |
| Development | 2 minutes  | Relaxed     | Auto-granted |
| Production  | 10 minutes | Strict      | JWT Required |

**Development Rules**:
1. **NO MOCK DATA** - Always use real APIs
2. **TypeScript Strict** - Must pass strict checks
3. **KISS** - Avoid over-engineering
4. **80% Test Coverage** - Minimum
5. **Performance First** - Core Web Vitals optimization

## Key Documentation

- `docs/vision.md` - Project goals
- `docs/security-architecture.md` - Security implementation
- `docs/error-handling-standards.md` - Error management
- `app/services/*/CLAUDE.md` - Service-specific context
- `database/CLAUDE.md` - Database architecture

**License**: Private - Veritak Financial Research LLC
