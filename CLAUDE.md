# Veritak Financial Research - Financial Analysis Platform - Claude Context

## Project Overview
Financial analysis platform aggregating data from government APIs and MCP (Model Context Protocol) servers for market analysis and stock prediction. Features MCP-first architecture with unified four-quadrant collector system.

## Architecture & Stack

**Backend:** Python, Pandas, NumPy, scikit-learn, FastAPI, PostgreSQL, InfluxDB  
**Frontend:** Next.js 14, React, D3.js/Chart.js, Tailwind CSS, Redux  
**Infrastructure:** Docker, Kubernetes, GitHub Actions, Prometheus

## Data Sources (Four-Quadrant Architecture)

**Government Data:**
- API: SEC EDGAR, FRED, Treasury Direct, BEA, BLS, EIA, FDIC
- MCP: Data.gov MCP (SEC XBRL, Treasury analysis)

**Commercial Data:**
- MCP: Alpha Vantage (79 tools), Polygon.io (53 tools), Yahoo Finance (10 tools, FREE)
- API: IEX Cloud, Quandl (fallback)

**Web Intelligence:**
- MCP: Dappier (real-time search), Firecrawl (sentiment analysis)

**Development Tools:**
- MCP: GitHub, Context7

## File Structure

```
├── app/                        # Next.js 14 App Router
│   ├── api/                   # API Routes
│   │   ├── stocks/by-sector/  # Sector filtering with MCP
│   │   ├── news/sentiment/    # MCP-powered sentiment
│   │   └── ws/stocks/         # Real-time WebSocket pipeline
│   ├── components/            # React components
│   │   ├── StockTicker.tsx    # TradingView integration
│   │   └── SectorDropdown.tsx # Sector selection
│   ├── services/              # Core services
│   │   ├── mcp/MCPClient.ts   # Unified MCP service (487 lines)
│   │   └── websocket/WebSocketManager.ts # WebSocket manager
│   └── page.tsx              # Main application
├── backend/
│   ├── data_collectors/       # Government/commercial API collectors
│   ├── mcp_collectors/        # MCP server integrations
│   └── analysis_engine/       # ML models, sentiment analysis
├── docs/
│   ├── plans/                # PLAN markdown files
│   ├── todos/                # TODO markdown files
│   └── summaries/            # SUMMARY markdown files
└── .env.local               # API keys, MCP server config
```

## Development Commands

**Setup:**
```bash
# Backend
cd backend && pip install -r requirements.txt

# Frontend  
cd frontend && npm install && npm run dev

# MCP Testing
python test_mcp_collectors.py --collector alpha_vantage
python test_four_quadrant_routing.py
```

**Operations:**
```bash
python scripts/collect_daily_data.py
python scripts/generate_recommendations.py --sector technology --risk low
python scripts/analyze_portfolio.py --portfolio my_portfolio.json
```

## Current Implementation Status

**Operational:**
- 9 MCP servers integrated (95% success rate across 132+ tools)
- 8 Government API collectors active
- Real-time WebSocket pipeline (30-second refresh)
- Advanced filtering system (106+ options, 12 categories)

**Key Files:**
- `/app/services/mcp/MCPClient.ts` - 487-line MCP service singleton
- `/backend/data_collectors/` - Government data collectors
- `/docs/project/test_output/` - All test results location

## Analysis Engine Components

**Core Modules:**
- Sentiment Analysis (FinBERT, news aggregation)
- Technical Analysis (50+ indicators)
- Fundamental Analysis (peer comparison)
- Prediction Engine (LSTM models)

**Data Flow:**
MCP Servers → Analysis Engine → Frontend API → React Components

**Performance:** Sub-100ms response with intelligent caching

## MCP Integration Details

**Primary Sources:**
- Polygon MCP: Institutional market data
- Alpha Vantage MCP: AI-optimized financial tools
- Yahoo Finance MCP: Free comprehensive analysis
- Data.gov MCP: Government financial data

**Pipeline:** Data Collection → Analysis Engine → ML Predictions → Frontend Delivery

## Configuration

**Required Environment:**
```
FRED_API_KEY=required_free_key
ALPHA_VANTAGE_API_KEY=optional
POLYGON_API_KEY=optional
```

**Documentation Standards:**
- All markdown files include date/time/version
- PLAN files → `/docs/plans/`
- TODO files → `/docs/todos/`
- SUMMARY files → `/docs/summaries/`
- Test outputs → `/docs/project/test_output/`

## Legal Context
Tool for informational purposes only, not financial advice. All investments carry risk.