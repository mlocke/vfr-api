# ML Integration Tests - Phase 4.2

## Overview

This directory contains integration tests for the ML Enhancement Layer (Phase 4.2).

## Test Files

1. **ml-stock-analysis.test.ts** - ML Prediction Testing
   - Tests ML predictions with real trained models
   - Validates prediction accuracy vs baseline VFR
   - Tests confidence scoring ranges (0-1)
   - Verifies ML contribution to composite scores (15% weighting)
   - Tests multiple prediction horizons (1d, 7d, 30d)

2. **ml-fallback.test.ts** - Graceful Fallback Validation
   - Simulates ML service failures
   - Verifies VFR analysis continues without degradation
   - Tests partial ML failures (some symbols succeed, others fail)
   - Validates error logging and monitoring
   - Confirms include_ml=false preserves classic VFR

3. **ml-performance.test.ts** - Performance Testing
   - Single stock analysis: <3s total (target)
   - ML overhead: <100ms per prediction (target)
   - Multi-stock analysis: 25+ symbols in parallel
   - Memory footprint: <2GB additional for ML layer (target)
   - Cache hit rate: >85% for repeated predictions (target)

4. **ml-compatibility.test.ts** - Backward Compatibility
   - Verifies all existing API contracts unchanged
   - Tests include_ml=false preserves classic VFR mode
   - Validates default behavior (ML disabled by default)
   - Tests existing integration tests still pass
   - Confirms zero breaking changes

## Current Status: BLOCKED

Integration tests are **created but not passing** due to the following blocking issues:

### Blocking Issues Identified

1. **ML Model Loading Failure**
   ```
   Failed to load model: TypeError: Cannot convert undefined or null to object
   at FeatureNormalizer.loadParams (app/services/ml/early-signal/FeatureNormalizer.ts:109:30)
   ```
   - The normalizer.json file is missing or has incorrect format
   - Model loading in RealTimePredictionEngine is failing
   - This prevents ANY ML predictions from running

2. **Zod Validation Error in API**
   ```
   Invalid option: expected one of "single"|"sector"|"multiple"
   ```
   - The API is receiving mode values but validation schema may be too strict
   - Need to verify request/response format compatibility

3. **Test Timeout Issues**
   - Integration tests are timing out after 2 minutes
   - Need to investigate if this is due to ML loading failures or other bottlenecks
   - May need to increase timeout for first-run ML initialization

## Next Steps (Phase 4.2 Completion)

### 1. Fix ML Model Loading (CRITICAL)
- [ ] Verify normalizer.json exists at `models/early-signal/v1.0.0/normalizer.json`
- [ ] Validate normalizer.json format matches expected structure
- [ ] Fix FeatureNormalizer.loadParams() to handle missing/invalid data gracefully
- [ ] Test RealTimePredictionEngine initialization in isolation

### 2. Fix API Validation
- [ ] Review Zod schema in `/api/stocks/analyze/route.ts`
- [ ] Ensure request format matches between tests and API expectations
- [ ] Add better error messages for validation failures

### 3. Run Integration Tests
- [ ] Fix model loading issue
- [ ] Re-run ml-stock-analysis.test.ts
- [ ] Re-run ml-fallback.test.ts
- [ ] Re-run ml-performance.test.ts
- [ ] Re-run ml-compatibility.test.ts

### 4. Performance Validation
- [ ] Measure ML overhead (target: <100ms)
- [ ] Measure total analysis time (target: <3s)
- [ ] Validate cache effectiveness (target: >85% hit rate)

### 5. Documentation
- [ ] Update ML-REMAINING-TASKS.md with findings
- [ ] Document known issues and workarounds
- [ ] Create troubleshooting guide

## Running the Tests

**WARNING**: Tests currently fail due to ML model loading issues. Do not run until blocking issues are resolved.

Once fixed, run:

```bash
# Run all integration tests
npm test -- __tests__/integration

# Run specific test file
npm test -- __tests__/integration/ml-stock-analysis.test.ts

# Run with verbose output
npm test -- __tests__/integration --verbose
```

## Test Requirements

- Dev server must be running on port 3000
- Redis must be running
- All ML models must be properly loaded
- API keys must be configured

## Success Criteria

- ✅ ML predictions complete in <100ms
- ✅ Total analysis time remains <3s
- ✅ Graceful fallback verified in all failure scenarios
- ✅ Backward compatibility: 100% existing tests pass
- ✅ Multi-stock analysis: 25+ symbols without performance degradation
- ✅ Memory overhead: <2GB for ML layer
- ✅ Cache hit rate: >85%

## Phase 4.2 Findings Summary

### What Works ✅
- Integration test files created with comprehensive test coverage
- Test structure follows best practices
- Tests use real API calls (NO MOCK DATA)
- Dev server runs and processes requests
- VFR analysis continues to work

### What's Broken ❌
- ML model loading (normalizer.json issue)
- ML predictions fail completely
- Integration tests timeout
- Model initialization errors

### Impact
- **Phase 4.2 cannot be marked complete** until ML model loading is fixed
- **Phase 4.3 (Production Validation)** is blocked
- **Ensemble Service (Phase 4.2-4.3)** is also blocked

## Recommended Approach

1. **FIX ML MODEL LOADING FIRST** - This is the root cause
2. Verify normalizer.json file structure
3. Test RealTimePredictionEngine in isolation
4. Re-run integration tests
5. Proceed with Phase 4.2 validation

## Contact

For questions about these tests, see:
- `docs/analysis-engine/todos/ML-REMAINING-TASKS.md`
- `app/services/ml/CLAUDE.md`
