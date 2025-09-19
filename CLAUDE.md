# CLAUDE.md
**IMPORTANT** Number 1 rule: NO MOCK DATA!! ANYWHERE!! EVER!!

Veritak Financial Research LLC - A Next.js 15 cyberpunk-themed financial analysis platform aggregating 12+ data sources. See `docs/vision.md` for project vision.

## Architecture

Next.js 15 App Router with TypeScript:

```
app/
├── api/                        # API routes (health, stocks, admin, auth)
├── components/                 # React components (UI, admin, stock selection)
├── services/                   # Core business logic services
│   ├── algorithms/             # Stock analysis algorithms & scheduling
│   ├── auth/                   # Authentication service
│   ├── cache/                  # Redis caching with fallback
│   ├── financial-data/         # Financial data providers (Polygon, Alpha Vantage, etc.)
│   ├── stock-selection/        # Multi-modal stock analysis service
│   └── admin/                  # Admin configuration management
├── hooks/                      # React hooks
├── admin/                      # Admin dashboard page
├── stock-intelligence/         # Stock analysis page
└── globals.css                 # Cyberpunk-themed styles
src/
├── components/economic-data/   # Economic data visualization components
├── types/                      # TypeScript type definitions
└── utils/                      # Utility functions
```

## Development Commands

### Essential Commands
- `npm run dev` - Start main development server on port 3000
- `npm run dev:api` - Start API development server on port 3002
- `npm run dev:clean` - Clean development environment and start fresh server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run format` - Format code with Prettier

### Testing Commands
- `npm test` - Run Jest tests with memory optimization
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Port Management
- `npm run dev:port-check` - Check if port 3000 is available
- `npm run dev:kill` - Kill all development processes
- `./scripts/dev-clean.sh` - Clean development environment script

## Key Services

**Stock Selection**: Multi-modal analysis (`app/services/stock-selection/StockSelectionService.ts`)
**Data Sources**: 12+ APIs - Premium (Polygon, Alpha Vantage, Financial Modeling Prep), Free (Yahoo), Government (SEC, Treasury, FRED)
**Cache**: Redis primary, in-memory fallback (`app/services/cache/`)
**Auth**: JWT-based (`app/services/auth/AuthService.ts`)

## Configuration
**Environment**: API keys (financial data), Redis settings, JWT secrets
**Dev vs Prod**: 2min vs 10min cache TTL, relaxed vs strict data quality

## Testing
**Framework**: Jest with ts-jest, memory optimization (maxWorkers: 1)
**Coverage**: `docs/test-output/coverage/`, pattern: `**/__tests__/**/*.test.ts`
**Single Test**: `npm test -- --testNamePattern="name"` or `npm test -- path/to/test.ts`

## Guidelines
- Use KISS principles, avoid over-engineering
- Follow existing patterns and conventions
- Prioritize performance and scalability
- Multiple dev servers supported (different ports)
- Use `dev:clean` for port conflicts
- See `docs/claude-standards.md` and `docs/comprehensive-coding-standards.md` for details