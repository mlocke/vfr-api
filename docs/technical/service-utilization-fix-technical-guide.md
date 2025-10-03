# Service Utilization Fix - Technical Implementation Guide

**Created**: 2025-09-25 14:30:00 UTC
**Purpose**: Comprehensive technical documentation for AI agent comprehension and implementation
**Scope**: Service utilization reporting fixes across VFR financial analysis platform

## Executive Technical Summary

### Core Problem Architecture

The VFR platform exhibits a **dual-layer execution disconnect** where services execute in Layer 2 (AlgorithmEngine + FactorLibrary) but utilization is tracked in Layer 1 (StockSelectionService), creating systematic 0% utilization reporting despite functional service execution.

```
CURRENT PROBLEMATIC ARCHITECTURE:
┌─ Layer 1: StockSelectionService ─┐    ← Tracks utilization
│  - Service instantiation          │    ← Monitoring point
│  - Utilization tracking          │    ← Reports 0% usage
└────────────────────────────────────┘
             ↓ [DISCONNECT]
┌─ Layer 2: AlgorithmEngine + FactorLibrary ─┐    ← Actual execution
│  - Pre-fetch patterns                       │    ← Services run here
│  - Composite scoring                        │    ← Real computation
│  - Cache operations                         │    ← Data storage
└───────────────────────────────────────────────┘
```

### Technical Impact Analysis

| Service                    | Current Status             | Weight | Root Cause                              | Implementation Complexity   |
| -------------------------- | -------------------------- | ------ | --------------------------------------- | --------------------------- |
| **Sentiment Analysis**     | ✅ WORKING, misreported 0% | 10%    | Reporting issue only                    | LOW - tracking fix          |
| **Technical Analysis**     | 0% utilization             | 35%    | TechnicalIndicatorService not tracked   | MEDIUM - integration        |
| **VWAP Service**           | 0% utilization             | 10%    | VWAPService isolated from FactorLibrary | MEDIUM - service connection |
| **Fundamental Analysis**   | 0% utilization             | 25%    | Cache inconsistency + data flow         | HIGH - architecture fix     |
| **Macroeconomic Analysis** | 0% utilization             | 20%    | Dynamic import timing issues            | LOW - import pattern fix    |

## Technical Architecture Context

### Service Execution Flow Analysis

#### Current Data Flow (Problematic)

```typescript
// Layer 1: StockSelectionService.ts (Lines 1673-1705)
async analyzeStock(symbol: string): Promise<StockAnalysis> {
  // 1. Service instantiation occurs here
  const services = this.initializeServices();  // ← Tracked here

  // 2. Algorithm execution delegation
  const result = await this.algorithmIntegration.executeAnalysis(symbol);

  // 3. Utilization calculation (BROKEN)
  const utilization = this.calculateServiceUtilization(services); // ← Always 0%
  return { result, utilization };
}

// Layer 2: AlgorithmEngine.ts (Lines 446-470)
async calculateSingleStockScore(symbol: string): Promise<ScoreResult> {
  // 4. Sentiment pre-fetch pattern (WORKING)
  const sentimentData = await this.ensureSentimentData(symbol); // ← Actual execution

  // 5. FactorLibrary delegation
  const composite = await FactorLibrary.calculateMainComposite(symbol, sentimentData);
  return composite;
}

// Layer 2: FactorLibrary.ts (Lines 1614-1676)
static async calculateMainComposite(symbol: string, sentimentData?: any): Promise<CompositeResult> {
  // 6. Real service execution happens here
  const technicalScore = await this.calculateTechnicalOverallScore(symbol); // ← VWAP missing
  const fundamentalScore = await this.calculateQualityComposite(symbol);    // ← Cache issues
  const macroScore = await this.getMacroeconomicData(symbol);              // ← Import timing

  // 7. Actual scoring composition
  return this.composeWeightedScore({ technical, fundamental, macro, sentiment });
}
```

#### Required Fixed Data Flow

```typescript
// Unified tracking with execution visibility
async analyzeStock(symbol: string): Promise<StockAnalysis> {
  // 1. Pre-fetch all service data (mirrors sentiment fix)
  const serviceData = await this.ensureAllServiceData(symbol);

  // 2. Execute with explicit service tracking
  const result = await this.algorithmIntegration.executeWithTracking(symbol, serviceData);

  // 3. Accurate utilization from actual execution
  const utilization = result.executionMetrics.serviceUtilization; // ← Real data
  return { result, utilization };
}
```

### File-Level Technical Dependencies

#### Critical Service Integration Files

##### 1. StockSelectionService.ts - Layer 1 Tracking

**Location**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/stock-selection/StockSelectionService.ts`
**Key Functions**:

- Lines 44-100: Constructor with service dependency injection
- Lines 1673-1705: `calculateServiceUtilization()` - **BROKEN TRACKING LOGIC**
- Lines 52-57: Service instance storage (macroeconomicService, sentimentService, vwapService, etc.)

**Technical Constraints**:

```typescript
// Current problematic pattern
private macroeconomicService?: MacroeconomicAnalysisService // Optional injection
private sentimentService?: SentimentAnalysisService        // Optional injection
private vwapService?: VWAPService                          // Optional injection

// Issue: Services are optional but utilization tracking assumes presence
calculateServiceUtilization(services: ServiceMap): UtilizationMetrics {
  // This method checks service instantiation, not execution
  return services.map(service => service ? 100 : 0); // ← WRONG LOGIC
}
```

**Required Fix Pattern**:

```typescript
// Fixed utilization tracking
async calculateServiceUtilization(symbol: string, executionResult: any): Promise<UtilizationMetrics> {
  const utilization: UtilizationMetrics = {};

  // Check actual service data contribution
  if (executionResult.sentimentData && executionResult.sentimentWeight > 0) {
    utilization.sentiment = executionResult.sentimentWeight; // Real weight
  }
  if (executionResult.technicalData && executionResult.technicalWeight > 0) {
    utilization.technical = executionResult.technicalWeight; // Real weight
  }
  // ... repeat for all services

  return utilization;
}
```

##### 2. AlgorithmEngine.ts - Layer 2 Execution

**Location**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/algorithms/AlgorithmEngine.ts`
**Key Functions**:

- Lines 446-470: `ensureSentimentData()` - **WORKING PRE-FETCH PATTERN**
- Lines 54-71: Constructor with service injection
- Lines 76-150: `executeAlgorithm()` - Main execution orchestration

**Architecture Pattern (Proven Working)**:

```typescript
// Lines 446-470: Sentiment pre-fetch pattern (WORKING)
private async ensureSentimentData(symbol: string): Promise<SentimentData> {
  const cacheKey = `sentiment_${symbol}`;
  let sentimentData = await this.cache.get(cacheKey);

  if (!sentimentData && this.sentimentService) {
    try {
      sentimentData = await this.sentimentService.getMarketSentiment(symbol);
      if (sentimentData) {
        await this.cache.set(cacheKey, sentimentData, 120); // 2min cache
      }
    } catch (error) {
      console.error(`Sentiment data fetch failed for ${symbol}:`, error);
      sentimentData = null;
    }
  }
  return sentimentData;
}
```

**Required Extension Pattern**:

```typescript
// Apply same pattern to all services
private async ensureMacroeconomicData(symbol: string): Promise<MacroData> { /* ... */ }
private async ensureVWAPData(symbol: string): Promise<VWAPData> { /* ... */ }
private async ensureFundamentalData(symbol: string): Promise<FundamentalData> { /* ... */ }
private async ensureTechnicalData(symbol: string): Promise<TechnicalData> { /* ... */ }
```

##### 3. FactorLibrary.ts - Layer 2 Composition

**Location**: `/Users/michaellocke/WebstormProjects/Home/public/vfr-api/app/services/algorithms/FactorLibrary.ts`
**Key Functions**:

- Lines 1614-1676: `calculateMainComposite()` - **CORE SCORING LOGIC**
- Lines 65-83: Constructor with service dependencies
- Lines 88-150: `calculateFactor()` - Individual factor calculation

**Critical Integration Points**:

```typescript
// Lines 1614-1676: Main composite calculation
static async calculateMainComposite(
  symbol: string,
  marketData: MarketDataPoint,
  fundamentalData?: FundamentalDataPoint,
  technicalData?: TechnicalDataPoint,
  sentimentData?: any // ← Sentiment integration working
): Promise<CompositeResult> {

  // Sentiment integration (WORKING) - 10% weight
  if (sentimentData && sentimentData.score !== undefined) {
    const sentimentScore = this.normalizeSentimentScore(sentimentData.score);
    factors.push({
      name: 'sentiment',
      value: sentimentScore,
      weight: 0.10,
      confidence: sentimentData.confidence || 0.8
    });
  }

  // Technical analysis (BROKEN) - Missing VWAP integration
  if (technicalData) {
    const technicalScore = await this.calculateTechnicalOverallScore(symbol);
    factors.push({
      name: 'technical',
      value: technicalScore,
      weight: 0.35, // Should include VWAP
      confidence: 0.8
    });
  }

  // Fundamental analysis (BROKEN) - Cache issues
  // Macroeconomic analysis (BROKEN) - Import timing
}
```

### Service-Specific Implementation Requirements

#### Phase 1: Sentiment Analysis Reporting Fix (CRITICAL - 2 hours)

**Status**: Service functional, reporting broken
**File**: StockSelectionService.ts
**Issue**: Utilization tracking disconnected from actual execution

**Technical Fix**:

```typescript
// Current broken tracking in StockSelectionService.ts
private calculateServiceUtilization(): UtilizationMetrics {
  return {
    sentiment: this.sentimentService ? 100 : 0 // ← WRONG: checks instantiation
  };
}

// Fixed tracking
private async calculateServiceUtilization(symbol: string, executionResult: AlgorithmResult): Promise<UtilizationMetrics> {
  const metrics: UtilizationMetrics = {};

  // Check actual sentiment contribution from execution result
  if (executionResult.factors) {
    const sentimentFactor = executionResult.factors.find(f => f.name === 'sentiment');
    metrics.sentiment = sentimentFactor ? (sentimentFactor.weight * 100) : 0;
  }

  return metrics;
}
```

**Implementation Steps**:

1. Modify `calculateServiceUtilization()` to accept execution result
2. Check `executionResult.factors` for actual sentiment factor presence
3. Return real weight percentage instead of instantiation check
4. Update admin dashboard to display accurate metrics

#### Phase 2: Technical Analysis Integration (HIGH - 6 hours)

**Status**: TechnicalIndicatorService execution not propagated to utilization tracking
**Files**:

- AlgorithmConfigManager.ts (Configuration fix)
- FactorLibrary.ts (VWAP integration)
- TechnicalIndicatorService.ts (Execution tracking)

**Root Cause**: Single 'composite' factor masks individual technical indicators

**Technical Fix 1 - Configuration Granularity**:

```typescript
// File: AlgorithmConfigManager.ts, Line 604
// Current (BROKEN)
weights: [{ factor: "composite", weight: 1.0, enabled: true }];

// Fixed (GRANULAR)
weights: [
	// Technical Analysis factors (40% total weight)
	{ factor: "technical_overall_score", weight: 0.25, enabled: true },
	{ factor: "vwap_deviation", weight: 0.1, enabled: true }, // ← NEW VWAP
	{ factor: "rsi_14d", weight: 0.05, enabled: true },

	// Fundamental Analysis factors (25% total weight)
	{ factor: "quality_composite", weight: 0.15, enabled: true },
	{ factor: "pe_ratio", weight: 0.05, enabled: true },
	{ factor: "roe", weight: 0.05, enabled: true },

	// Other factors...
];
```

**Technical Fix 2 - VWAP Integration**:

```typescript
// File: FactorLibrary.ts - Add VWAP to technical calculation
async calculateTechnicalOverallScore(symbol: string): Promise<number> {
  // Current technical indicators
  const indicators = await this.technicalService.getIndicators(symbol);

  // ADD: VWAP integration
  const vwapData = await this.getVWAPData(symbol);
  let vwapScore = 0;
  if (vwapData && this.vwapService) {
    vwapScore = await this.vwapService.calculateVWAPScore(vwapData);
  }

  // Weighted combination
  const technicalScore = (
    indicators.rsi * 0.4 +          // Existing
    indicators.macd * 0.3 +         // Existing
    indicators.sma * 0.1 +          // Existing
    vwapScore * 0.2                 // NEW VWAP contribution
  );

  return this.normalizeScore(technicalScore);
}

// ADD: VWAP data retrieval
private async getVWAPData(symbol: string): Promise<VWAPData | null> {
  if (!this.vwapService) return null;

  try {
    return await this.vwapService.getVWAPAnalysis(symbol);
  } catch (error) {
    console.error(`VWAP data fetch failed for ${symbol}:`, error);
    return null;
  }
}
```

#### Phase 3: Fundamental Analysis Cache Fix (HIGH - 8 hours)

**Status**: Cache instance inconsistencies causing 0% utilization
**Root Cause**: Multiple cache instances + singleton pattern needed

**Technical Architecture Issue**:

```typescript
// Current problematic pattern across services
class ServiceA {
	constructor() {
		this.cache = new RedisCache(); // ← Instance 1
	}
}

class ServiceB {
	constructor() {
		this.cache = new RedisCache(); // ← Instance 2
	}
}

// Data stored in Instance 1 not accessible from Instance 2
```

**Technical Fix - Singleton Cache Pattern**:

```typescript
// File: app/services/cache/CacheService.ts
export class CacheService {
	private static instance: CacheService;
	private redisCache: RedisCache;
	private memoryCache: InMemoryCache;

	private constructor() {
		this.redisCache = new RedisCache();
		this.memoryCache = new InMemoryCache();
	}

	public static getInstance(): CacheService {
		if (!CacheService.instance) {
			CacheService.instance = new CacheService();
		}
		return CacheService.instance;
	}

	async get(key: string): Promise<any> {
		// Try Redis first, fallback to memory
		try {
			const data = await this.redisCache.get(key);
			return data;
		} catch (error) {
			return this.memoryCache.get(key);
		}
	}

	async set(key: string, value: any, ttl?: number): Promise<void> {
		// Store in both caches
		try {
			await this.redisCache.set(key, value, ttl);
		} catch (error) {
			console.warn("Redis cache failed, using memory fallback");
		}
		this.memoryCache.set(key, value, ttl);
	}
}
```

**Service Integration Pattern**:

```typescript
// Apply to all services
import { CacheService } from "../cache/CacheService";

class FundamentalDataService {
	private cache: CacheService;

	constructor() {
		this.cache = CacheService.getInstance(); // ← Singleton pattern
	}
}
```

#### Phase 4: Macroeconomic Analysis Import Fix (MEDIUM - 4 hours)

**Status**: Dynamic import timing issues causing 0% utilization
**Root Cause**: Asynchronous import resolution competing with execution

**Technical Issue**:

```typescript
// Current problematic pattern in AlgorithmEngine.ts
const macroData = await import("../financial-data/MacroeconomicAnalysisService").then(module =>
	module.MacroeconomicAnalysisService.getAnalysis(symbol)
);
// ↑ Dynamic import creates timing race conditions
```

**Technical Fix**:

```typescript
// File: AlgorithmEngine.ts - Top of file
import { MacroeconomicAnalysisService } from '../financial-data/MacroeconomicAnalysisService';

// In class method
private async ensureMacroeconomicData(symbol: string): Promise<MacroData> {
  const cacheKey = `macro_${symbol}`;
  let macroData = await this.cache.get(cacheKey);

  if (!macroData) {
    try {
      macroData = await MacroeconomicAnalysisService.getAnalysis(symbol);
      if (macroData && macroData.weight > 0) {
        await this.cache.set(cacheKey, macroData, 600); // 10min cache
      }
    } catch (error) {
      console.error(`Macroeconomic analysis failed for ${symbol}:`, error);
      // Return fallback instead of undefined
      macroData = {
        weight: 0,
        factors: [],
        confidence: 0,
        economicCycle: 'unknown'
      };
    }
  }
  return macroData;
}
```

### Decision Trees for Implementation

#### Service Integration Decision Tree

```
Service Implementation → Check Status → Determine Action
├── Working Service (Sentiment)
│   ├── Check utilization reporting → Fix tracking logic → Test reporting
│   └── Verify execution metrics → Update admin dashboard → Validate
├── Partially Working (Technical)
│   ├── Check configuration → Fix factor granularity → Add VWAP
│   ├── Check service connection → Integrate VWAPService → Test weights
│   └── Verify execution flow → Update utilization tracking → Validate
├── Broken Service (Fundamental)
│   ├── Check cache consistency → Implement singleton → Test access
│   ├── Check data flow → Add pre-fetch pattern → Test integration
│   └── Check service execution → Fix data propagation → Validate scoring
└── Import Issues (Macroeconomic)
    ├── Replace dynamic import → Use static import → Test resolution
    ├── Add error handling → Implement fallbacks → Test graceful degradation
    └── Verify integration → Update execution tracking → Validate metrics
```

#### Troubleshooting Decision Tree

```
Utilization Shows 0% → Diagnose Layer → Apply Fix
├── Service Instantiated But Not Executed
│   ├── Check AlgorithmEngine pre-fetch → Add ensureXData() method
│   ├── Check FactorLibrary integration → Add service parameter
│   └── Check execution tracking → Update utilization calculation
├── Service Executed But Not Tracked
│   ├── Check StockSelectionService tracking → Fix utilization logic
│   ├── Check execution result propagation → Add metrics to result
│   └── Check admin dashboard display → Update UI components
├── Cache Issues
│   ├── Check cache instance consistency → Implement singleton pattern
│   ├── Check cache key namespacing → Fix key conflicts
│   └── Check Redis/memory fallback → Test failover scenarios
└── Import/Timing Issues
    ├── Check dynamic vs static imports → Replace with static
    ├── Check async execution order → Add proper await chains
    └── Check error handling → Add comprehensive try/catch
```

### Testing and Validation Requirements

#### Integration Test Patterns

**Test Framework Configuration**:

```javascript
// jest.config.js - Memory optimization for real API testing
module.exports = {
	preset: "ts-jest",
	testEnvironment: "node",
	maxWorkers: 1,
	testTimeout: 300000, // 5 minutes for real API calls
	setupFilesAfterEnv: ["./jest.setup.js"],
	globalTeardown: "./jest.node-setup.js",
	collectCoverageFrom: ["app/services/**/*.ts", "!app/services/**/*.test.ts"],
	coverageDirectory: "docs/test-output/coverage",
	verbose: true,
	detectLeaks: false, // Disabled for memory optimization
	forceExit: true,
};
```

**Service Utilization Test Template**:

```typescript
// Test pattern for all services
describe("ServiceUtilizationTracking", () => {
	let stockSelectionService: StockSelectionService;
	const TEST_SYMBOL = "AAPL";

	beforeEach(() => {
		stockSelectionService = new StockSelectionService();
		/* all service dependencies */
	});

	it("should report accurate sentiment utilization", async () => {
		const result = await stockSelectionService.analyzeStock(TEST_SYMBOL);

		// Check execution result has sentiment data
		expect(result.executionResult.factors).toContainEqual(
			expect.objectContaining({ name: "sentiment", weight: expect.any(Number) })
		);

		// Check utilization reporting matches execution
		const sentimentFactor = result.executionResult.factors.find(f => f.name === "sentiment");
		expect(result.utilization.sentiment).toBe(sentimentFactor.weight * 100);
	});

	it("should integrate VWAP into technical analysis", async () => {
		const result = await stockSelectionService.analyzeStock(TEST_SYMBOL);

		// Check technical analysis includes VWAP component
		const technicalFactor = result.executionResult.factors.find(f => f.name === "technical");
		expect(technicalFactor.weight).toBe(35); // 35% total technical weight
		expect(technicalFactor.components).toContain("vwap"); // VWAP component included
	});

	// Similar tests for fundamental, macroeconomic services...
});
```

**Performance Validation**:

```typescript
describe("ServicePerformanceValidation", () => {
	it("should maintain sub-3-second analysis with all services", async () => {
		const startTime = Date.now();
		const result = await stockSelectionService.analyzeStock("MSFT");
		const endTime = Date.now();

		expect(endTime - startTime).toBeLessThan(3000);
		expect(result.utilization.total).toBeGreaterThan(0);
	});

	it("should handle API rate limits gracefully", async () => {
		// Test multiple rapid requests to trigger rate limits
		const promises = Array(10)
			.fill(0)
			.map(() => stockSelectionService.analyzeStock("TSLA"));

		const results = await Promise.allSettled(promises);
		const successful = results.filter(r => r.status === "fulfilled");

		expect(successful.length).toBeGreaterThan(0); // At least some succeed
		successful.forEach(result => {
			expect(result.value.utilization.total).toBeGreaterThan(0);
		});
	});
});
```

### Error Boundaries and Recovery Patterns

#### Service Failure Handling

```typescript
// Pattern for all service integrations
async executeWithResilience<T>(
  serviceName: string,
  serviceCall: () => Promise<T>,
  fallbackValue: T
): Promise<T> {
  try {
    const result = await serviceCall();

    // Log successful execution for utilization tracking
    this.executionMetrics.successfulServices.add(serviceName);

    return result;
  } catch (error) {
    console.error(`${serviceName} execution failed:`, error);

    // Log failure for utilization tracking
    this.executionMetrics.failedServices.add(serviceName);

    // Return fallback instead of breaking entire analysis
    return fallbackValue;
  }
}
```

#### Cache Failure Recovery

```typescript
// Cache access with automatic fallback
async getCachedData(key: string): Promise<any> {
  try {
    // Try Redis first
    return await this.redisCache.get(key);
  } catch (redisError) {
    console.warn('Redis cache failed, using memory fallback');
    try {
      return this.memoryCache.get(key);
    } catch (memoryError) {
      console.error('All caches failed:', { redisError, memoryError });
      return null;
    }
  }
}
```

### Performance Considerations and Monitoring

#### Memory Management for Real API Testing

```javascript
// jest.setup.js
const originalGC = global.gc;
if (typeof global.gc === 'function') {
  beforeEach(() => {
    global.gc();
  });

  afterEach(() => {
    global.gc();
  });
}

// Monitor memory usage
let memoryUsage: NodeJS.MemoryUsage[] = [];
beforeAll(() => {
  setInterval(() => {
    memoryUsage.push(process.memoryUsage());
  }, 5000);
});
```

#### Service Performance Metrics

```typescript
interface ServiceExecutionMetrics {
	serviceName: string;
	executionTime: number;
	cacheHitRatio: number;
	successRate: number;
	utilizationPercentage: number;
	errorCount: number;
	lastError?: string;
}

class ServiceMonitor {
	private metrics: Map<string, ServiceExecutionMetrics> = new Map();

	recordExecution(serviceName: string, success: boolean, executionTime: number) {
		const current = this.metrics.get(serviceName) || this.createDefaultMetrics(serviceName);

		current.executionTime = executionTime;
		current.successRate = success
			? Math.min(current.successRate + 0.1, 1.0)
			: Math.max(current.successRate - 0.1, 0.0);

		this.metrics.set(serviceName, current);
	}
}
```

## Implementation Timeline and Risk Assessment

### Phase 1 - Quick Wins (1-2 days, LOW risk)

1. **Sentiment Analysis Reporting** - 2 hours
    - Risk: Minimal - service already working
    - Files: StockSelectionService.ts (tracking fix)
    - Success Criteria: 10% utilization properly displayed

2. **Macroeconomic Import Fix** - 4 hours
    - Risk: Low - well-understood import timing issue
    - Files: AlgorithmEngine.ts (static import)
    - Success Criteria: 20% utilization, no import errors

### Phase 2 - Integration Fixes (3-5 days, MEDIUM risk)

3. **Technical Analysis + VWAP** - 6 hours
    - Risk: Medium - configuration + service integration
    - Files: AlgorithmConfigManager.ts, FactorLibrary.ts, TechnicalIndicatorService.ts
    - Success Criteria: 35% technical utilization including VWAP

### Phase 3 - Architecture Improvements (1-2 weeks, HIGH risk)

4. **Fundamental Analysis Cache Fix** - 8 hours
    - Risk: High - architecture changes affecting multiple services
    - Files: CacheService.ts (singleton), all service constructors
    - Success Criteria: 25% utilization, consistent cache access

### Rollback Procedures

Each phase includes specific rollback procedures:

- **Phase 1**: Revert to previous tracking logic
- **Phase 2**: Disable new configuration, revert to composite factor
- **Phase 3**: Disable singleton pattern, revert to individual cache instances

## Success Metrics and Validation

### Primary Technical Metrics

| Metric                        | Current                        | Target              | Validation Method            |
| ----------------------------- | ------------------------------ | ------------------- | ---------------------------- |
| **Sentiment Utilization**     | 0% (misreported)               | 10%                 | Admin dashboard + test suite |
| **Technical Utilization**     | 0%                             | 35% (includes VWAP) | Factor weight analysis       |
| **Fundamental Utilization**   | 0%                             | 25%                 | Cache hit analysis + scoring |
| **Macroeconomic Utilization** | 0%                             | 20%                 | Import success + execution   |
| **Overall System Accuracy**   | ~50% (due to missing services) | 100%                | Composite scoring validation |

### Validation Commands

```bash
# Type safety validation
npm run type-check

# Integration test with real APIs
npm test -- --testNamePattern="ServiceUtilization"

# Performance validation
npm run test:performance:single

# Cache consistency check
npm test -- app/services/cache/

# End-to-end validation
curl -X POST http://localhost:3000/api/stocks/analysis \
  -H "Content-Type: application/json" \
  -d '{"symbol": "AAPL"}' | jq '.utilization'
```

This comprehensive technical documentation provides AI agents with the complete context needed to understand and implement the service utilization fixes across the VFR platform, including specific file paths, function signatures, architectural patterns, and validation procedures.
