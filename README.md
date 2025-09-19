# VFR API - Veritak Financial Research Platform

![License](https://img.shields.io/badge/license-Private-red)
![Next.js](https://img.shields.io/badge/Next.js-15.5.3-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.2.0-blue)
![React](https://img.shields.io/badge/React-19.1.1-61dafb)

> An intelligent, cyberpunk-themed financial research platform that democratizes sophisticated investment analysis for individual investors.

## 🚀 Vision

Individual investors lack access to real-time, comprehensive data and sophisticated analysis tools available to institutional firms. VFR API solves this by providing an AI-driven analysis engine that delivers deep, actionable insights with a single click, leveraging 12+ data sources including commercial and government APIs.

**Mission**: Become the trusted co-pilot for individual investors, democratizing sophisticated financial research and empowering data-driven investment decisions.

## ✨ Features

- **🤖 AI-Powered Analysis**: Proprietary engine identifies trends, predicts outcomes, evaluates risks
- **📊 Multi-Source Data Aggregation**: 12+ APIs including Polygon, Alpha Vantage, Financial Modeling Prep, Yahoo Finance, SEC, Treasury, FRED
- **⚡ Real-Time Processing**: Dynamic data sourcing with admin-managed API availability
- **🎯 Actionable Insights**: Clear BUY/SELL/HOLD recommendations with supporting analysis
- **🔒 Enterprise Security**: JWT-based authentication with bcrypt password hashing
- **⚡ Redis Caching**: High-performance caching with in-memory fallback
- **🎨 Cyberpunk UI**: Modern, responsive interface with Tailwind CSS
- **📱 Multi-Modal Input**: Supports market sectors, single stocks, or multiple stock symbols

## 🏗️ Architecture

```
app/
├── api/                        # API routes (health, stocks, admin, auth)
├── components/                 # React components (UI, admin, stock selection)
├── services/                   # Core business logic services
│   ├── algorithms/             # Stock analysis algorithms & scheduling
│   ├── auth/                   # Authentication service
│   ├── cache/                  # Redis caching with fallback
│   ├── financial-data/         # Financial data providers
│   ├── stock-selection/        # Multi-modal stock analysis service
│   └── admin/                  # Admin configuration management
├── hooks/                      # React hooks
├── admin/                      # Admin dashboard page
├── stock-intelligence/         # Stock analysis page
└── globals.css                 # Cyberpunk-themed styles
```

### Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript 5.2.0
- **Frontend**: React 19, Tailwind CSS
- **Backend**: Node.js with Next.js API routes
- **Database**: PostgreSQL, Redis, InfluxDB
- **Authentication**: JWT with bcrypt
- **Testing**: Jest with ts-jest, Playwright for E2E
- **Styling**: Tailwind CSS with cyberpunk theme

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (22.x LTS recommended)
- PostgreSQL
- Redis
- InfluxDB (optional)
- API keys for financial data sources

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd vfr-api
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment setup**
```bash
cp .env.example .env
# Edit .env with your actual API keys and database URLs
```

4. **Database setup**
```bash
# Ensure PostgreSQL, Redis, and InfluxDB are running
# Default URLs:
# PostgreSQL: postgresql://postgres:dev_password_123@localhost:5432/vfr_api
# Redis: redis://localhost:6379
# InfluxDB: http://localhost:8086
```

5. **Start development server**
```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## 📋 Development Commands

### Essential Commands
```bash
npm run dev            # Start main development server (port 3000)
npm run dev:api        # Start API development server (port 3002)
npm run dev:clean      # Clean development environment and start fresh
npm run build          # Build for production
npm run start          # Start production server
```

### Code Quality
```bash
npm run lint           # Run ESLint
npm run type-check     # Run TypeScript type checking
npm run format         # Format code with Prettier
npm run format:check   # Check code formatting
```

### Testing
```bash
npm test               # Run Jest tests with memory optimization
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate test coverage report
```

### Utilities
```bash
npm run dev:port-check # Check if port 3000 is available
npm run dev:kill       # Kill all development processes
./scripts/dev-clean.sh # Clean development environment script
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:dev_password_123@localhost:5432/vfr_api
REDIS_URL=redis://localhost:6379
INFLUXDB_URL=http://localhost:8086

# API Keys (Required)
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key
POLYGON_API_KEY=your_polygon_key
FMP_API_KEY=your_fmp_key
FRED_API_KEY=your_fred_key
NEWS_API_KEY=your_news_api_key

# Application Configuration
SECRET_KEY=your_jwt_secret_key
NODE_ENV=development
DEBUG=true
LOG_LEVEL=INFO

# Rate Limiting
MAX_REQUESTS_PER_MINUTE=60
REQUEST_TIMEOUT=30
```

### Data Sources

The platform supports 12+ financial data sources:

**Premium APIs**:
- Polygon.io (Stock data, real-time quotes)
- Alpha Vantage (Technical indicators, fundamentals)
- Financial Modeling Prep (Financial statements, ratios)

**Free APIs**:
- Yahoo Finance (Basic stock data)
- SEC (Company filings, insider trading)

**Government APIs**:
- FRED (Federal Reserve economic data)
- Treasury.gov (Government bonds, rates)
- Bureau of Labor Statistics (Employment data)

## 🎯 Usage

### Basic Stock Analysis

1. Navigate to `/stock-intelligence`
2. Enter a stock symbol, sector, or multiple symbols
3. Click "Deep Analysis"
4. Review AI-generated insights and recommendations

### Admin Dashboard

1. Navigate to `/admin`
2. Monitor data source health
3. Toggle API availability
4. Test data source connections
5. View system performance metrics

### API Endpoints

```bash
# Health check
GET /api/health

# Stock selection
POST /api/stocks/select
{
  "symbols": ["AAPL", "GOOGL"],
  "sector": "technology",
  "algorithm": "comprehensive"
}

# Authentication
POST /api/user_auth
{
  "username": "user",
  "password": "password"
}

# Admin - Data sources
GET /api/admin/data-sources
POST /api/admin/data-sources/{id}/toggle
```

## 🧪 Testing

### Test Structure

```
**/__tests__/**/*.test.ts    # Unit tests
**/__tests__/**/*.test.tsx   # Component tests
docs/test-output/           # Test outputs and coverage
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test
npm test -- --testNamePattern="StockSelectionService"
npm test -- app/services/cache/__tests__/RedisCache.test.ts

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Testing Philosophy

- **TDD Approach**: Tests written before implementation
- **Real Data**: Always use real APIs, never mock data
- **Memory Optimization**: Tests run with `maxWorkers: 1` for stability
- **80% Coverage**: Minimum test coverage requirement

## 🏛️ Architecture Details

### Service Layer

**StockSelectionService** (`app/services/stock-selection/StockSelectionService.ts`):
- Multi-modal stock analysis
- Algorithm integration
- Real-time data processing

**FinancialDataService** (`app/services/financial-data/FinancialDataService.ts`):
- API orchestration
- Data source failover
- Rate limiting and caching

**AuthService** (`app/services/auth/AuthService.ts`):
- JWT token management
- Bcrypt password hashing
- Session management

### Caching Strategy

- **Primary**: Redis with configurable TTL (2min dev, 10min prod)
- **Fallback**: In-memory cache for high availability
- **Strategy**: Cache-aside pattern with automatic invalidation

### Data Flow

1. **User Input** → Stock symbols/sectors
2. **Data Fetching** → Multiple API sources in parallel
3. **AI Analysis** → Proprietary algorithms process data
4. **Caching** → Results cached for performance
5. **Response** → Actionable insights returned

## 🚀 Deployment

### Production Build

```bash
npm run build
npm run start
```

### Environment Differences

| Environment | Cache TTL | Rate Limits | Data Quality |
|-------------|-----------|-------------|--------------|
| Development | 2 minutes | Relaxed     | Basic        |
| Production  | 10 minutes| Strict      | Enhanced     |

### Performance Targets

- **LCP**: <2.5s (Largest Contentful Paint)
- **INP**: <200ms (Interaction to Next Paint)
- **CLS**: <0.1 (Cumulative Layout Shift)

## 📝 Contributing

### Development Guidelines

1. **KISS Principles**: Keep solutions simple and readable
2. **Follow Conventions**: Match existing code style and patterns
3. **Security First**: Never expose API keys or sensitive data
4. **Test Coverage**: Maintain 80% minimum test coverage
5. **Performance**: Optimize for Core Web Vitals

### Code Standards

- **TypeScript**: Strict mode enabled
- **ESLint**: Enforced code quality rules
- **Prettier**: Consistent code formatting
- **Jest**: Unit and integration testing
- **No Comments**: Code should be self-documenting

### Git Workflow

```bash
git checkout -b feature/your-feature
# Make changes
npm run lint && npm run type-check && npm test
git commit -m "feat: add your feature"
git push origin feature/your-feature
# Create pull request
```

## 📊 Monitoring

### Health Endpoints

- `/api/health` - Application health status
- `/admin` - Admin dashboard with system metrics
- Redis and database connection monitoring

### Performance Metrics

- Response times for all API endpoints
- Cache hit/miss ratios
- Data source availability
- Error rates and patterns

## 🔒 Security

- **Authentication**: JWT with secure secret rotation
- **Password Hashing**: bcrypt with salt rounds
- **API Security**: Rate limiting and input validation
- **Data Protection**: No sensitive data in logs or commits
- **Environment Isolation**: Separate dev/prod configurations

## 📚 Documentation

- `/docs/vision.md` - Project vision and goals
- `/docs/claude-standards.md` - Development standards
- `/docs/comprehensive-coding-standards.md` - Detailed coding guidelines
- `/docs/test-output/` - Test results and coverage reports

## 🤝 Support

- **Issues**: Create GitHub issues for bugs and feature requests
- **Documentation**: Comprehensive docs in `/docs` directory
- **Code Examples**: Check service tests for usage patterns

## 📄 License

Private - Veritak Financial Research LLC

---

**Built with ❤️ and caffeine by the VFR team**