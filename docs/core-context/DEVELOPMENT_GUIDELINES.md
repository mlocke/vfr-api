# VFR Financial Analysis Platform - Development Guidelines

## Overview

This document provides comprehensive development guidelines for the VFR Financial Analysis Platform, covering development workflow, testing strategies, performance optimization, and troubleshooting procedures.

## Development Environment Setup

### Prerequisites

#### System Requirements
- **Node.js**: Version 18+ with npm 9+
- **Redis**: Version 6+ for caching (optional, has in-memory fallback)
- **PostgreSQL**: Version 12+ for persistent data storage (optional)
- **Memory**: Minimum 8GB RAM (16GB recommended for testing)
- **Storage**: 10GB free space for dependencies and cache

#### Required Environment Variables
```bash
# Core API Keys (Primary Data Sources)
ALPHA_VANTAGE_API_KEY=your_key_here
POLYGON_API_KEY=your_key_here
FMP_API_KEY=your_key_here

# Government Data Sources (Free)
FRED_API_KEY=your_key_here              # Federal Reserve Economic Data
BLS_API_KEY=your_key_here               # Bureau of Labor Statistics
EIA_API_KEY=your_key_here               # Energy Information Administration

# Social/News APIs
NEWS_API_KEY=your_key_here
REDDIT_CLIENT_ID=your_client_id
REDDIT_CLIENT_SECRET=your_client_secret

# Database URLs (Optional)
DATABASE_URL=postgresql://user:pass@localhost:5432/vfr_db
REDIS_URL=redis://localhost:6379
INFLUXDB_URL=http://localhost:8086

# Authentication & Security
JWT_SECRET=your_super_secure_jwt_secret
BCRYPT_ROUNDS=12

# Development Features
ENABLE_ADMIN_AUTO_ACCESS=true
ENABLE_PERFORMANCE_MONITORING=true
NODE_ENV=development
```

### Initial Setup

#### 1. Environment Configuration
```bash
# Clone repository
git clone <repository-url>
cd vfr-api

# Install dependencies
npm install

# Create environment file
cp .env.example .env
# Edit .env with your API keys and configuration
```

#### 2. Verify Installation
```bash
# Type checking
npm run type-check

# Basic functionality test
npm test -- --testNamePattern="HealthCheck"

# Start development server
npm run dev:clean
```

---

## Development Workflow

### Core Development Commands

#### Essential Commands
```bash
# Development Server Management
npm run dev                 # Start development server (port 3000)
npm run dev:clean          # Clean environment + fresh server start
npm run dev:status         # Check development server status
npm run dev:kill           # Kill all development processes
npm run dev:monitor        # Monitor server logs and performance

# Code Quality
npm run type-check         # TypeScript strict type checking
npm run lint              # ESLint code analysis
npm run format            # Prettier code formatting
npm run format:check      # Check code formatting without changes

# Build & Production
npm run build             # Production build
npm run start             # Start production server
```

#### Testing Commands
```bash
# Core Testing
npm test                  # Run all tests with memory optimization
npm run test:watch        # Interactive test runner
npm run test:coverage     # Generate comprehensive coverage report

# Performance Testing
npm run test:performance           # Memory and performance tests
npm run test:performance:single   # Single service performance test
npm run test:performance:memory   # Memory leak detection tests
npm run test:performance:cache    # Cache performance validation

# Targeted Testing
npm test -- --testNamePattern="VWAPService"     # Run specific test
npm test -- app/services/financial-data/__tests__/VWAPService.test.ts  # Run specific file
```

### Development Server Management

#### Clean Development Environment (`npm run dev:clean`)
The `dev:clean` script provides robust development environment management:

**Features**:
- **Process Cleanup**: Kills all Next.js development processes
- **Port Management**: Ensures port 3000 is available
- **Cache Cleanup**: Removes .next, node_modules/.cache, tsconfig.tsbuildinfo
- **Lock File Protection**: Prevents multiple concurrent dev servers
- **Health Monitoring**: Verifies server starts successfully

**Usage Scenarios**:
- Port conflicts ("EADDRINUSE" errors)
- Corrupted development cache
- Multiple development processes running
- After dependency updates
- Daily development environment refresh

#### Troubleshooting Development Issues

**Common Issues & Solutions**:

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Port Conflicts | "EADDRINUSE: address already in use :::3000" | `npm run dev:clean` |
| Cache Issues | Outdated components, build errors | `rm -rf .next && npm run dev` |
| Memory Issues | Slow performance, test failures | `npm run dev:clean && npm test` |
| Type Errors | TypeScript compilation errors | `npm run type-check` |
| Package Issues | Module resolution errors | `rm -rf node_modules && npm install` |

---

## Testing Framework

### Testing Philosophy

#### Test-Driven Development (TDD)
1. **Real Data Only**: All tests use live APIs - no mock data
2. **Integration Focus**: Comprehensive integration testing with 5-minute timeouts
3. **Performance Validation**: Memory leak detection and response time testing
4. **Security Testing**: OWASP compliance validation in all tests
5. **Enterprise Reliability**: Circuit breaker patterns and resilience testing

#### Test Architecture
```typescript
interface TestingStrategy {
  framework: 'Jest';
  preset: 'ts-jest';
  environment: 'node';
  realApiTesting: true;
  memoryOptimization: {
    heapSize: '4096MB';
    maxWorkers: 1;
    runInBand: true;
    explicitGC: true;
  };
  coverage: {
    threshold: 85;          // Service layer coverage target
    output: 'docs/test-output/coverage/';
  };
}
```

### Test Configuration

#### Jest Memory Optimization (`jest.config.js`)
```javascript
{
  // Memory Management
  maxWorkers: 1,                    // Single worker to prevent memory conflicts
  workerIdleMemoryLimit: '512MB',   // Memory limit per worker
  logHeapUsage: true,               // Monitor memory usage
  detectLeaks: false,               // Disabled during development

  // Performance Optimization
  testTimeout: 300000,              // 5-minute timeout for API tests
  maxConcurrency: 5,                // Limit concurrent tests
  runInBand: true,                  // Sequential execution

  // Coverage Configuration
  collectCoverage: true,
  coverageDirectory: 'docs/test-output/coverage',
  collectCoverageFrom: [
    'app/services/**/*.ts',
    '!app/services/**/*.test.ts'
  ]
}
```

#### Test Execution Patterns
```bash
# Memory-Optimized Execution
node --max-old-space-size=4096 --expose-gc node_modules/.bin/jest --runInBand

# Performance Monitoring
node --trace-gc --expose-gc node_modules/.bin/jest --testPathPattern=performance.test.ts
```

### Test Suite Organization

#### Current Test Coverage (26 Test Files)
```
app/services/financial-data/__tests__/
├── VWAPService.test.ts                     # VWAP calculations and analysis
├── SentimentAnalysisService.test.ts        # News + Reddit sentiment
├── InstitutionalDataService.test.ts        # SEC EDGAR integration
├── MacroeconomicAnalysisService.test.ts    # FRED + BLS + EIA data
├── CurrencyDataService.test.ts             # International currency data
├── FallbackDataService.security.test.ts   # Security compliance tests
├── RedditAPIEnhanced.test.ts               # Enhanced Reddit API testing
└── ... (19 additional test files)

app/services/security/__tests__/
├── SecurityValidator.test.ts               # OWASP compliance testing

app/services/technical-analysis/__tests__/
├── indicators.test.ts                      # Technical indicator validation
```

#### Test Categories

**1. Unit Tests**
- Individual service method testing
- Input validation and sanitization
- Error handling verification
- Performance benchmarking

**2. Integration Tests**
- Real API connectivity testing
- Multi-service data flow validation
- Cache integration verification
- Database interaction testing

**3. Security Tests**
- OWASP Top 10 compliance validation
- Input injection prevention testing
- Rate limiting verification
- Error disclosure prevention

**4. Performance Tests**
- Memory leak detection
- Response time validation
- Concurrent request handling
- Cache efficiency measurement

### Writing New Tests

#### Test Template Structure
```typescript
// app/services/example/__tests__/ExampleService.test.ts
import { describe, test, expect, beforeAll, afterEach } from '@jest/globals'
import { ExampleService } from '../ExampleService'
import { RedisCache } from '../../cache/RedisCache'

describe('ExampleService Integration Tests', () => {
  let service: ExampleService
  let cache: RedisCache

  beforeAll(async () => {
    cache = new RedisCache()
    service = new ExampleService(cache)
    await service.initialize()
  })

  afterEach(async () => {
    // Cleanup for memory optimization
    if (global.gc) {
      global.gc()
    }
  })

  describe('Core Functionality', () => {
    test('should process real API data successfully', async () => {
      const result = await service.processData('AAPL')

      expect(result).toBeDefined()
      expect(result.symbol).toBe('AAPL')
      expect(result.timestamp).toBeGreaterThan(0)

      // Performance validation
      const startTime = Date.now()
      await service.processData('MSFT')
      const endTime = Date.now()
      expect(endTime - startTime).toBeLessThan(2000) // <2s response time
    })

    test('should handle API failures gracefully', async () => {
      const result = await service.processData('INVALID_SYMBOL')
      expect(result).toBeNull() // Graceful degradation
    })
  })

  describe('Security Compliance', () => {
    test('should validate input symbols', async () => {
      const maliciousInput = "'; DROP TABLE users; --"
      const result = await service.processData(maliciousInput)
      expect(result).toBeNull() // Rejected malicious input
    })
  })

  describe('Performance Optimization', () => {
    test('should utilize caching effectively', async () => {
      // First call - should hit API
      const start1 = Date.now()
      await service.processData('AAPL')
      const apiTime = Date.now() - start1

      // Second call - should hit cache
      const start2 = Date.now()
      await service.processData('AAPL')
      const cacheTime = Date.now() - start2

      expect(cacheTime).toBeLessThan(apiTime * 0.5) // Cache should be >50% faster
    })
  })
})
```

---

## Performance Optimization

### Memory Management

#### Jest Memory Configuration
```bash
# Memory allocation for testing
export NODE_OPTIONS="--max-old-space-size=4096 --expose-gc"

# Heap monitoring
npm run test:performance:memory
```

#### Service Memory Optimization
```typescript
interface MemoryOptimization {
  serviceConfig: {
    concurrentRequests: 5,      // Limit concurrent API calls
    memoryThreshold: '100MB',   // Automatic garbage collection trigger
    cacheSize: '512MB',         // Maximum cache size
    requestTimeout: 30000       // 30s request timeout
  },

  dataProcessing: {
    streamProcessing: true,     // Stream large XML/JSON files
    batchSize: 1000,           // Process data in batches
    cleanup: 'automatic'       // Automatic resource cleanup
  }
}
```

### Performance Monitoring

#### Response Time Targets
| Service | Target | Cache Hit |
|---------|--------|-----------|
| VWAPService | <200ms | <50ms |
| SentimentAnalysisService | <1.5s | <300ms |
| InstitutionalDataService | <3s | <500ms |
| StockSelectionService | <2s | <800ms |
| TechnicalIndicatorService | <500ms | <100ms |

#### Performance Testing Commands
```bash
# Comprehensive performance testing
npm run test:performance

# Memory leak detection
npm run test:performance:memory

# Cache performance validation
npm run test:performance:cache

# Single service benchmarking
npm run test:performance:single
```

---

## Code Quality Standards

### TypeScript Configuration

#### Strict Mode Requirements (`tsconfig.json`)
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

#### Type Safety Patterns
```typescript
// Always use explicit types for service interfaces
interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

// Use strict input validation
function validateSymbol(symbol: string): ValidationResult {
  if (!symbol || typeof symbol !== 'string') {
    return { isValid: false, error: 'Symbol required' };
  }

  const sanitized = symbol.toUpperCase().trim();
  if (!/^[A-Z]{1,5}$/.test(sanitized)) {
    return { isValid: false, error: 'Invalid symbol format' };
  }

  return { isValid: true, sanitized };
}
```

### Code Style Guidelines

#### ESLint Configuration
```json
{
  "extends": [
    "next/core-web-vitals",
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/explicit-function-return-type": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

#### Prettier Configuration
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Service Development Patterns

#### Service Base Class Pattern
```typescript
abstract class BaseService {
  protected cache: RedisCache;
  protected errorHandler: ErrorHandler;
  protected securityValidator: SecurityValidator;

  constructor(cache: RedisCache) {
    this.cache = cache;
    this.errorHandler = ErrorHandler.getInstance();
    this.securityValidator = SecurityValidator.getInstance();
  }

  protected async validateInput(input: any): Promise<ValidationResult> {
    return this.securityValidator.validate(input);
  }

  protected async handleError(error: Error, context: string): Promise<null> {
    this.errorHandler.logError(error, context);
    return null; // Graceful degradation
  }
}
```

#### Error Handling Patterns
```typescript
// Standard error handling pattern
async function serviceMethod(input: string): Promise<ServiceResponse | null> {
  try {
    // 1. Input validation
    const validation = await this.validateInput(input);
    if (!validation.isValid) {
      return this.handleError(new Error(validation.error), 'serviceMethod');
    }

    // 2. Business logic
    const result = await this.processData(validation.sanitized);

    // 3. Success response
    return {
      success: true,
      data: result,
      timestamp: Date.now()
    };

  } catch (error) {
    // 4. Error handling
    return this.handleError(error, 'serviceMethod');
  }
}
```

---

## Security Guidelines

### Input Validation

#### Symbol Validation Pattern
```typescript
class SecurityValidator {
  validateSymbol(symbol: string): ValidationResult {
    // 1. Type checking
    if (!symbol || typeof symbol !== 'string') {
      return { isValid: false, error: 'Symbol must be a string' };
    }

    // 2. Format validation
    const sanitized = symbol.toUpperCase().trim();
    if (!/^[A-Z]{1,5}$/.test(sanitized)) {
      return { isValid: false, error: 'Symbol must be 1-5 uppercase letters' };
    }

    // 3. Injection prevention
    if (this.containsSQLPatterns(sanitized) || this.containsXSSPatterns(sanitized)) {
      return { isValid: false, error: 'Invalid characters detected' };
    }

    return { isValid: true, sanitized };
  }
}
```

### API Security

#### Rate Limiting Implementation
```typescript
class RateLimiter {
  private readonly limits = new Map<string, RateLimit>();

  async checkLimit(clientId: string, maxRequests = 100, windowMs = 3600000): Promise<void> {
    const now = Date.now();
    const key = `${clientId}:${Math.floor(now / windowMs)}`;

    const current = this.limits.get(key) || { count: 0, resetTime: now + windowMs };

    if (current.count >= maxRequests) {
      throw new Error(`Rate limit exceeded. Try again in ${current.resetTime - now}ms`);
    }

    current.count++;
    this.limits.set(key, current);
  }
}
```

---

## Troubleshooting Guide

### Common Development Issues

#### 1. Port Conflicts
**Symptoms**: "EADDRINUSE: address already in use :::3000"
**Solutions**:
```bash
# Immediate fix
npm run dev:clean

# Manual investigation
lsof -i:3000
kill -9 <PID>

# Nuclear option
pkill -f "next dev"
```

#### 2. Memory Issues
**Symptoms**: Slow tests, heap out of memory, process crashes
**Solutions**:
```bash
# Increase Node.js heap size
export NODE_OPTIONS="--max-old-space-size=8192"

# Run with garbage collection
npm run test:performance:memory

# Clean environment
npm run dev:clean
```

#### 3. API Rate Limits
**Symptoms**: 429 Too Many Requests, API failures
**Solutions**:
- Check API key quotas in admin dashboard
- Implement request queuing
- Use fallback data sources
- Enable caching to reduce API calls

#### 4. Live Market Sentiment Showing 0.00%
**Symptoms**: Market sentiment cards display confusing 0.00% values, users unclear about data quality
**Solutions**: ✅ **RESOLVED** (Commit a381c82)
- Enhanced MarketSentimentService with realistic baseline defaults (52 ± 5 sentiment score)
- Added confidence scoring system (0.1 for defaults vs 0.8 for real data)
- Improved UI with "Limited Data" messaging instead of 0.00% display
- Visual indicators (dashed borders, warning dots) for constrained data
- Tooltips explaining data limitations and quality warnings
- **Technical Implementation**: Updated MarketSentimentHeatmap.tsx and SectorRotationWheel.tsx with enhanced error states

#### 5. Cache Issues
**Symptoms**: Stale data, inconsistent responses
**Solutions**:
```bash
# Redis cache flush
redis-cli FLUSHDB

# Application cache cleanup
rm -rf .next
npm run dev:clean
```

#### 5. Test Failures
**Symptoms**: Intermittent test failures, timeout errors
**Solutions**:
```bash
# Single test execution for debugging
npm test -- --testNamePattern="specific test name"

# Verbose test output
npm test -- --verbose

# Memory-optimized test run
npm run test:performance:memory
```

### Debug Tools

#### Development Monitoring
```bash
# Real-time server monitoring
npm run dev:monitor

# Health check
curl http://localhost:3000/api/health

# Performance monitoring
npm run test:performance
```

#### Log Analysis
```bash
# View application logs
tail -f .next/logs/application.log

# Redis monitoring
redis-cli MONITOR

# Database query monitoring
tail -f /var/log/postgresql/postgresql.log
```

---

## Best Practices

### Service Development

#### 1. Always Use Real Data
```typescript
// ❌ Don't mock data
const mockData = { symbol: 'AAPL', price: 150 };

// ✅ Use real APIs
const realData = await polygonAPI.getStockPrice('AAPL');
```

#### 2. Implement Graceful Degradation
```typescript
// ✅ Proper fallback pattern
async function getStockData(symbol: string): Promise<StockData | null> {
  try {
    // Try primary API
    return await primaryAPI.getStockData(symbol);
  } catch (error) {
    try {
      // Fallback to secondary API
      return await secondaryAPI.getStockData(symbol);
    } catch (fallbackError) {
      // Graceful degradation
      return null;
    }
  }
}
```

#### 3. Security-First Development
```typescript
// ✅ Always validate inputs
async function processRequest(input: any): Promise<Response> {
  const validation = SecurityValidator.validate(input);
  if (!validation.isValid) {
    throw new ValidationError(validation.error);
  }

  return this.processValidInput(validation.sanitized);
}
```

#### 4. Performance Optimization
```typescript
// ✅ Use parallel execution
const [stockData, fundamentals, technicals] = await Promise.allSettled([
  getStockData(symbol),
  getFundamentals(symbol),
  getTechnicalAnalysis(symbol)
]);
```

### Testing Best Practices

#### 1. Write Tests Before Implementation (TDD)
```typescript
// Write failing test first
test('should calculate VWAP correctly', async () => {
  const vwap = await vwapService.calculateVWAP('AAPL');
  expect(vwap).toBeGreaterThan(0);
});

// Then implement the service method
```

#### 2. Use Real APIs in Tests
```typescript
// ✅ Test with real API data
test('should fetch real market data', async () => {
  const data = await polygonAPI.getStockPrice('AAPL');
  expect(data.symbol).toBe('AAPL');
  expect(data.price).toBeGreaterThan(0);
});
```

#### 3. Test Security Compliance
```typescript
// ✅ Always test input validation
test('should reject malicious input', async () => {
  const maliciousInput = "'; DROP TABLE users; --";
  const result = await service.processInput(maliciousInput);
  expect(result).toBeNull();
});
```

This development guidelines document provides comprehensive guidance for maintaining and extending the VFR Financial Analysis Platform with enterprise-grade quality and reliability standards.