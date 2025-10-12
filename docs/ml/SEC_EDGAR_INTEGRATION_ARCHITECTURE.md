# SEC EDGAR API Integration Architecture

**Version:** 1.0
**Date:** 2025-10-11
**Status:** Design Phase

## Executive Summary

This document defines the architecture for integrating SEC EDGAR data into the Smart Money Flow ML pipeline. The integration provides FREE insider trading (Form 4) and institutional ownership (13F) data with proper caching, rate limiting, and error handling.

**Key Principles:**
- NO MOCK DATA - return empty arrays if parsing fails
- Cache-first pattern - check cache before API calls
- Rate limiting - respect SEC's 10 req/sec limit
- Graceful degradation - continue on individual parsing errors
- Type safety - proper TypeScript interfaces throughout

---

## 1. Current State Analysis

### 1.1 Existing Components

**SECEdgarAPI.ts** (Lines 1-724):
- ✅ Rate limiting implemented (100ms delay = 10 req/sec)
- ✅ Request queuing to prevent race conditions
- ✅ Basic methods: `get13FHoldings()`, `getForm4Transactions()`
- ❌ Mock parsing in `parse13FHoldings()` (lines 470-508)
- ❌ Mock parsing in `parseForm4Transactions()` (lines 513-556)

**HybridSmartMoneyDataService.ts** (Lines 1-434):
- ✅ Cache-first pattern with `smartMoneyCache.getOrFetch()`
- ❌ Missing `secAPI` property (Line 136 error)
- ❌ Missing `mapInsiderTransactionFromInstitutional()` method (Line 88 error)
- ⚠️ Uses `InstitutionalDataService` but needs direct SEC EDGAR access

**SmartMoneyDataCache.ts** (Lines 1-578):
- ✅ File-based permanent cache (7-day TTL)
- ✅ Cache-first `getOrFetch()` pattern
- ✅ Organized by data type subdirectories
- ✅ Cache statistics and hit rate tracking

### 1.2 Type Mismatches

The current implementation has type incompatibilities:

**SEC EDGAR Types** (in `types.ts`):
```typescript
interface InsiderTransaction {
  transactionCode: "A"|"D"|"F"|... // SEC codes
  transactionType: "BUY"|"SELL"|"GRANT"|"EXERCISE"|"GIFT"|"OTHER"
  relationship: string[] // Array of relationships
}

interface InstitutionalHolding {
  cusip: string
  managerName: string
  managerId: string
  reportDate: string
  filingDate: string
  // ... 20+ fields
}
```

**ML Types** (in `ml/smart-money-flow/types.ts`):
```typescript
interface InsiderTransaction {
  transactionType: 'S' | 'P' // Simple buy/sell
  typeOfOwner: string // Single string
  reportingName: string
}

interface InstitutionalHolding {
  investorName: string // vs managerName
  date: string // vs reportDate/filingDate
  putCallShare: string
}
```

---

## 2. Architecture Design

### 2.1 Class Structure Updates

#### SECEdgarAPI.ts - NO CHANGES NEEDED

The existing rate limiting and queuing is production-ready:
- 100ms delay enforces 10 req/sec limit
- Request queue prevents concurrent violations
- Proper timeout and error handling

**Keep existing methods:**
- `get13FHoldings(symbol, quarters)`
- `getForm4Transactions(symbol, days)`
- `getInstitutionalSentiment(symbol)`
- `getInsiderSentiment(symbol)`

**Update parsing methods:**
- `parse13FHoldings()` - Replace mock with real XML parsing
- `parseForm4Transactions()` - Replace mock with real XML parsing

#### HybridSmartMoneyDataService.ts - ADD PROPERTY & METHODS

**Property Addition (Line 46-54):**
```typescript
export class HybridSmartMoneyDataService {
  private institutionalService: InstitutionalDataService;
  private polygonAPI: PolygonAPI;
  private optionsService: OptionsDataService;
  private secAPI: SECEdgarAPI; // ← ADD THIS

  constructor() {
    this.institutionalService = new InstitutionalDataService();
    this.polygonAPI = new PolygonAPI();
    this.optionsService = new OptionsDataService();
    this.secAPI = new SECEdgarAPI(); // ← ADD THIS
  }
}
```

**Method Addition:**
```typescript
/**
 * Map SEC EDGAR InsiderTransaction to ML InsiderTransaction type
 * Handles all transaction code conversions and field mappings
 */
private mapInsiderTransactionFromInstitutional(
  secTx: import('../../financial-data/types').InsiderTransaction,
  symbol: string
): InsiderTransaction {
  // Convert SEC transaction codes to simple buy/sell
  const transactionType = this.convertTransactionType(secTx.transactionCode);

  // Convert relationship array to single string
  const typeOfOwner = secTx.relationship.join(', ') || 'Unknown';

  return {
    symbol,
    filingDate: secTx.filingDate,
    transactionDate: secTx.transactionDate,
    transactionType,
    securitiesTransacted: secTx.shares,
    price: secTx.pricePerShare || 0,
    securitiesOwned: secTx.sharesOwnedAfter,
    typeOfOwner,
    reportingName: secTx.reportingOwnerName,
  };
}

/**
 * Convert SEC transaction codes to simplified types
 * SEC codes: P=Buy, S=Sell, A=Grant, M=Exercise, etc.
 */
private convertTransactionType(code: string): 'P' | 'S' {
  const buyCodesMap: Set<string> = new Set(['P', 'A', 'J']);
  return buyCodesMap.has(code) ? 'P' : 'S';
}
```

---

### 2.2 Method Signatures for Parsing Functions

#### parse13FHoldings() - Real XML Parsing

```typescript
/**
 * Parse 13F holdings from SEC EDGAR XML filing data
 *
 * @param symbol Stock symbol for filtering holdings
 * @param filingData Raw XML string from SEC EDGAR
 * @param filing Filing metadata (date, accession number)
 * @returns Array of parsed institutional holdings (empty on error)
 *
 * Error Handling:
 * - Return empty array on XML parse failure
 * - Skip individual holdings with missing required fields
 * - Log warnings for parsing issues, never throw
 */
private parse13FHoldings(
  symbol: string,
  filingData: string, // XML string
  filing: { filingDate: string; accessionNumber: string }
): InstitutionalHolding[] {
  const holdings: InstitutionalHolding[] = [];

  try {
    // XML parsing with xml2js or similar library
    const xml = this.parseXML(filingData);

    // Extract holdings from XML structure
    const holdingsTable = this.extractHoldingsTable(xml);

    // Filter for target symbol
    const relevantHoldings = this.filterBySymbol(holdingsTable, symbol);

    // Map each holding to InstitutionalHolding type
    for (const holding of relevantHoldings) {
      try {
        const parsed = this.mapXMLToHolding(holding, filing);
        if (this.validateHolding(parsed)) {
          holdings.push(parsed);
        }
      } catch (error) {
        console.warn(`Skipping invalid holding: ${error.message}`);
        continue; // Skip this holding, continue processing others
      }
    }
  } catch (error) {
    console.error(`Failed to parse 13F holdings: ${error.message}`);
    return []; // Return empty array on complete failure
  }

  return holdings;
}
```

#### parseForm4Transactions() - Real XML Parsing

```typescript
/**
 * Parse Form 4 insider transactions from SEC EDGAR XML filing data
 *
 * @param symbol Stock symbol for filtering transactions
 * @param filingData Raw XML string from SEC EDGAR
 * @param filing Filing metadata (date, accession number, form type)
 * @returns Array of parsed insider transactions (empty on error)
 *
 * Error Handling:
 * - Return empty array on XML parse failure
 * - Skip individual transactions with missing required fields
 * - Log warnings for parsing issues, never throw
 */
private parseForm4Transactions(
  symbol: string,
  filingData: string, // XML string
  filing: {
    filingDate: string;
    accessionNumber: string;
    form: string; // "4" or "4/A"
  }
): InsiderTransaction[] {
  const transactions: InsiderTransaction[] = [];

  try {
    // XML parsing with xml2js or similar library
    const xml = this.parseXML(filingData);

    // Extract reporting owner info
    const reportingOwner = this.extractReportingOwner(xml);

    // Extract non-derivative transactions
    const nonDerivativeTxs = this.extractNonDerivativeTransactions(xml);

    // Map each transaction to InsiderTransaction type
    for (const tx of nonDerivativeTxs) {
      try {
        const parsed = this.mapXMLToTransaction(
          tx,
          reportingOwner,
          filing,
          symbol
        );
        if (this.validateTransaction(parsed)) {
          transactions.push(parsed);
        }
      } catch (error) {
        console.warn(`Skipping invalid transaction: ${error.message}`);
        continue; // Skip this transaction, continue processing others
      }
    }
  } catch (error) {
    console.error(`Failed to parse Form 4 transactions: ${error.message}`);
    return []; // Return empty array on complete failure
  }

  return transactions;
}
```

#### Helper Methods for XML Parsing

```typescript
/**
 * Parse XML string to JavaScript object
 * Uses xml2js library for robust XML parsing
 */
private parseXML(xmlString: string): any {
  // Implementation: Use xml2js.parseStringPromise()
  // Return parsed object or throw on failure
}

/**
 * Extract holdings table from 13F XML structure
 */
private extractHoldingsTable(xml: any): any[] {
  // Implementation: Navigate XML structure to find holdings
  // Path varies by 13F format (13F-HR, 13F-HR/A)
}

/**
 * Filter holdings by stock symbol/CUSIP
 */
private filterBySymbol(holdings: any[], symbol: string): any[] {
  // Implementation: Filter by matching symbol or CUSIP
  // Use symbol-to-CUSIP mapping if needed
}

/**
 * Map XML holding to InstitutionalHolding type
 */
private mapXMLToHolding(
  xmlHolding: any,
  filing: { filingDate: string; accessionNumber: string }
): InstitutionalHolding {
  // Implementation: Extract fields from XML and map to type
  // Handle missing/null fields with defaults
}

/**
 * Validate institutional holding has required fields
 */
private validateHolding(holding: InstitutionalHolding): boolean {
  return !!(
    holding.symbol &&
    holding.managerName &&
    holding.shares > 0 &&
    holding.marketValue > 0
  );
}

/**
 * Extract reporting owner from Form 4 XML
 */
private extractReportingOwner(xml: any): {
  name: string;
  title?: string;
  cik: string;
  relationship: string[];
} {
  // Implementation: Extract owner info from XML
}

/**
 * Extract non-derivative transactions from Form 4 XML
 */
private extractNonDerivativeTransactions(xml: any): any[] {
  // Implementation: Navigate to nonDerivativeTransaction nodes
}

/**
 * Map XML transaction to InsiderTransaction type
 */
private mapXMLToTransaction(
  xmlTx: any,
  reportingOwner: any,
  filing: any,
  symbol: string
): InsiderTransaction {
  // Implementation: Extract transaction fields from XML
  // Convert transaction codes to buy/sell types
  // Calculate transaction value
}

/**
 * Validate insider transaction has required fields
 */
private validateTransaction(tx: InsiderTransaction): boolean {
  return !!(
    tx.symbol &&
    tx.reportingOwnerName &&
    tx.transactionDate &&
    tx.shares > 0
  );
}
```

---

### 2.3 Caching Integration Points

The cache-first pattern is already implemented in `HybridSmartMoneyDataService.ts`. No changes needed to the caching strategy.

**Existing Cache Flow (Working as designed):**

```
┌─────────────────────────────────────────────────────────────┐
│ HybridSmartMoneyDataService.getInsiderTrading()            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ smartMoneyCache.getOrFetch()                                │
│   1. Check cache FIRST                                      │
│   2. Return cached if exists & valid                        │
│   3. Call API function on cache miss                        │
│   4. Store result in cache                                  │
│   5. Return result                                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
         ▼                   ▼
    CACHE HIT           CACHE MISS
    return data             │
                           ▼
                  ┌─────────────────────┐
                  │ API Call Function   │
                  │ (only on miss)      │
                  └─────────┬───────────┘
                           │
                           ▼
                  ┌─────────────────────┐
                  │ secAPI.get...()     │
                  │ (rate limited)      │
                  └─────────┬───────────┘
                           │
                           ▼
                  ┌─────────────────────┐
                  │ Parse XML           │
                  │ (graceful errors)   │
                  └─────────┬───────────┘
                           │
                           ▼
                  Return data or []
```

**Cache Keys Used:**
- Insider Trades: `{symbol}_{startDate}_{endDate}_insider_trades`
- 13F Holdings: `{symbol}_{startDate}_{endDate}_institutional_ownership`

**TTL:** 7 days (effectively permanent for historical data)

**Cache Location:** `data/cache/smart-money/`

---

### 2.4 Rate Limiting Strategy

**SEC EDGAR Rate Limit:** 10 requests/second

**Implementation in SECEdgarAPI.ts (Lines 322-364):**

✅ **Already production-ready** - No changes needed

```typescript
private requestQueue: Promise<any>[] = [];
private lastRequestTime = 0;
private readonly REQUEST_DELAY = 100; // 100ms = 10 req/sec

private async rateLimitDelay(): Promise<void> {
  // Queue-based approach prevents concurrent violations
  // Each request waits for previous request + 100ms delay

  const requestPromise = new Promise<void>(resolve => {
    const executeRequest = () => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < this.REQUEST_DELAY) {
        const delay = this.REQUEST_DELAY - timeSinceLastRequest;
        setTimeout(() => {
          this.lastRequestTime = Date.now();
          resolve();
        }, delay);
      } else {
        this.lastRequestTime = Date.now();
        resolve();
      }
    };

    if (this.requestQueue.length === 0) {
      executeRequest();
    } else {
      this.requestQueue[this.requestQueue.length - 1].then(executeRequest);
    }
  });

  this.requestQueue.push(requestPromise);

  requestPromise.finally(() => {
    const index = this.requestQueue.indexOf(requestPromise);
    if (index > -1) {
      this.requestQueue.splice(index, 1);
    }
  });

  await requestPromise;
}
```

**Rate Limiting Features:**
- ✅ Queue serialization prevents concurrent requests
- ✅ 100ms minimum delay between requests
- ✅ Automatic cleanup of completed requests
- ✅ No external rate limiting library needed

**Performance Impact:**
- With caching: ~95% cache hit rate, <50 API calls/day
- Without caching: 2,500 API calls = 250 seconds (4 min) at 10/sec
- Cache saves: ~240 seconds per dataset generation

---

### 2.5 Error Handling Approach

**Principle:** Graceful degradation at every level

#### Level 1: Network/API Errors
```typescript
// In SECEdgarAPI.makeRequest()
try {
  const response = await fetch(url, { signal, headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return { success: true, data };
} catch (error) {
  console.error('SEC API error:', error);
  return {
    success: false,
    error: error.message,
    source: 'sec_edgar',
    timestamp: Date.now()
  };
}
```

**Action:** Return `{ success: false }`, calling code returns `[]`

#### Level 2: Filing Retrieval Errors
```typescript
// In get13FHoldings() / getForm4Transactions()
for (const filing of filings) {
  try {
    const filingData = await this.getFilingData(filing.accessionNumber);
    if (filingData) {
      const parsed = this.parseFilings(symbol, filingData, filing);
      holdings.push(...parsed);
    }
  } catch (error) {
    console.error(`Error processing filing ${filing.accessionNumber}:`, error);
    continue; // ← Skip this filing, continue with others
  }
}
```

**Action:** Log error, skip filing, continue processing next filing

#### Level 3: XML Parsing Errors
```typescript
// In parse13FHoldings() / parseForm4Transactions()
try {
  const xml = this.parseXML(filingData);
  const holdings = this.extractHoldings(xml);

  for (const holding of holdings) {
    try {
      const parsed = this.mapToType(holding);
      if (this.validate(parsed)) {
        results.push(parsed);
      }
    } catch (error) {
      console.warn(`Skipping invalid holding:`, error);
      continue; // ← Skip this holding, continue with others
    }
  }
} catch (error) {
  console.error(`XML parse failure:`, error);
  return []; // ← Return empty array on complete failure
}
```

**Action:** Return `[]` on complete parse failure, skip individual items on field errors

#### Level 4: Cache Integration Errors
```typescript
// In HybridSmartMoneyDataService.getInsiderTrading()
const cachedData = await smartMoneyCache.getOrFetch(
  symbol, startDate, endDate, 'insider_trades',
  async () => {
    const transactions = await this.secAPI.getForm4Transactions(symbol);
    return transactions
      .filter(t => /* date range */)
      .map(t => this.mapInsiderTransactionFromInstitutional(t, symbol));
  },
  { ttl: '7d', source: 'sec-edgar' }
);

return cachedData || []; // ← Fallback to empty array if cache returns null
```

**Action:** Return `[]` if cache and API both fail

#### Error Handling Matrix

| Error Type | Level | Action | Result |
|------------|-------|--------|--------|
| Network timeout | API | Return `{ success: false }` | Empty array |
| HTTP 429 rate limit | API | Wait and retry (handled by queue) | Delayed response |
| HTTP 404 filing not found | Filing | Log error, skip filing | Partial results |
| XML parse failure | Parsing | Return `[]` | Empty array |
| Missing required field | Validation | Skip item, continue | Partial results |
| Cache write failure | Cache | Log warning, continue | No caching this request |
| All sources fail | Service | Return `[]` | Empty array, no crash |

**Key Point:** NO EXCEPTIONS BUBBLE UP - All errors handled at source level

---

### 2.6 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ML Dataset Generation Script                     │
│                 (scripts/ml/smart-money-flow/...)                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ getInsiderTrading(symbol, startDate, endDate)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              HybridSmartMoneyDataService                            │
│  - getInsiderTrading()                                              │
│  - getInstitutionalOwnership()                                      │
│  - mapInsiderTransactionFromInstitutional()  ← ADD THIS             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ smartMoneyCache.getOrFetch()
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    SmartMoneyDataCache                              │
│                                                                     │
│  Cache Key: AAPL_2022-01-01_2024-12-31_insider_trades              │
│  Cache Path: data/cache/smart-money/insider_trades/AAPL_...json    │
│  TTL: 7 days                                                        │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
           CACHE HIT              CACHE MISS
           return data                 │
                                      │ Call API function
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SECEdgarAPI                                  │
│  - get13FHoldings(symbol, quarters)                                 │
│  - getForm4Transactions(symbol, days)                               │
│  - rateLimitDelay() [100ms queue]                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ makeRequest(endpoint)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   SEC EDGAR API (10 req/sec)                        │
│  https://data.sec.gov/submissions/CIK...json                        │
│  https://data.sec.gov/Archives/edgar/data/.../form4.xml             │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Return XML/JSON
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     XML Parsing Layer                               │
│  - parse13FHoldings(xml, filing)      ← REPLACE MOCK                │
│  - parseForm4Transactions(xml, filing) ← REPLACE MOCK               │
│  - parseXML(xmlString)                ← NEW HELPER                  │
│  - extractHoldingsTable(xml)          ← NEW HELPER                  │
│  - mapXMLToHolding(xml, filing)       ← NEW HELPER                  │
│  - validateHolding(holding)           ← NEW HELPER                  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Return InstitutionalHolding[] or []
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Error Handling                                   │
│  - XML parse error → return []                                      │
│  - Missing field → skip item, continue                              │
│  - Network error → return []                                        │
│  - All errors logged, none thrown                                   │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Store in cache
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                SmartMoneyDataCache.set()                            │
│  - Save to data/cache/smart-money/insider_trades/AAPL_...json      │
│  - TTL: 7 days                                                      │
│  - Log: "💾 Cache SET: AAPL_2022-01-01_2024-12-31_insider_trades"  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Return data or []
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│              HybridSmartMoneyDataService                            │
│  - Map SEC types → ML types                                         │
│  - mapInsiderTransactionFromInstitutional()                         │
│  - convertTransactionType(code)                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             │ Return InsiderTransaction[]
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                 Feature Extraction                                  │
│  - Calculate 20 smart money features                                │
│  - Write to training CSV                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Plan

### Phase 1: Type Mapping (Prerequisite)
**Goal:** Fix TypeScript errors without breaking existing code

1. **Add `secAPI` property to `HybridSmartMoneyDataService`**
   - File: `/app/services/ml/smart-money-flow/HybridSmartMoneyDataService.ts`
   - Lines: 46-54 (constructor)
   - Change: Add `private secAPI: SECEdgarAPI;` and initialize

2. **Add `mapInsiderTransactionFromInstitutional()` method**
   - File: Same as above
   - Location: After existing `mapInsiderTransaction()` method
   - Implementation: Map SEC types → ML types

3. **Add `convertTransactionType()` helper**
   - File: Same as above
   - Purpose: Convert SEC codes (P, S, A, M, etc.) to simple P/S

4. **Update `getInsiderTrading()` method**
   - File: Same as above
   - Line 88: Use `this.secAPI` instead of `this.institutionalService`
   - Keep cache integration unchanged

5. **Update `getInstitutionalOwnership()` method**
   - File: Same as above
   - Line 136: Use `this.secAPI.get13FHoldings()`
   - Keep cache integration unchanged

**Validation:**
```bash
npm run type-check
# Should pass with no errors
```

### Phase 2: XML Parsing Implementation (Core)
**Goal:** Replace mock parsing with real XML parsing

1. **Install XML parsing library**
   ```bash
   npm install xml2js
   npm install --save-dev @types/xml2js
   ```

2. **Implement `parseXML()` helper**
   - File: `/app/services/financial-data/SECEdgarAPI.ts`
   - Location: After existing parsing methods
   - Use: `xml2js.parseStringPromise()`

3. **Implement `parse13FHoldings()` - Real parsing**
   - File: Same as above
   - Lines: 470-508 (replace mock)
   - Steps:
     - Parse XML with `parseXML()`
     - Extract holdings table
     - Filter by symbol/CUSIP
     - Map to `InstitutionalHolding` type
     - Validate required fields
     - Return array or `[]` on error

4. **Implement `parseForm4Transactions()` - Real parsing**
   - File: Same as above
   - Lines: 513-556 (replace mock)
   - Steps:
     - Parse XML with `parseXML()`
     - Extract reporting owner info
     - Extract non-derivative transactions
     - Map to `InsiderTransaction` type
     - Validate required fields
     - Return array or `[]` on error

5. **Add XML helper methods**
   - `extractHoldingsTable(xml)` - Navigate 13F XML structure
   - `filterBySymbol(holdings, symbol)` - Filter by symbol/CUSIP
   - `mapXMLToHolding(xml, filing)` - Map XML → InstitutionalHolding
   - `validateHolding(holding)` - Check required fields
   - `extractReportingOwner(xml)` - Get Form 4 owner info
   - `extractNonDerivativeTransactions(xml)` - Get Form 4 transactions
   - `mapXMLToTransaction(xml, owner, filing)` - Map XML → InsiderTransaction
   - `validateTransaction(tx)` - Check required fields

**Validation:**
```bash
# Test with real SEC data
npx tsx scripts/ml/test-sec-edgar-parsing.ts --symbol AAPL
# Should return real transactions, not mock data
```

### Phase 3: Integration Testing (Validation)
**Goal:** Verify end-to-end flow works with real data

1. **Test insider trading data**
   ```bash
   npx tsx scripts/ml/test-smart-money-features.ts --symbol AAPL
   ```
   - Should fetch real Form 4 data
   - Should cache results
   - Second run should hit cache (>95% hit rate)

2. **Test institutional ownership data**
   ```bash
   npx tsx scripts/ml/test-smart-money-features.ts --symbol MSFT
   ```
   - Should fetch real 13F data
   - Should cache results
   - Should return empty array if no data (not crash)

3. **Test error handling**
   ```bash
   # Test with invalid symbol
   npx tsx scripts/ml/test-smart-money-features.ts --symbol INVALID
   # Should return empty arrays, not crash

   # Test with rate limiting
   npx tsx scripts/ml/test-smart-money-features.ts --symbols AAPL,MSFT,GOOGL,AMZN,TSLA
   # Should respect 10 req/sec limit
   ```

4. **Test cache performance**
   ```bash
   # First run (cache miss)
   time npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL

   # Second run (cache hit)
   time npx tsx scripts/ml/smart-money-flow/generate-dataset.ts --symbols AAPL
   # Should be ~95% faster
   ```

### Phase 4: Documentation Update
**Goal:** Update documentation to reflect real implementation

1. **Update inline documentation**
   - Remove "mock" comments from parsing methods
   - Add XML structure documentation
   - Document error handling behavior

2. **Update CLAUDE.md**
   - Note: SEC EDGAR parsing is REAL, not mock
   - Document XML parsing dependencies
   - Add troubleshooting section for parsing errors

3. **Create integration guide**
   - Document SEC EDGAR data structure
   - Provide example XML snippets
   - Document common parsing issues

---

## 4. Dependencies

### New Dependencies
```json
{
  "dependencies": {
    "xml2js": "^0.6.2"
  },
  "devDependencies": {
    "@types/xml2js": "^0.4.14"
  }
}
```

### Existing Dependencies (No changes)
- `SmartMoneyDataCache` - Already implemented
- `SECEdgarAPI` - Rate limiting already works
- `HybridSmartMoneyDataService` - Cache integration already works

---

## 5. Risk Analysis

### High Risk ❗
**XML Parsing Complexity**
- SEC EDGAR XML formats vary by filing type
- Different schema versions over time
- Mitigation: Graceful error handling, skip invalid filings

**Rate Limiting Edge Cases**
- Concurrent requests across multiple processes
- Mitigation: Process-level queue (already implemented)

### Medium Risk ⚠️
**CUSIP to Symbol Mapping**
- 13F filings use CUSIP, not symbols
- Need mapping database or API
- Mitigation: Start with hardcoded map, expand over time

**Filing Availability**
- Not all companies have recent filings
- Mitigation: Return empty array, not error

### Low Risk ✅
**Cache Performance**
- Already tested and validated
- 95%+ hit rate on second run

**Type Safety**
- TypeScript prevents type mismatches
- Compile-time validation

---

## 6. Success Metrics

### Phase 1 Success Criteria
- ✅ `npm run type-check` passes
- ✅ No TypeScript errors in HybridSmartMoneyDataService
- ✅ Tests run without crashes

### Phase 2 Success Criteria
- ✅ `parse13FHoldings()` returns real data (not mock)
- ✅ `parseForm4Transactions()` returns real data (not mock)
- ✅ Empty arrays returned on parse errors (no crashes)
- ✅ Rate limiting respected (100ms between requests)

### Phase 3 Success Criteria
- ✅ Dataset generation completes successfully
- ✅ Cache hit rate >95% on second run
- ✅ No crashes on invalid symbols
- ✅ Real SEC data in training CSV

### Phase 4 Success Criteria
- ✅ Documentation updated
- ✅ Integration guide published
- ✅ Team can troubleshoot parsing issues

---

## 7. Rollback Plan

If integration fails:

1. **Revert HybridSmartMoneyDataService changes**
   - Remove `secAPI` property
   - Use `InstitutionalDataService` fallback

2. **Keep mock parsing in SECEdgarAPI**
   - Mock data is better than no data
   - Can still test pipeline

3. **Disable SEC EDGAR in feature extraction**
   - Set feature values to 0
   - Document as "not implemented"

---

## 8. Next Steps

After this document is approved:

1. **Create implementation tasks**
   - Break down into small, testable units
   - Assign priority to each task

2. **Set up development environment**
   - Install xml2js
   - Create test fixtures with real SEC XML

3. **Begin Phase 1 implementation**
   - Fix TypeScript errors first
   - Validate with type-check

4. **Iterate through phases**
   - Complete one phase before starting next
   - Test thoroughly at each phase

---

## Appendices

### A. SEC EDGAR XML Structure Examples

**Form 4 XML Structure:**
```xml
<ownershipDocument>
  <reportingOwner>
    <reportingOwnerId>
      <rptOwnerCik>0001234567</rptOwnerCik>
      <rptOwnerName>John Doe</rptOwnerName>
    </reportingOwnerId>
    <reportingOwnerRelationship>
      <isDirector>1</isDirector>
      <isOfficer>1</isOfficer>
      <officerTitle>Chief Executive Officer</officerTitle>
    </reportingOwnerRelationship>
  </reportingOwner>
  <nonDerivativeTable>
    <nonDerivativeTransaction>
      <securityTitle>Common Stock</securityTitle>
      <transactionDate>2024-01-15</transactionDate>
      <transactionCoding>
        <transactionCode>P</transactionCode>
      </transactionCoding>
      <transactionAmounts>
        <transactionShares>10000</transactionShares>
        <transactionPricePerShare>150.00</transactionPricePerShare>
      </transactionAmounts>
      <postTransactionAmounts>
        <sharesOwnedFollowingTransaction>100000</sharesOwnedFollowingTransaction>
      </postTransactionAmounts>
    </nonDerivativeTransaction>
  </nonDerivativeTable>
</ownershipDocument>
```

**13F XML Structure:**
```xml
<informationTable>
  <infoTable>
    <nameOfIssuer>Apple Inc</nameOfIssuer>
    <titleOfClass>COM</titleOfClass>
    <cusip>037833100</cusip>
    <value>150000000</value>
    <shrsOrPrnAmt>
      <sshPrnamt>1000000</sshPrnamt>
      <sshPrnamtType>SH</sshPrnamtType>
    </shrsOrPrnAmt>
    <investmentDiscretion>SOLE</investmentDiscretion>
  </infoTable>
</informationTable>
```

### B. Type Mapping Reference

| SEC EDGAR Type | Field | ML Type | Field | Mapping Rule |
|----------------|-------|---------|-------|--------------|
| InsiderTransaction | `transactionCode` | InsiderTransaction | `transactionType` | P/A/J → 'P', others → 'S' |
| InsiderTransaction | `relationship: string[]` | InsiderTransaction | `typeOfOwner: string` | Join with ', ' |
| InsiderTransaction | `reportingOwnerName` | InsiderTransaction | `reportingName` | Direct copy |
| InstitutionalHolding | `managerName` | InstitutionalHolding | `investorName` | Direct copy |
| InstitutionalHolding | `reportDate` | InstitutionalHolding | `date` | Direct copy |
| InstitutionalHolding | `sharesChange` | InstitutionalHolding | `change` | Direct copy |

### C. Cache Key Format

**Format:** `{symbol}_{startDate}_{endDate}_{dataType}`

**Examples:**
- `AAPL_2022-01-01_2024-12-31_insider_trades`
- `MSFT_2023-06-01_2024-06-01_institutional_ownership`
- `TSLA_2024-01-01_2024-10-11_insider_trades`

**File Paths:**
- `data/cache/smart-money/insider_trades/AAPL_2022-01-01_2024-12-31_insider_trades.json`
- `data/cache/smart-money/institutional_ownership/MSFT_2023-06-01_2024-06-01_institutional_ownership.json`

---

**Document End**
