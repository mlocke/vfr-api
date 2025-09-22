# SentimentAnalysisService Performance Testing Guide

## Overview

This guide covers the comprehensive performance testing strategy for the SentimentAnalysisService, designed to validate the <500ms response time target and memory efficiency requirements while using real NewsAPI data sources.

## Performance Requirements

### Response Time Targets
- **Single Stock Analysis**: <500ms
- **Bulk Processing**: Proportional scaling with concurrency optimization
- **Cache Hit Operations**: <50ms
- **Concurrent Requests**: <1000ms (2x single stock target)

### Memory Efficiency Targets
- **Memory Leak Prevention**: <50MB growth over bulk operations
- **Memory Per Operation**: <10MB heap growth per analysis
- **Garbage Collection**: Efficient cleanup between operations

### Cache Performance Targets
- **Hit Rate**: >80% after warm-up phase
- **Cache Response Time**: <50ms for cached data
- **Cache Efficiency**: Minimize cache misses during repeated operations

## Test Structure

### Performance Test Suite Location
```
app/services/financial-data/__tests__/SentimentAnalysisService.performance.test.ts
```

### Supporting Utilities
```
app/services/financial-data/__tests__/utils/performance-utils.ts
```

## Test Categories

### 1. Single Stock Sentiment Analysis Performance
**Purpose**: Validate core performance requirement of <500ms response time

**Test Cases**:
- Single stock analysis timing validation
- Consistent performance across different stocks (AAPL, MSFT, GOOGL, TSLA)
- Memory usage monitoring per operation

**Key Metrics**:
- Response time per stock
- Memory delta per operation
- Success rate across different stocks

### 2. Memory Leak Prevention Tests
**Purpose**: Ensure no memory leaks during bulk processing operations

**Test Cases**:
- Bulk processing memory growth monitoring
- Resource cleanup after failed operations
- Memory usage trending over multiple operations

**Key Metrics**:
- Total memory growth over test duration
- Peak memory usage during operations
- Memory cleanup efficiency after errors

### 3. Parallel Processing Efficiency
**Purpose**: Validate efficient handling of concurrent sentiment analysis requests

**Test Cases**:
- Sequential vs parallel execution comparison
- Concurrent request handling without performance degradation
- Resource utilization optimization during parallel processing

**Key Metrics**:
- Performance difference between sequential and parallel processing
- Success rate under concurrent load
- Memory efficiency per operation in parallel scenarios

### 4. Cache Performance Validation
**Purpose**: Ensure cache hit rate >80% and optimal cache performance

**Test Cases**:
- Cache hit rate measurement after warm-up
- Performance maintenance with cache misses
- Cache efficiency under different access patterns

**Key Metrics**:
- Cache hit rate percentage
- Response time for cached vs uncached requests
- Cache memory overhead

### 5. Real API Integration Performance
**Purpose**: Test performance characteristics with real NewsAPI integration

**Test Cases**:
- API rate limiting handling
- Network timeout management
- Performance under varying API response times

**Key Metrics**:
- Success rate under rate limiting
- Timeout handling efficiency
- Performance degradation under network latency

### 6. Garbage Collection Optimization
**Purpose**: Validate efficient memory management and GC performance

**Test Cases**:
- Memory cleanup efficiency during bulk operations
- Performance consistency across GC cycles
- Memory fragmentation prevention

**Key Metrics**:
- Memory freed by garbage collection
- Performance variance across GC cycles
- Memory fragmentation indicators

## Running Performance Tests

### Prerequisites

1. **Environment Setup**:
```bash
export NEWSAPI_KEY="your_newsapi_key_here"
export NODE_OPTIONS="--expose-gc --max-old-space-size=4096"
```

2. **Dependencies**:
```bash
npm install
```

### Execution Commands

#### Run Full Performance Test Suite
```bash
npm test -- SentimentAnalysisService.performance.test.ts
```

#### Run Specific Performance Category
```bash
# Single stock performance tests
npm test -- --testNamePattern="Single Stock Sentiment Analysis Performance"

# Memory leak tests
npm test -- --testNamePattern="Memory Leak Prevention"

# Cache performance tests
npm test -- --testNamePattern="Cache Performance Validation"
```

#### Run with Enhanced Monitoring
```bash
npm test -- SentimentAnalysisService.performance.test.ts --verbose --logHeapUsage
```

### Performance Test Configuration

#### Jest Configuration for Performance Testing
```javascript
// jest.config.js - Performance test specific settings
{
  testTimeout: 300000, // 5 minutes for comprehensive tests
  maxWorkers: 1, // Single worker for consistent performance measurement
  logHeapUsage: true, // Memory monitoring
  detectOpenHandles: true, // Resource leak detection
  forceExit: false // Ensure proper cleanup
}
```

#### Memory Optimization
```javascript
// Node.js flags for performance testing
--expose-gc              // Enable manual garbage collection
--max-old-space-size=4096 // Increase heap size for bulk operations
--trace-gc               // Optional: GC tracing for debugging
```

## Performance Monitoring

### Real-time Metrics Collection

The test suite includes comprehensive metrics collection:

```typescript
interface PerformanceMetrics {
  duration: number           // Operation duration in ms
  memoryUsage: {            // Memory usage tracking
    before: NodeJS.MemoryUsage
    after: NodeJS.MemoryUsage
    delta: Partial<NodeJS.MemoryUsage>
  }
}

interface CacheMetrics {
  hits: number              // Cache hit count
  misses: number           // Cache miss count
  hitRate: number          // Hit rate percentage
}
```

### Performance Report Generation

Automated performance reports include:
- Response time analysis
- Memory efficiency metrics
- Cache performance statistics
- Comparative benchmarks
- Pass/fail status against targets

## Test Data and Symbols

### Real Stock Symbols Used
- **AAPL** (Apple Inc.) - High news volume, consistent data
- **MSFT** (Microsoft) - Technology sector representative
- **GOOGL** (Alphabet) - Search and AI news coverage
- **TSLA** (Tesla) - Volatile news sentiment, high coverage

### API Rate Limiting Considerations
- Tests designed to handle NewsAPI rate limits gracefully
- Implements retry logic and fallback strategies
- Monitors and reports API quota usage

## Performance Benchmarks and Targets

### Response Time Benchmarks
| Operation Type | Target (ms) | Acceptable (ms) | Critical (ms) |
|----------------|-------------|-----------------|---------------|
| Single Stock   | <500        | <750           | <1000        |
| Bulk (4 stocks)| <1500       | <2000          | <3000        |
| Cache Hit      | <50         | <100           | <200         |
| Cold Start     | <2000       | <3000          | <5000        |

### Memory Usage Benchmarks
| Operation Type | Target (MB) | Acceptable (MB) | Critical (MB) |
|----------------|-------------|-----------------|---------------|
| Single Analysis| <10         | <20            | <50          |
| Bulk Processing| <50         | <100           | <200         |
| Memory Growth  | <50         | <100           | <200         |

### Cache Performance Benchmarks
| Metric         | Target      | Acceptable     | Critical     |
|----------------|-------------|----------------|--------------|
| Hit Rate       | >80%        | >60%           | >40%         |
| Cache Response | <50ms       | <100ms         | <200ms       |

## Troubleshooting Performance Issues

### Common Performance Problems

1. **High Response Times**
   - Check NewsAPI quota and rate limiting
   - Verify network connectivity and latency
   - Monitor cache hit rates
   - Review memory usage patterns

2. **Memory Leaks**
   - Enable garbage collection monitoring
   - Check for unclosed connections or timers
   - Verify proper cleanup in error scenarios
   - Monitor heap growth patterns

3. **Cache Performance Issues**
   - Verify cache configuration and TTL settings
   - Check cache key generation consistency
   - Monitor cache memory usage
   - Validate cache eviction policies

### Debug Commands

#### Memory Analysis
```bash
# Run with memory profiling
node --expose-gc --trace-gc --max-old-space-size=4096 node_modules/.bin/jest SentimentAnalysisService.performance.test.ts

# Heap dump analysis (requires heapdump package)
node --expose-gc --max-old-space-size=4096 -e "require('heapdump')" node_modules/.bin/jest
```

#### Performance Profiling
```bash
# CPU profiling
node --prof node_modules/.bin/jest SentimentAnalysisService.performance.test.ts
node --prof-process isolate-*.log > profile.txt
```

## Continuous Integration Integration

### GitHub Actions Configuration
```yaml
performance-tests:
  runs-on: ubuntu-latest
  env:
    NEWSAPI_KEY: ${{ secrets.NEWSAPI_KEY }}
    NODE_OPTIONS: "--expose-gc --max-old-space-size=4096"
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '18'
    - run: npm ci
    - run: npm run test:performance
    - uses: actions/upload-artifact@v4
      if: always()
      with:
        name: performance-report
        path: docs/test-output/performance/
```

### Performance Regression Detection
- Automated comparison against baseline metrics
- Performance trend tracking over time
- Alerts for significant performance degradation
- Integration with monitoring dashboards

## Performance Optimization Recommendations

### Code-Level Optimizations
1. **Caching Strategy**: Implement multi-level caching with appropriate TTL
2. **Connection Pooling**: Reuse HTTP connections for API calls
3. **Parallel Processing**: Optimize concurrent request handling
4. **Memory Management**: Implement proper cleanup and resource disposal

### Infrastructure Optimizations
1. **Redis Configuration**: Optimize cache configuration for performance
2. **Network Optimization**: Use CDN and edge caching where applicable
3. **Resource Allocation**: Configure appropriate memory and CPU limits
4. **Load Balancing**: Distribute load across multiple instances

### Monitoring and Alerting
1. **Real-time Monitoring**: Implement comprehensive performance monitoring
2. **Alerting Thresholds**: Set up alerts for performance degradation
3. **Performance Dashboards**: Create visibility into key performance metrics
4. **Automated Scaling**: Implement auto-scaling based on performance metrics

## Performance Test Results Archive

Performance test results are automatically archived to:
- `docs/test-output/performance/`
- Historical trending data for performance regression analysis
- Detailed reports with memory usage patterns and response time distributions

For questions or issues with performance testing, refer to the troubleshooting section or consult the development team.