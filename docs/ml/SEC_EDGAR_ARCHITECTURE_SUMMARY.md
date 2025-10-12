# SEC EDGAR Integration - Architecture Summary

**Quick Reference Guide**

## Overview

This integration provides FREE insider trading and institutional ownership data from SEC EDGAR with proper caching, rate limiting, and error handling for the Smart Money Flow ML pipeline.

---

## Key Architectural Decisions

### 1. NO CHANGES to Rate Limiting ✅

**Current implementation is production-ready:**
- 100ms delay = 10 req/sec (respects SEC limit)
- Queue-based serialization prevents concurrent violations
- No external libraries needed

**Location:** `SECEdgarAPI.ts` lines 322-364

### 2. NO CHANGES to Caching Strategy ✅

**Cache-first pattern already implemented:**
- Check cache FIRST before every API call
- 7-day TTL (effectively permanent for historical data)
- File-based storage in `data/cache/smart-money/`
- Target: >95% cache hit rate on second run

**Location:** `SmartMoneyDataCache.ts` (fully implemented)

### 3. MINIMAL CHANGES to HybridSmartMoneyDataService

**Add these components:**

```typescript
// 1. Add property (line 50)
private secAPI: SECEdgarAPI;

// 2. Initialize in constructor (line 56)
this.secAPI = new SECEdgarAPI();

// 3. Add type mapping method
private mapInsiderTransactionFromInstitutional(
  secTx: import('../../financial-data/types').InsiderTransaction,
  symbol: string
): InsiderTransaction {
  return {
    symbol,
    filingDate: secTx.filingDate,
    transactionDate: secTx.transactionDate,
    transactionType: this.convertTransactionType(secTx.transactionCode),
    securitiesTransacted: secTx.shares,
    price: secTx.pricePerShare || 0,
    securitiesOwned: secTx.sharesOwnedAfter,
    typeOfOwner: secTx.relationship.join(', ') || 'Unknown',
    reportingName: secTx.reportingOwnerName,
  };
}

// 4. Add transaction code converter
private convertTransactionType(code: string): 'P' | 'S' {
  const buyCodesMap = new Set(['P', 'A', 'J']);
  return buyCodesMap.has(code) ? 'P' : 'S';
}
```

### 4. REPLACE Mock Parsing in SECEdgarAPI

**Two methods need real XML parsing:**

```typescript
// Replace lines 470-508
private parse13FHoldings(
  symbol: string,
  filingData: string, // XML string
  filing: { filingDate: string; accessionNumber: string }
): InstitutionalHolding[] {
  try {
    const xml = this.parseXML(filingData);
    const holdings = this.extractHoldingsTable(xml);
    const filtered = this.filterBySymbol(holdings, symbol);

    return filtered.map(h => this.mapXMLToHolding(h, filing))
      .filter(h => this.validateHolding(h));
  } catch (error) {
    console.error(`Failed to parse 13F: ${error.message}`);
    return []; // Graceful degradation
  }
}

// Replace lines 513-556
private parseForm4Transactions(
  symbol: string,
  filingData: string, // XML string
  filing: { filingDate: string; accessionNumber: string; form: string }
): InsiderTransaction[] {
  try {
    const xml = this.parseXML(filingData);
    const owner = this.extractReportingOwner(xml);
    const txs = this.extractNonDerivativeTransactions(xml);

    return txs.map(tx => this.mapXMLToTransaction(tx, owner, filing, symbol))
      .filter(tx => this.validateTransaction(tx));
  } catch (error) {
    console.error(`Failed to parse Form 4: ${error.message}`);
    return []; // Graceful degradation
  }
}
```

---

## Error Handling Strategy

**Principle:** Graceful degradation at every level - NO CRASHES

| Level | Error | Action | Result |
|-------|-------|--------|--------|
| Network | HTTP timeout | Return `{ success: false }` | Empty array `[]` |
| API | 404 filing not found | Log error, skip filing | Partial results |
| Parsing | XML parse failure | Log error, return `[]` | Empty array `[]` |
| Validation | Missing required field | Skip item, continue | Partial results |
| Cache | Write failure | Log warning, continue | No caching this time |

**Key Point:** All methods return `[]` on failure, never throw exceptions

---

## Data Flow (Simplified)

```
Dataset Generation
      ↓
HybridSmartMoneyDataService.getInsiderTrading()
      ↓
SmartMoneyDataCache.getOrFetch()
      ↓
   [Check cache]
      ↓
   Cache hit? → Return cached data
      ↓
   Cache miss → Call API
      ↓
SECEdgarAPI.getForm4Transactions()
      ↓
   [Rate limit: 100ms queue]
      ↓
SEC EDGAR API (https://data.sec.gov)
      ↓
   [Return XML]
      ↓
parseForm4Transactions(xml)
      ↓
   [Real XML parsing]
      ↓
   [Map to types]
      ↓
   [Validate fields]
      ↓
Return InsiderTransaction[] or []
      ↓
   [Save to cache]
      ↓
Return to dataset generation
```

---

## Type Mapping

### SEC Transaction Codes → ML Types

```typescript
// SEC codes (Form 4)
P = Purchase         → ML type 'P' (buy)
A = Award/Grant      → ML type 'P' (buy)
J = Other (buy)      → ML type 'P' (buy)
S = Sale             → ML type 'S' (sell)
M = Exercise         → ML type 'S' (sell)
F = Tax withhold     → ML type 'S' (sell)
// ... all others   → ML type 'S' (sell)
```

### Field Mappings

| SEC EDGAR Field | ML Field | Conversion |
|----------------|----------|------------|
| `reportingOwnerName` | `reportingName` | Direct copy |
| `relationship: string[]` | `typeOfOwner: string` | `join(', ')` |
| `transactionCode: 'P'|'S'|...` | `transactionType: 'P'|'S'` | Convert via map |
| `shares` | `securitiesTransacted` | Direct copy |
| `pricePerShare` | `price` | Direct copy |
| `sharesOwnedAfter` | `securitiesOwned` | Direct copy |

---

## Implementation Phases

### Phase 1: Type Mapping (2-3 hours)
- ✅ Add `secAPI` property
- ✅ Add mapping methods
- ✅ Fix TypeScript errors
- ✅ Validate: `npm run type-check` passes

### Phase 2: XML Parsing (4-6 hours)
- Install `xml2js` library
- Implement real `parse13FHoldings()`
- Implement real `parseForm4Transactions()`
- Add XML helper methods
- Validate: Test with real SEC data

### Phase 3: Integration Testing (2-3 hours)
- Test insider trading data
- Test institutional ownership data
- Test error handling (invalid symbols)
- Test cache performance (>95% hit rate)

### Phase 4: Documentation (1-2 hours)
- Update inline comments
- Update CLAUDE.md
- Create integration guide

**Total Estimate:** 9-14 hours

---

## Dependencies

**New:**
```bash
npm install xml2js
npm install --save-dev @types/xml2js
```

**Existing (no changes):**
- SmartMoneyDataCache ✅
- Rate limiting in SECEdgarAPI ✅
- HybridSmartMoneyDataService cache integration ✅

---

## Success Metrics

### Must Have ✅
- [ ] `npm run type-check` passes
- [ ] Real data returned (not mock)
- [ ] Empty arrays on errors (no crashes)
- [ ] Rate limiting respected (10 req/sec)
- [ ] Cache hit rate >95% on second run

### Nice to Have 🎯
- [ ] Parse 95%+ of 13F filings successfully
- [ ] Parse 95%+ of Form 4 filings successfully
- [ ] Handle all SEC XML schema variations
- [ ] CUSIP → Symbol mapping database

---

## Risk Mitigation

### XML Parsing Complexity
- **Risk:** SEC XML formats vary over time
- **Mitigation:** Graceful error handling, skip invalid filings
- **Fallback:** Return `[]` instead of crashing

### CUSIP Mapping
- **Risk:** 13F uses CUSIP, not symbols
- **Mitigation:** Start with hardcoded map for common symbols
- **Fallback:** Return empty holdings if CUSIP not found

### Rate Limiting
- **Risk:** Concurrent processes violate 10 req/sec
- **Mitigation:** Process-level queue (already implemented)
- **Fallback:** SEC returns HTTP 429, automatic retry

---

## Quick Reference

### Files to Modify

1. `/app/services/ml/smart-money-flow/HybridSmartMoneyDataService.ts`
   - Add `secAPI` property (line 50)
   - Add `mapInsiderTransactionFromInstitutional()` method
   - Add `convertTransactionType()` helper

2. `/app/services/financial-data/SECEdgarAPI.ts`
   - Replace `parse13FHoldings()` (lines 470-508)
   - Replace `parseForm4Transactions()` (lines 513-556)
   - Add XML helper methods

### Files to Create

1. `/scripts/ml/test-sec-edgar-parsing.ts`
   - Test script for XML parsing validation

### Files to Update

1. `/app/services/ml/CLAUDE.md`
   - Note: SEC parsing is REAL, not mock
   - Add troubleshooting section

---

## Testing Commands

```bash
# Type check
npm run type-check

# Test SEC parsing with real data
npx tsx scripts/ml/test-sec-edgar-parsing.ts --symbol AAPL

# Test smart money features end-to-end
npx tsx scripts/ml/test-smart-money-features.ts --symbol AAPL

# Test cache performance (run twice)
time npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL

# Test error handling
npx tsx scripts/ml/test-smart-money-features.ts --symbol INVALID
```

---

## Rollback Plan

If integration fails:

1. Keep `secAPI` as mock stub (current temp state)
2. Use `InstitutionalDataService` fallback
3. Set SEC feature values to 0 in feature extraction
4. Document as "not implemented"

Mock data is better than no data - pipeline can still function.

---

**For Full Details:** See `SEC_EDGAR_INTEGRATION_ARCHITECTURE.md`
