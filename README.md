# VFR API - Veritak Financial Research Platform

**Next.js 15 | TypeScript 5.2 | React 19 | 15+ Financial APIs**

## Quick Start
```bash
npm install
cp .env.example .env  # Add API keys
npm run dev:clean     # Port 3000
```

## Core Identity
**Problem**: Individual investors lack institutional-grade analysis tools
**Solution**: AI-driven analysis engine aggregating 15+ data sources with advanced trading intelligence
**Mission**: Democratize sophisticated financial research via single-click insights

## Features & Tech Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Framework** | Next.js 15 + App Router | SSR/SSG with TypeScript |
| **Data Sources** | 15+ APIs (Polygon, AV, FMP, SEC, FRED, BLS, EIA) | Real-time financial + macroeconomic data |
| **Intelligence** | SEC EDGAR 13F/Form 4 + VWAP + Multi-Reddit sentiment | Institutional + trading insights |
| **Caching** | Redis + In-memory fallback | Performance optimization |
| **Security** | JWT + bcrypt + OWASP validation | Enterprise-grade protection |
| **UI** | React 19 + Tailwind CSS | Cyberpunk-themed interface |
| **Testing** | Jest + Playwright + TDD | Real data, no mocks |

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
| Tier | Source | Type | Purpose |
|------|--------|------|---------|
| Premium | Polygon, Alpha Vantage, FMP | Paid | Primary data + ratios + VWAP |
| Enhanced | EODHD, TwelveData | Paid | Secondary + ratios |
| Government | SEC EDGAR, FRED, BLS, EIA | Free | Institutional/macro/energy |
| Social Intelligence | Reddit WSB Multi-Subreddit, NewsAPI | Free/Paid | Sentiment analysis |
| Backup | Yahoo Finance | Free | Fallback only |

## API Usage

### Key Endpoints
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | System status |
| `/api/stocks/select` | POST | Stock analysis |
| `/api/user_auth` | POST | JWT authentication |
| `/api/admin/data-sources` | GET | API monitoring |

### UI Routes
- `/stock-intelligence` - Multi-modal stock analysis
- `/admin` - Data source management & health monitoring

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
- **VWAP Service**: Volume Weighted Average Price analysis and integration
- **Enhanced Reddit API**: Multi-subreddit sentiment analysis with performance testing
- **Sentiment Analysis**: NewsAPI + Reddit WSB integration with caching
- **Macroeconomic Data**: FRED + BLS + EIA integration testing
- **Currency Data**: International currency analysis validation
- **Institutional Data**: SEC EDGAR 13F + Form 4 comprehensive integration
- **Security & Performance**: OWASP compliance + memory optimization

All tests use real APIs with 5-minute timeout for comprehensive integration validation.

## Architecture Details

### Core Services
| Service | File | Purpose |
|---------|------|---------|
| StockSelectionService | `app/services/stock-selection/` | Multi-modal analysis |
| VWAPService | `app/services/financial-data/` | Volume Weighted Average Price analysis |
| SentimentAnalysisService | `app/services/financial-data/` | NewsAPI + Reddit multi-subreddit sentiment |
| MacroeconomicAnalysisService | `app/services/financial-data/` | FRED + BLS + EIA integration |
| InstitutionalDataService | `app/services/financial-data/` | SEC 13F + Form 4 parsing |
| CurrencyDataService | `app/services/financial-data/` | International currency analysis |
| FallbackDataService | `app/services/financial-data/` | API orchestration + failover |
| SecurityValidator | `app/services/security/` | OWASP protection |

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