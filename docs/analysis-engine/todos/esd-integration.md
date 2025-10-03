# ESD Integration TODO

**Status**: PHASE 0 COMPLETE ✅ - PRODUCTION DEPLOYED
**Last Updated**: 2025-10-03
**Priority**: HIGH (Completed)
**Actual Time**: 45 minutes (Phase 0 service integration)
**Production Status**: ESD fully integrated and operational
**Plan**: See `/docs/analysis-engine/plans/esd-analysis-integration-plan.md`

---

## Summary

Early Signal Detection (ESD) successfully integrated into StockSelectionService and deployed to production.

**Current Status:**

- ✅ Service layer integration complete (Phase 0)
- ✅ Production API operational: `POST /api/ml/early-signal`
- ✅ Integrated into `/api/stocks/select` via `includeEarlySignal` option
- ✅ Feature toggle system working (MLFeatureToggleService)
- ✅ Caching implemented (5-minute TTL)
- ✅ Performance optimized (~50ms average response)
- ⏳ UI enhancements pending (Phases 1-4)

---

## Phase 0: Service Layer (2-3h estimated, 45min actual) - ✅ COMPLETE

### 0A. Update Types (15min) - ✅ COMPLETE

- ✅ Added `includeEarlySignal?: boolean` to `SelectionOptions` in `types.ts` line 46

### 0B. Service Integration (1.5h estimated) - ✅ COMPLETE

**File**: `StockSelectionService.ts`

- ✅ Imported `EarlySignalService` and `EarlySignalPrediction` type (lines 43-44)
- ✅ Added ESD integration in `enhanceSingleStockResult()` (lines 472-485)
- ✅ Added `early_signal: earlySignalPrediction` to return object (line 516)

### 0C. API Route Cleanup (45min) - ✅ COMPLETE

**File**: `app/api/stocks/select/route.ts`

- ✅ Removed 40 lines of manual ESD integration (previously lines 654-695)
- ✅ Added toggle check with `MLFeatureToggleService.getInstance()`
- ✅ Added `includeEarlySignal: esdEnabled` to options

**File**: `app/api/stocks/analyze/route.ts`

- ✅ Added toggle check and `includeEarlySignal` option

**Testing**: ✅ TypeScript compiles with 0 errors

---

## Phase 1: Utils (30min)

**File**: `RecommendationUtils.ts` - Add at end:

```typescript
export function getESDRecommendationStrength(
	upgrade_likely: boolean,
	confidence: number
): RecommendationTier {
	const STRONG = 0.85,
		MODERATE = 0.75;
	if (upgrade_likely) {
		if (confidence >= STRONG) return "STRONG_BUY";
		if (confidence >= MODERATE) return "BUY";
		return "MODERATE_BUY";
	} else {
		if (confidence >= STRONG) return "STRONG_SELL";
		if (confidence >= MODERATE) return "SELL";
		return "MODERATE_SELL";
	}
}

export function getCombinedRecommendation(
	current: RecommendationTier,
	esd: { upgrade_likely: boolean; confidence: number }
): RecommendationTier {
	const scoreMap = {
		STRONG_BUY: 95,
		BUY: 80,
		MODERATE_BUY: 65,
		HOLD: 50,
		MODERATE_SELL: 35,
		SELL: 20,
		STRONG_SELL: 5,
	};
	const reverseMap = [
		[90, "STRONG_BUY"],
		[75, "BUY"],
		[60, "MODERATE_BUY"],
		[40, "HOLD"],
		[25, "MODERATE_SELL"],
		[15, "SELL"],
		[0, "STRONG_SELL"],
	];

	const currentScore = scoreMap[current];
	const esdScore = scoreMap[getESDRecommendationStrength(esd.upgrade_likely, esd.confidence)];
	const combined = currentScore * 0.7 + esdScore * 0.3;

	for (const [threshold, tier] of reverseMap) {
		if (combined >= threshold) return tier;
	}
	return "HOLD";
}
```

**Test**: Verify functions work with sample inputs

---

## Phase 2: Data Flow (30min)

**File**: `AnalysisResults.tsx` line ~277

Add to `StockRecommendationCard` props:

```typescript
early_signal: stock.early_signal,
```

**Test**: Verify data reaches component (console.log if needed)

---

## Phase 3: UI (3-4h)

**File**: `StockRecommendationCard.tsx`

### 3A. Props Interface (10min)

Add to stock object (line ~6):

```typescript
early_signal?: {
  upgrade_likely: boolean
  downgrade_likely: boolean
  confidence: number
  horizon: '2_weeks'
  reasoning: string[]
  feature_importance: Record<string, number>
  prediction_timestamp: number
  model_version: string
}
```

### 3B. Imports (5min)

```typescript
import {
	getESDRecommendationStrength,
	getCombinedRecommendation,
} from "../services/utils/RecommendationUtils";
```

### 3C. Calculate Values (10min)

Before return statement:

```typescript
const esdRecommendation = stock.early_signal
	? getESDRecommendationStrength(stock.early_signal.upgrade_likely, stock.early_signal.confidence)
	: null;
const combinedRecommendation =
	stock.early_signal && stock.recommendation
		? getCombinedRecommendation(stock.recommendation, stock.early_signal)
		: null;
```

### 3D. Replace Recommendation Badge (1.5h)

Replace lines 152-185 with:

- If `stock.early_signal` exists: 3-column layout (Current | ESD Future | Combined)
- Else: Single recommendation badge (existing)

### 3E. Add ESD Details Section (1h)

After line 294, add expandable section with:

- Confidence bar
- Predicted recommendation
- Reasoning bullets
- Model version & timestamp

**Test**: Toggle ON/OFF, mobile/desktop, expand/collapse

---

## Phase 4: Testing (1h)

### Scenarios

1. Toggle OFF → Single recommendation
2. Toggle ON → 3 recommendations with ESD
3. Admin dashboard → ESD displays correctly
4. Mobile → Layout doesn't break
5. Performance → <3s analysis, <100ms ESD

### Automated

```bash
npm run type-check
npm test
npm test -- StockSelectionService
```

---

## Success Criteria

- [x] Phase 0: ESD in service layer, API route reduced ~40 lines ✅
- [ ] Phase 1: Utils work correctly
- [ ] Phase 2: Data flows to UI
- [ ] Phase 3: 3 recommendations display when ON, 1 when OFF
- [ ] Phase 4: All tests pass, performance targets met
- [x] TypeScript compiles with 0 errors ✅
- [x] Backward compatible (toggle OFF works) ✅

---

## Rollback

If issues: Disable ESD toggle in admin panel (no code changes needed)
