# Veritak Financial Research - MCP-Native Financial Analysis Platform

A financial analysis platform combining traditional APIs and MCP (Model Context Protocol) servers for AI-native data integration.

## Architecture Overview

**Four-Quadrant Data Collection System:**
```
├── Government Data Sources
│   ├── API Collectors: SEC, FRED, BEA, Treasury, BLS, EIA, FDIC
│   └── MCP Collectors: Data.gov MCP (SEC XBRL, Treasury analysis)
├── Commercial Data Sources  
│   ├── API Collectors: IEX Cloud, Quandl
│   └── MCP Collectors: Alpha Vantage, Polygon.io, Yahoo Finance
├── Web Intelligence
│   └── MCP Collectors: Firecrawl, Dappier, Better-Playwright
└── Development Tools
    └── MCP Collectors: GitHub, Context7
```

## Technology Stack

**Backend:** Python 3.11+, FastAPI, Pandas, PostgreSQL, Redis
**Frontend:** Next.js 14, TypeScript, Tailwind CSS, Chart.js
**Infrastructure:** Docker, Kubernetes, GitHub Actions
**Protocols:** REST APIs, MCP (JSON-RPC 2.0), WebSocket

## Key Modules

1. **Data Ingestion** - MCP servers + traditional APIs, unified interface
2. **Data Processing** - ETL pipelines, validation, storage optimization
3. **Analysis Engine** - Technical indicators, fundamental analysis
4. **API Services** - FastAPI backend, JWT authentication, rate limiting
5. **Frontend Dashboard** - React/Next.js interface
6. **Infrastructure** - Docker, monitoring, CI/CD

## Current Implementation Status

**Operational Components:**
- 8 Government API collectors (SEC, FRED, BEA, Treasury×2, BLS, EIA, FDIC)
- 9 Active MCP servers with 132+ validated tools
- Advanced filtering system (106+ filter options, 12 categories)
- Real-time WebSocket pipeline (30-second refresh cycles)
- Production-ready economic dashboard

## File Structure Context

```
backend/
├── data_collectors/          # Government/commercial API collectors
├── mcp_collectors/          # MCP server integrations
├── api/                     # FastAPI routes
└── core/                    # Shared utilities

frontend/
├── components/              # React components
├── pages/                   # Next.js pages
└── styles/                  # Tailwind CSS

docs/
├── project/modules/         # Architecture documentation
└── test_output/            # Test results and sample data
```

## Quick Start

**Prerequisites:** Python 3.11+, Node.js 18+, Git

**Environment Setup:**
```bash
# Required API key (free)
export FRED_API_KEY='your_key_here'

# Test current functionality
cd backend/data_collectors
python test_fred_core.py

# View dashboard
open economic-dashboard.html
```

**Development:**
```bash
# Backend
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload

# Frontend  
cd frontend
npm install && npm run dev
```

## Data Sources

**Government APIs (8 operational):**
- SEC EDGAR: Company filings, financial statements
- FRED: Federal Reserve economic data (800,000+ series)
- Treasury Direct: Treasury securities, yield curves
- BEA: GDP, regional economics
- BLS: Employment, wages, inflation
- EIA: Energy market data
- FDIC: Banking sector (4,000+ institutions)

**MCP Servers (9 active):**
- Alpha Vantage MCP: 79 financial tools
- Polygon.io MCP: 53 institutional-grade tools
- Yahoo Finance MCP: 10 free analysis tools
- Data.gov MCP: Government financial data
- Firecrawl MCP: Web intelligence
- GitHub/Context7 MCP: Development intelligence

## Configuration

**Required Environment Variables:**
```
FRED_API_KEY=your_free_fred_key
ALPHA_VANTAGE_API_KEY=optional
POLYGON_API_KEY=optional
```

**Database Configuration:**
- PostgreSQL: Structured data storage
- InfluxDB: Time-series data
- Redis: Caching and sessions

## Testing & Validation

**Test Coverage:** 100% for data collectors
**Test Location:** All outputs must go to `/docs/project/test_output/`
**Key Test Files:**
- `backend/data_collectors/test_filtering_capabilities.py`
- `test_fred_core.py`
- `run_full_fred_demo.py`

## Development Standards

- **Formatting:** Run `prettier --write .` before commits
- **Testing:** 80%+ code coverage requirement
- **Documentation:** Update relevant docs with code changes
- **Output:** All test results → `/docs/project/test_output/`

## Current Phase

**Phase 1 Complete:** Government data foundation (8 collectors operational)
**Phase 2 Complete:** MCP integration (9 servers, 95% success rate)
**Current Focus:** Frontend integration and dynamic filtering UI