# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**IMPORTANT** Number 1 rule: NO MOCK DATA!! ANYWHERE!! EVER!!

## Analysis Engine Documentation Directory

This `/docs/analysis-engine` directory contains specialized documentation for the VFR financial analysis engine development and architecture. This is a subdirectory of the main VFR API project.

### Directory Structure

```
analysis-engine/
├── analysis-engine-vision.md    # Core data priorities and AI strategy
├── vfr-analysis-flow.md         # Complete data flow architecture
├── data-flow.md                 # Data collection and processing flow
├── feedback-loop.md             # AI learning and optimization
├── api-upgrade-strategy.md      # API integration strategy
├── teir-one-data-inputs.md      # Essential data inputs
├── type-script/                 # TypeScript implementations
├── plans/                       # Strategic planning documents
├── todos/                       # Task management and tracking
└── logs/                        # Development logs
```

## Analysis Engine Architecture

### Core Components
- **Data Collection Layer**: Multi-tiered approach with 15+ financial APIs
- **Analysis Engine**: AI-powered analysis with weighted factor scoring
- **Cache Strategy**: Redis-based caching with TTL optimization
- **Real-time Processing**: Parallel API calls with fallback mechanisms

### Key Weighting Strategy
- **40%** - Technical & price action signals (includes VWAP analysis ✅ IMPLEMENTED)
- **25%** - Fundamental analysis & financial health (dual-source redundancy ✅ IMPLEMENTED)
- **20%** - Macroeconomic context & sector rotation (FRED + BLS + EIA ✅ IMPLEMENTED)
- **10%** - Sentiment & institutional flow (analyst ratings + Reddit WSB multi-subreddit ✅ IMPLEMENTED with rate limit graceful degradation)
- **5%** - Alternative data & special situations (ESG integration planned)

## Development Commands (From Root Directory)

Run these commands from `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/`:

```bash
# Development
npm run dev              # Start development server
npm run type-check       # TypeScript validation
npm run lint            # Code quality check
npm test                # Run all tests

# Analysis Engine Specific
npm test -- app/services/algorithms/  # Test analysis algorithms
npm test -- app/services/stock-selection/  # Test stock selection service
```

## Key File Locations (Relative to Project Root)

### Analysis Engine Implementation
- **Main Service**: `app/services/stock-selection/StockSelectionService.ts`
- **Algorithms**: `app/services/algorithms/` (scheduling and analysis)
- **Data Sources**: `app/services/financial-data/` (API integrations)
- **Caching**: `app/services/cache/RedisCache.ts`

### API Endpoints
- **Stock Analysis**: `app/api/stocks/select/route.ts`
- **Health Check**: `app/api/health/route.ts`
- **Admin Testing**: `app/api/admin/test-data-sources/route.ts`

## Documentation Workflow

### When Adding New Analysis Engine Features
1. Document architecture decisions in relevant `.md` files
2. Update type definitions in `type-script/` directory
3. Add planning documents to `plans/` for complex features
4. Track development tasks in `todos/` directory

### Documentation Standards
- **Real Data Focus**: All examples use real market data, never mock data
- **TypeScript First**: All code examples include proper typing
- **Performance Metrics**: Include timing and optimization details
- **Error Handling**: Document fallback strategies and error scenarios

## Analysis Engine Data Flow

### Single Stock Analysis Process
1. **Input Validation**: Symbol normalization and validation
2. **Parallel Data Collection**: 6+ APIs called simultaneously (~500ms total)
3. **Data Normalization**: Standardize data formats across sources
4. **Analysis Engine**: AI-powered weighted analysis
5. **Result Caching**: Store results in Redis with appropriate TTL
6. **Response**: BUY/SELL/HOLD recommendation with confidence scores

### Data Collection Strategy
- **Primary APIs**: Polygon, Alpha Vantage, Financial Modeling Prep
- **Secondary APIs**: Yahoo Finance, TwelveData
- **Government APIs**: FRED, Treasury, BLS, EIA
- **Fallback Logic**: Automatic source switching on failures

## Testing Philosophy

### Analysis Engine Testing
- **Real API Integration**: Always test with live data connections
- **Performance Testing**: Measure data collection and analysis timing
- **Fallback Testing**: Verify graceful degradation when APIs fail
- **Memory Optimization**: Tests run with `maxWorkers: 1` for stability

### Test Patterns
```bash
# Run specific analysis engine tests
npm test -- --testNamePattern="StockSelectionService"
npm test -- app/services/financial-data/__tests__/
npm test -- --testNamePattern="PolygonAPI"
```

## Development Guidelines

### Analysis Engine Specific Rules
- **KISS Principles**: Keep solutions simple and readable - avoid over-engineering
- **No Mock Data**: Always use real financial APIs for testing and development
- **Performance First**: Target < 3 seconds for complete analysis
- **Graceful Degradation**: Handle API failures without breaking user experience (Live Market Sentiment fix ✅)
- **Confidence Scoring**: All analysis results include confidence levels
- **Caching Strategy**: Implement appropriate TTL for different data types
- **Rate Limit Handling**: Provide meaningful user feedback during API constraints

### Data Quality Standards
- **Source Attribution**: Track which APIs provided each data point
- **Timestamp Accuracy**: Precise timing for all market data
- **Error Logging**: Comprehensive logging for debugging API issues
- **Rate Limiting**: Respect API limits and implement backoff strategies

## Troubleshooting

### Common Analysis Engine Issues
- **API Rate Limits**: Check admin dashboard at `/admin` for source health
- **Cache Misses**: Verify Redis connection and TTL settings
- **Analysis Timeouts**: Review parallel processing and API response times
- **Data Quality**: Check fallback service logs for source switching

### Debug Commands
```bash
# Check API health from project root
curl http://localhost:3000/api/health
curl http://localhost:3000/api/admin/data-sources

# Monitor analysis performance
npm run dev:monitor

# Test specific data sources
node test-polygon-updates.ts
node test-fallback-service.mjs
```

## Important Notes

- This directory documents the analysis engine architecture and strategy
- All implementation files are in the main project structure under `app/`
- When making changes to analysis logic, update relevant documentation here
- TypeScript examples in `type-script/` should reflect actual implementation
- Focus on real-world performance and data quality over theoretical optimization