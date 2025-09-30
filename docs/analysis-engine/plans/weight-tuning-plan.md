# Analysis Engine Weight Tuning Plan
**Date**: September 30, 2025
**Status**: In Progress
**Objective**: Systematically tune analysis engine weights using real-world sentiment data to align VFR predictions with market consensus

---

## Overview
Systematically tune the analysis engine weights using 9 real-world sentiment files to align VFR predictions with market consensus while maintaining data integrity and ensuring calculations remain in a single location.

---

## Single Calculation Location - VERIFIED ✅

**Location**: `app/services/algorithms/FactorLibrary.ts:2150-2345`
**Method**: `calculateMainComposite()`

### Current Weight Allocation (PHASE 2 CALIBRATION)
All weights in 0-1 range, totaling 1.000:

```typescript
const baseTechnicalWeight = 0.280      // 28.0%
const baseFundamentalWeight = 0.280    // 28.0%
const adjustedMacroWeight = 0.200      // 20.0%
const adjustedSentimentWeight = 0.180  // 18.0%
const adjustedAlternativeWeight = 0.060 // 6.0%
  - Options: 0.025 (2.5%)
  - ESG: 0.015 (1.5%)
  - Short Interest: 0.015 (1.5%)
  - Extended Market: 0.005 (0.5%)
```

**Total**: 100.0% (1.000)

---

## Stock Test Cases with Expected Sentiment

### Strong Buy (Scores: 0.75-0.95)
1. **NVDA** - Overwhelmingly positive, AI leadership, 80-90% market share
2. **MSFT** - Predominantly bullish, AI/cloud dominance, strong buy consensus
3. **AMZN** - Overwhelmingly positive, AWS leadership, ~20% upside potential

### Moderate Buy (Scores: 0.60-0.75)
4. **GOOGL** - Largely positive, AI/cloud growth, best quarter in 20 years
5. **AAPL** - Moderately bullish, AI Intelligence rollout, golden cross signal
6. **BAC** - Generally positive, 80%+ analysts buy, 50% rebound from lows
7. **WFC** - Stable-to-positive, regulatory cap lifted, cost efficiency gains

### Hold/Mixed (Scores: 0.45-0.60)
8. **TSLA** - Mixed signals, recent 30% surge but hold consensus, high volatility
9. **FORD** - Cautious/neutral, hold rating, EV transition challenges, high debt

---

## Iterative Process Per Stock

### Phase 1: Baseline Testing
1. Ensure dev server is running (`npm run dev:clean`)
2. Navigate to stock analysis page (http://localhost:3000/stock-intelligence)
3. Run stock through engine via UI search
4. **Record VFR Output:**
   - Overall score (0-1 scale)
   - Recommendation tier (STRONG_BUY, BUY, HOLD, SELL, STRONG_SELL)
   - Component scores breakdown:
     - Technical score & weight %
     - Fundamental score & weight %
     - Sentiment score & weight %
     - Macroeconomic score & weight %
     - Alternative data score & weight %
   - Console log verification of weight totals

### Phase 2: Sentiment Comparison
4. Open corresponding sentiment file from `docs/misc/[stock]-sentiment.md`
5. **Compare VFR vs Market Consensus:**
   - Is VFR recommendation aligned with analyst consensus?
   - Is VFR too bullish (score too high)?
   - Is VFR too bearish (score too low)?
   - Which specific components are misaligned?
6. **Document Discrepancies:**
   - Note exact score differences
   - Identify which weight components need adjustment
   - Consider sector-specific factors

### Phase 3: Weight Adjustment Strategy

**Guiding Principles:**
- Make MINIMAL changes (±0.01 to ±0.05 increments)
- Adjust one weight category at a time
- Ensure total weights always = 1.000
- Maintain financial justification for all changes
- Consider market-cap adjustments already in place

**Common Adjustment Scenarios:**
- **Tech stocks (NVDA, MSFT, GOOGL)**: May need higher sentiment/momentum weight
- **Financial stocks (BAC, WFC)**: May need higher fundamental weight
- **Growth stocks (TSLA, AMZN)**: May need balanced technical/sentiment
- **Value plays (FORD)**: May need higher fundamental/lower momentum weight

**Edit Location:** `app/services/algorithms/FactorLibrary.ts:2182-2194`

```typescript
// Example adjustment
const baseTechnicalWeight = 0.280      // Adjust if technical signals misaligned
const baseFundamentalWeight = 0.280    // Adjust if fundamentals underweighted
const adjustedMacroWeight = 0.200      // Adjust if macro context ignored
const adjustedSentimentWeight = 0.180  // Adjust if sentiment misweighted
const adjustedAlternativeWeight = 0.060 // Adjust alternative data components
```

### Phase 4: Validation Against "Curve Fitting"

**Critical Questions Before Each Adjustment:**
1. Does this adjustment make financial/analytical sense?
2. Would this weight work for other stocks in the same sector?
3. Are we preserving the fundamental logic of the analysis?
4. Is the weight still grounded in real-world market behavior?
5. Are we maintaining objectivity, not just matching one data point?

**Red Flags to Avoid:**
- ❌ Changing weights by >10% (0.10) in one iteration
- ❌ Adjusting weights to match one stock without considering others
- ❌ Making changes that contradict financial theory
- ❌ Creating weights that only work for historical data
- ❌ Breaking the single-location calculation rule

**Green Flags:**
- ✅ Small, incremental adjustments (0.01-0.05)
- ✅ Changes supported by financial literature
- ✅ Adjustments that improve multiple stock predictions
- ✅ Weights that make intuitive sense across sectors
- ✅ Maintaining calculation integrity

### Phase 5: Re-test & Iterate
15. Restart dev server (if code changes made)
16. Re-run stock through engine
17. Compare new output vs sentiment file
18. **Decision Point:**
    - If aligned within ±1 tier → Mark complete, move to next stock
    - If still misaligned → Return to Phase 3 (max 3 iterations per stock)
    - If unable to align → Document rationale and move on

### Phase 6: Cross-Stock Validation
20. After tuning all 9 stocks, re-test earlier stocks
21. Verify tuning later stocks didn't break earlier alignments
22. Make minor fine-tuning adjustments if needed
23. Document any trade-offs or conflicts between stocks

---

## Success Criteria

### Alignment Metrics
- ✅ VFR recommendations align with market sentiment within ±1 tier
- ✅ Strong Buy stocks score 0.75-0.95
- ✅ Moderate Buy stocks score 0.60-0.75
- ✅ Hold stocks score 0.45-0.60

### Technical Integrity
- ✅ All weights remain in 0-1 range
- ✅ Total weights = 1.000 (verified in console logs)
- ✅ Single calculation location maintained (FactorLibrary.ts:2150-2345)
- ✅ No duplicate calculation logic introduced

### Quality Assurance
- ✅ No "data massaging" - all weights financially justified
- ✅ Tests pass: `npm test`
- ✅ Type checking passes: `npm run type-check`
- ✅ Dev server runs without errors
- ✅ Console logs show correct weight breakdown

---

## Output Deliverables

### Code Changes
1. **Updated FactorLibrary.ts** with tuned weights
   - Lines 2182-2194: Adjusted weight constants
   - All changes documented with comments explaining rationale

### Documentation
2. **Weight Tuning Results Log** (`docs/analysis-engine/tuning-results.md`)
   - Before/after scores for each stock
   - Weight adjustments made and why
   - Validation notes

3. **Final Weight Rationale** (`docs/analysis-engine/weight-rationale.md`)
   - Financial justification for each weight
   - Sector considerations
   - Market condition context

### Validation Reports
4. **Test Results** showing all 9 stocks align with sentiment
5. **Cross-validation matrix** showing no regressions
6. **Performance metrics** confirming sub-3-second analysis times maintained

---

## Testing Order & Rationale

### Order of Execution
1. **NVDA** (Start) - Clearest strong buy, establishes baseline
2. **MSFT** - Similar profile to NVDA, validates tech weights
3. **GOOGL** - Moderate buy tech, tests weight scaling
4. **AMZN** - Strong buy but different sector mix
5. **AAPL** - Moderate buy with unique characteristics
6. **TSLA** - Mixed signals, tests edge cases
7. **BAC** - Financial sector, different weight needs
8. **WFC** - Financial sector validation
9. **FORD** (End) - Hold rating, validates conservative weights

### Rationale
- Start with clear cases (NVDA) to establish baseline
- Group similar stocks (tech, finance) to identify sector patterns
- End with edge cases (TSLA, FORD) to test robustness
- Re-validate all at end for cross-stock consistency

---

## Risk Mitigation

### Backup Strategy
- Git commit before each major weight adjustment
- Keep running log of all changes in separate file
- Maintain copy of original weights for rollback

### If Alignment Fails
- Document why alignment wasn't possible
- Note specific market factors not captured by model
- Consider if additional data sources needed (outside scope)

### Quality Gates
- After every 3 stocks, run full test suite
- Verify no performance degradation
- Check for console errors or warnings

---

## Progress Tracking

Use TodoWrite tool to track:
- [ ] Setup & dev server start
- [ ] NVDA baseline & tuning
- [ ] MSFT baseline & tuning
- [ ] GOOGL baseline & tuning
- [ ] AMZN baseline & tuning
- [ ] AAPL baseline & tuning
- [ ] TSLA baseline & tuning
- [ ] BAC baseline & tuning
- [ ] WFC baseline & tuning
- [ ] FORD baseline & tuning
- [ ] Cross-validation
- [ ] Final validation (tests + type-check)

---

## Notes & Reminders

- **KISS Principle**: Keep it Simple, Stupid - minimal changes only
- **Single Location**: All calculations in FactorLibrary.ts:2150-2345
- **0-1 Range**: All weights and scores must be 0-1
- **Total = 1.000**: Weights must sum to exactly 1.000
- **No Assumptions**: Ask questions if unclear
- **Validate Everything**: Never assume a fix works - test it
- **Document Everything**: Keep detailed log of all changes
