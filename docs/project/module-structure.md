# Stock Picker Platform - Module Structure & Architecture

## Overview

This document outlines the comprehensive module breakdown and directory structure for the Stock Picker Financial Analysis & Prediction Platform, designed to create a scalable, maintainable, and well-organized codebase.

## Current Documentation State - UPDATED September 7, 2025

```
/docs/
├── project/
│   ├── ui/
│   │   └── design-system.md ✓ (complete)
│   ├── modules/
│   │   └── data-ingestion/
│   │       └── government-apis/
│   │           ├── bea-usage-guide.md ✅ (LIVE & OPERATIONAL)
│   │           ├── SEC_EDGAR_IMPLEMENTATION_COMPLETE.md ✅
│   │           └── FRED-SUMMARY-COMPLETE.md ✅
│   ├── test_results/
│   │   └── BEA_INTEGRATION_COMPLETE.md 🎉 (NEW - BREAKTHROUGH)
│   └── backend/ 🚀 (NOW IMPLEMENTED)
│       └── data_collectors/ (WORKING GOVERNMENT APIS)
│           ├── collector_router.py 🆕 (Smart routing system)
│           ├── frontend_filter_interface.py 🆕 (88 filter options)
│           └── test_filtering_capabilities.py 🌟 (**100% success rate**) ✅
```

**🔥 BREAKTHROUGH**: Government data collection module now FULLY OPERATIONAL with live economic data streaming!
**🌟 COMPLETE**: **Advanced filtering system implemented** with **100% test success rate** and comprehensive frontend integration! ✅
**🆕 BLS INTEGRATION**: Employment and labor market data collector fully operational with wage, unemployment, and inflation data! ✅

## Proposed Complete Directory Structure

### `/docs` Organization

```
/docs/
├── project/
│   ├── ui/
│   │   ├── design-system.md ✓ (exists)
│   │   ├── components.md
│   │   ├── dashboard-layouts.md
│   │   └── responsive-guidelines.md
│   ├── backend/
│   │   ├── api-design.md
│   │   ├── database-schema.md
│   │   ├── authentication.md
│   │   └── performance.md
│   ├── modules/
│   │   ├── data-ingestion/
│   │   │   ├── README.md
│   │   │   ├── government-apis.md
│   │   │   ├── market-data.md
│   │   │   └── streaming-architecture.md
│   │   ├── data-processing/
│   │   │   ├── README.md
│   │   │   ├── etl-pipelines.md
│   │   │   ├── time-series-storage.md
│   │   │   └── caching-strategy.md
│   │   ├── analysis-engine/
│   │   │   ├── README.md
│   │   │   ├── technical-analysis.md
│   │   │   ├── fundamental-analysis.md
│   │   │   └── pattern-recognition.md
│   │   ├── ml-prediction/
│   │   │   ├── README.md
│   │   │   ├── price-prediction.md
│   │   │   ├── sentiment-analysis.md
│   │   │   └── risk-modeling.md
│   │   ├── portfolio-optimization/
│   │   │   ├── README.md
│   │   │   ├── stock-screening.md
│   │   │   ├── optimization-algorithms.md
│   │   │   └── risk-management.md
│   │   ├── frontend-dashboard/
│   │   │   ├── README.md
│   │   │   ├── component-architecture.md
│   │   │   ├── data-visualization.md
│   │   │   └── real-time-updates.md
│   │   └── infrastructure/
│   │       ├── README.md
│   │       ├── containerization.md
│   │       ├── monitoring.md
│   │       └── deployment.md
│   ├── architecture/
│   │   ├── system-overview.md
│   │   ├── data-flow.md
│   │   ├── security-model.md
│   │   └── scalability-plan.md
│   └── development/
│       ├── setup-guide.md
│       ├── coding-standards.md
│       ├── testing-strategy.md
│       └── contribution-guidelines.md
├── api/
│   ├── endpoints/
│   │   ├── market-data.yaml
│   │   ├── analysis.yaml
│   │   ├── portfolio.yaml
│   │   └── user-management.yaml
│   ├── schemas/
│   │   ├── data-models.json
│   │   ├── request-responses.json
│   │   └── error-codes.json
│   └── examples/
│       ├── curl-examples.sh
│       ├── postman-collection.json
│       └── sdk-usage.md
└── deployment/
    ├── docker/
    │   ├── development/
    │   ├── production/
    │   └── compose-files/
    ├── kubernetes/
    │   ├── manifests/
    │   ├── helm-charts/
    │   └── configs/
    └── environments/
        ├── development.md
        ├── staging.md
        └── production.md
```

## Core Application Modules

## Filter-Driven Data Collection Architecture

### Overview
The Stock Picker platform uses a **filter-driven collector routing system** that intelligently selects optimal data sources based on request specificity and data requirements.

**Key Principle**: Each collector only activates when it provides the best value for the specific request type, ensuring efficiency and optimal data quality.

### Request Flow
```
User Request → Filter Analysis → Collector Selection → Data Collection → Response
```

### Collector Activation Rules

#### SEC EDGAR Collector ✅ **ENHANCED WITH FILTERING**
**Purpose**: Individual company deep-dive fundamental analysis
**Optimal Use**: 1-20 specific companies

**✅ ACTIVATES When**:
- Specific company symbols requested (`['AAPL', 'MSFT']`)
- Individual company analysis (1 company) 
- Small comparison groups (2-20 companies)
- Fundamental analysis requested
- SIC code sector filtering (`sic_codes: ['3571', '7372']`)
- Financial metrics screening (`min_roe: 15, max_debt_to_equity: 0.5`)

**❌ SKIPS When**:
- Broad sector requests (`sector: 'Technology'`)
- Index-only requests (`index: 'S&P500'`)
- Economic indicator requests (routes to FRED)
- Large company lists (>20, routes to bulk APIs)
- Treasury/government data requests

**Priority**: 100 (highest) for single company, scales down by group size
**🆕 New Filtering**: Financial screening, sector filtering, ratio analysis

#### Treasury Direct Collector ✅ **NEW - IMPLEMENTED**
**Purpose**: Treasury securities, yield curve, and interest rate analysis
**Optimal Use**: Fixed income and government securities analysis

**✅ ACTIVATES When**:
- Treasury securities requested (`security_types: ['bills', 'notes', 'bonds']`)
- Yield curve analysis (`maturities: ['2 Yr', '10 Yr', '30 Yr']`)
- Interest rate data requests
- Government bond auction data
- TIPS and inflation-protected securities

**❌ SKIPS When**:
- Individual company requests (routes to SEC EDGAR)
- Economic indicators (routes to FRED)
- Government spending/debt (routes to Treasury Fiscal)

**Priority**: 85-95 based on specificity
**🆕 Filtering**: Security type, maturity range, yield criteria screening

#### Treasury Fiscal Collector ✅ **NEW - IMPLEMENTED**
**Purpose**: Federal debt, government spending, and fiscal policy analysis
**Optimal Use**: Fiscal policy and government financial health analysis

**✅ ACTIVATES When**:
- Federal debt analysis (`federal_debt: true`)
- Government spending requests (`government_spending: true`)
- Budget deficit/surplus analysis
- Fiscal sustainability metrics
- Treasury operations data

**❌ SKIPS When**:
- Treasury securities (routes to Treasury Direct)
- Individual companies (routes to SEC EDGAR)
- Economic indicators (routes to FRED/BEA)

**Priority**: 90 for debt analysis, 80 for spending analysis
**🆕 Filtering**: Debt analysis, spending categories, fiscal health metrics

#### BEA Collector ✅ **ENHANCED WITH FILTERING**
**Purpose**: Economic data and regional analysis
**Optimal Use**: GDP, regional economics, industry analysis

**✅ ACTIVATES When**:
- GDP analysis (`gdp: true`)
- Regional economic data (`states: ['CA', 'NY', 'TX']`)
- Industry GDP analysis (`industry_gdp: true`)
- Personal income data
- Regional economic comparisons

**❌ SKIPS When**:
- Individual company requests (routes to SEC EDGAR)
- FRED-specific series (routes to FRED)
- Treasury data (routes to Treasury collectors)

**Priority**: 85 for GDP, 80 for regional data
**🆕 Filtering**: Geographic filtering, industry analysis, regional comparisons

#### FRED Collector ✅ **ENHANCED WITH FILTERING**
**Purpose**: Economic data and macroeconomic indicators  
**Optimal Use**: Economic context and macro trends

**✅ ACTIVATES When**:
- Economic indicators requested (`fred_series: ['GDP', 'UNRATE', 'CPIAUCSL']`)
- Macroeconomic data analysis
- Employment and inflation data
- Interest rate and monetary policy data
- Market context for investment decisions

**❌ SKIPS When**:
- Individual companies (routes to SEC EDGAR)
- Treasury securities (routes to Treasury Direct)
- Regional GDP (routes to BEA)

**Priority**: 90-95 for FRED-specific series
**🆕 Filtering**: Series selection, category filtering, release-based filtering

#### Market Data Collectors (Planned)
**Purpose**: Real-time pricing, technical analysis, sector screening
**Optimal Use**: Broad market analysis and screening

**✅ WILL ACTIVATE When**:
- Sector analysis (`sector: 'Technology'`)
- Index requests (`index: 'S&P500'`)
- Large company screening (>20 companies)
- Technical analysis requests
- Real-time price data

### Implementation Example - 🆕 **ENHANCED WITH NEW FILTERING**
```python
from backend.data_collectors.collector_router import route_data_request
from backend.data_collectors.frontend_filter_interface import FrontendFilterInterface

# Individual Company Analysis (SEC EDGAR activates)
collectors = route_data_request({
    'companies': ['AAPL'],
    'analysis_type': 'fundamental',
    'min_roe': 15.0,  # 🆕 Financial screening
    'max_debt_to_equity': 0.5
})
# Result: [SECEdgarCollector()] - comprehensive fundamental data with screening

# Treasury Analysis (Treasury Direct activates) - 🆕 NEW
collectors = route_data_request({
    'treasury_securities': 'bonds,bills,notes',
    'maturities': ['5 Yr', '10 Yr', '30 Yr'],
    'analysis_type': 'fiscal'
})
# Result: [TreasuryDirectCollector()] - yield curve and securities data

# Federal Debt Analysis (Treasury Fiscal activates) - 🆕 NEW  
collectors = route_data_request({
    'federal_debt': True,
    'government_spending': True,
    'analysis_type': 'fiscal'
})
# Result: [TreasuryFiscalCollector()] - debt and spending analysis

# Regional Economic Data (BEA activates) - 🆕 ENHANCED
collectors = route_data_request({
    'regional': True,
    'states': ['CA', 'NY', 'TX'],
    'gdp': True,
    'analysis_type': 'economic'
})
# Result: [BEACollector()] - regional economic analysis

# Economic Indicators (FRED activates) - 🆕 ENHANCED
collectors = route_data_request({
    'fred_series': ['GDP', 'UNRATE', 'CPIAUCSL'],
    'analysis_type': 'economic',
    'time_period': '5y'
})
# Result: [FREDCollector()] - macroeconomic indicators

# 🆕 Frontend Integration Example
interface = FrontendFilterInterface()

# Translate frontend filters to collector format
frontend_request = {
    "companies": "AAPL,MSFT,GOOGL",
    "analysis_type": "fundamental",
    "time_period": "5y",
    "financial_metrics": "min_roe:15,max_debt_to_equity:0.5"
}

translated = interface.translate_frontend_filters(frontend_request)
# Result: {
#     'companies': ['AAPL', 'MSFT', 'GOOGL'],
#     'analysis_type': 'fundamental',
#     'date_range': {'start_date': '2020-09-07', 'end_date': '2025-09-07'},
#     'min_roe': 15.0,
#     'max_debt_to_equity': 0.5
# }

# Validate and get suggestions
validation = interface.validate_filter_combination(translated)
# Returns performance estimation, warnings, and suggestions
```

### 1. Data Ingestion Module (`/modules/data-ingestion/`) 🆕 **ENHANCED**

**Purpose**: Aggregate data from multiple external sources with intelligent routing
**Technologies**: Python, AsyncIO, API clients, WebSocket connections

#### Sub-components:

- **Government Data Connectors ✅ OPERATIONAL**
    - SEC EDGAR API integration (10-K, 10-Q, 8-K reports) - ✅ Complete with filtering
    - Federal Reserve (FRED API) economic data - ✅ Complete with series filtering
    - Treasury Direct API for bond/yield data - ✅ Complete with security type filtering
    - Treasury Fiscal API for debt/spending data - ✅ Complete with fiscal filtering
    - BEA API for GDP and economic data - ✅ Complete with regional filtering
    - BLS API for employment and labor data - ✅ Complete with labor market filtering
    - Economic indicators and employment statistics

- **🆕 Advanced Filtering System ✅ IMPLEMENTED**
    - **Frontend Filter Interface**: 88 filter options across 7 categories
    - **Smart Collector Router**: Automatic optimal data source selection
    - **Filter Translation Layer**: Frontend format to collector format
    - **Performance Estimation**: Fast/medium/slow prediction
    - **Filter Validation**: Combination checking and suggestions
    - **Predefined Presets**: 6 common-use filter combinations

- **Market Data APIs** (Planned)
    - Real-time stock prices (NYSE, NASDAQ, LSE, TSE)
    - Historical price data and trading volumes
    - Options data and volatility metrics
    - Earnings reports and financial statements
    - Alpha Vantage, IEX Cloud, Quandl, Yahoo Finance, Polygon.io

- **News & Sentiment Sources** (Planned)
    - Financial news aggregation (News API)
    - Social media sentiment (Twitter API, Reddit API)
    - Press releases and analyst reports

#### Key Features:

- ✅ **Smart routing and collector activation**
- ✅ **Advanced filtering capabilities with frontend integration**
- ✅ **Rate limiting and API quota management**
- ✅ **Data validation and error handling**
- Real-time streaming capabilities (in progress)
- ✅ **Retry mechanisms and failover strategies**

### 2. Data Processing Module (`/modules/data-processing/`)

**Purpose**: Transform, validate, and store incoming data
**Technologies**: Python, Pandas, NumPy, Apache Airflow, Redis

#### Sub-components:

- **ETL Pipelines**
    - Data transformation and normalization
    - Quality validation and cleansing
    - Duplicate detection and handling
    - Scheduled batch processing jobs

- **Storage Management**
    - PostgreSQL for structured data
    - InfluxDB for time-series data
    - Redis for caching frequently accessed data
    - Data archiving and retention policies

- **Performance Optimization**
    - Query optimization strategies
    - Index management
    - Connection pooling
    - Memory management for large datasets

### 3. Analysis Engine Module (`/modules/analysis-engine/`)

**Purpose**: Perform technical and fundamental analysis on financial data
**Technologies**: Python, NumPy, SciPy, TA-Lib, Pandas

#### Sub-components:

- **Technical Analysis**
    - Moving averages (SMA, EMA, MACD)
    - Momentum indicators (RSI, Stochastic)
    - Support/resistance level identification
    - Chart pattern recognition (Head & Shoulders, Triangles, etc.)
    - Volume analysis and price action

- **Fundamental Analysis**
    - P/E ratio, debt-to-equity calculations
    - Revenue growth and profit margin trends
    - Sector comparison and peer analysis
    - Financial health scoring
    - Valuation metrics and ratios

- **Custom Indicators**
    - Proprietary scoring algorithms
    - Multi-timeframe analysis
    - Cross-asset correlations
    - Market regime detection

### 4. Machine Learning & Prediction Module (`/modules/ml-prediction/`)

**Purpose**: Generate predictions and forecasts using ML algorithms
**Technologies**: Python, scikit-learn, TensorFlow, PyTorch, NLTK

#### Sub-components:

- **Price Prediction Models**
    - Time series forecasting (LSTM, ARIMA, Prophet)
    - Regression models for price targets
    - Ensemble methods for improved accuracy
    - Model validation and backtesting

- **Sentiment Analysis**
    - Natural language processing for news
    - Social media sentiment scoring
    - Market sentiment indicators
    - Real-time sentiment tracking

- **Risk Assessment**
    - Volatility forecasting (GARCH models)
    - Value at Risk (VaR) calculations
    - Monte Carlo simulations
    - Correlation analysis and risk metrics

### 5. Portfolio Optimization Module (`/modules/portfolio-optimization/`)

**Purpose**: Generate investment recommendations and optimize portfolios
**Technologies**: Python, SciPy, cvxpy, Pandas

#### Sub-components:

- **Stock Screening**
    - Multi-criteria filtering systems
    - Fundamental and technical screening
    - Sector and market cap filters
    - Custom scoring algorithms

- **Portfolio Construction**
    - Modern Portfolio Theory implementation
    - Risk-adjusted return calculations
    - Asset allocation optimization
    - Diversification analysis

- **Risk Management**
    - Position sizing algorithms
    - Stop-loss and take-profit strategies
    - Portfolio rebalancing alerts
    - Performance attribution analysis

### 6. API & Backend Services Module (`/modules/api-services/`)

**Purpose**: Provide REST API endpoints and backend services
**Technologies**: Python, FastAPI/Flask, JWT, SQLAlchemy

#### Sub-components:

- **REST API Design**
    - RESTful endpoint architecture
    - OpenAPI/Swagger documentation
    - Request/response validation
    - Error handling and status codes

- **Authentication & Security**
    - JWT token management
    - Role-based access control
    - API rate limiting
    - Input validation and sanitization

- **Background Services**
    - Celery task queue management
    - Scheduled data updates
    - Email notifications
    - Performance monitoring

### 7. Frontend Dashboard Module (`/modules/frontend-dashboard/`)

**Purpose**: Provide user interface for data visualization and interaction
**Technologies**: React/Next.js, D3.js, Chart.js, WebSocket

#### Sub-components:

- **Dashboard Components**
    - Real-time market data displays
    - Interactive charts and graphs
    - Portfolio performance widgets
    - News and alerts feed

- **Data Visualization**
    - Candlestick charts
    - Technical indicator overlays
    - Heatmaps and treemaps
    - Correlation matrices

- **User Interface**
    - Responsive design implementation
    - Dark/light theme support
    - Customizable layouts
    - Mobile optimization

### 8. Infrastructure Module (`/modules/infrastructure/`)

**Purpose**: Handle deployment, monitoring, and system operations
**Technologies**: Docker, Kubernetes, Prometheus, Grafana

#### Sub-components:

- **Containerization**
    - Docker configurations
    - Multi-stage builds
    - Security scanning
    - Image optimization

- **Orchestration**
    - Kubernetes manifests
    - Helm chart templates
    - Auto-scaling configurations
    - Load balancing setup

- **Monitoring & Observability**
    - Application performance monitoring
    - Log aggregation and analysis
    - Health checks and alerts
    - Resource utilization tracking

## Development Guidelines

### Module Independence

- Each module should be independently deployable
- Clear API contracts between modules
- Minimal coupling and high cohesion
- Standardized logging and error handling

### Technology Standards

- Python 3.9+ for backend services
- TypeScript for frontend development
- PostgreSQL for primary data storage
- Redis for caching and session management

### Testing Strategy

- Unit tests for individual components
- Integration tests for module interactions
- End-to-end tests for user workflows
- Performance testing for data processing

### Documentation Requirements

- Technical specifications for each module
- API documentation with examples
- Deployment and configuration guides
- Troubleshooting and FAQ sections

## Implementation Priority

### Phase 1: Foundation - ✅ **SIGNIFICANTLY ENHANCED**

1. ✅ **Data Ingestion Module** (6 Government API connections operational)
2. ✅ **🆕 Advanced Filtering System** (88 filter options, smart routing)
3. ✅ **🆕 Frontend Filter Interface** (Translation layer, validation, suggestions)
4. Data Processing Module (core ETL pipelines) - In Progress
5. Basic Frontend Dashboard (market data display) - Next Priority

### Phase 2: Analysis

1. Analysis Engine Module (technical indicators)
2. ML Prediction Module (basic forecasting)
3. Enhanced Frontend (interactive charts)

### Phase 3: Optimization

1. Portfolio Optimization Module
2. Advanced ML models
3. Real-time streaming capabilities

### Phase 4: Production

1. Infrastructure Module (full deployment)
2. Monitoring and alerting
3. Performance optimization
4. Security hardening

This modular architecture ensures scalability, maintainability, and clear separation of concerns while supporting the comprehensive financial analysis capabilities outlined in the platform requirements.
