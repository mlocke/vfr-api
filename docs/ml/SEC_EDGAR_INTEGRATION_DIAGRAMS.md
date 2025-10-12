# SEC EDGAR Integration - Visual Diagrams

## 1. System Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     ML Dataset Generation                          │
│         (scripts/ml/smart-money-flow/generate-dataset.ts)          │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             │ getInsiderTrading(symbol, start, end)
                             │ getInstitutionalOwnership(symbol)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│              HybridSmartMoneyDataService                           │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Properties:                                                   │ │
│  │ - institutionalService: InstitutionalDataService             │ │
│  │ - polygonAPI: PolygonAPI                                     │ │
│  │ - optionsService: OptionsDataService                         │ │
│  │ - secAPI: SECEdgarAPI  ← NEW                                 │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Methods:                                                      │ │
│  │ - getInsiderTrading(symbol, start, end)                      │ │
│  │ - getInstitutionalOwnership(symbol)                          │ │
│  │ - mapInsiderTransactionFromInstitutional(tx) ← NEW           │ │
│  │ - convertTransactionType(code) ← NEW                         │ │
│  │ - mapInstitutionalHolding(holding)                           │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             │ smartMoneyCache.getOrFetch(...)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                    SmartMoneyDataCache                             │
│  Cache Strategy: Check cache FIRST → API on miss → Save result    │
│  TTL: 7 days | Storage: File-based (data/cache/smart-money/)      │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │                     │
                  ▼                     ▼
           ┌─────────────┐      ┌─────────────────┐
           │ CACHE HIT   │      │  CACHE MISS     │
           │ return data │      │  call API       │
           └─────────────┘      └────────┬────────┘
                                         │
                                         ▼
┌────────────────────────────────────────────────────────────────────┐
│                        SECEdgarAPI                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Rate Limiting: 100ms queue (10 req/sec)                      │ │
│  │ - requestQueue: Promise[]                                    │ │
│  │ - lastRequestTime: number                                    │ │
│  │ - REQUEST_DELAY: 100ms                                       │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Public Methods:                                               │ │
│  │ - get13FHoldings(symbol, quarters)                           │ │
│  │ - getForm4Transactions(symbol, days)                         │ │
│  │ - getInstitutionalSentiment(symbol)                          │ │
│  │ - getInsiderSentiment(symbol)                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ Parsing Methods (REPLACE MOCK):                              │ │
│  │ - parse13FHoldings(xml, filing) → InstitutionalHolding[]    │ │
│  │ - parseForm4Transactions(xml, filing) → InsiderTransaction[] │ │
│  └──────────────────────────────────────────────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ New Helper Methods:                                          │ │
│  │ - parseXML(xmlString) → object                               │ │
│  │ - extractHoldingsTable(xml) → any[]                          │ │
│  │ - filterBySymbol(holdings, symbol) → any[]                   │ │
│  │ - mapXMLToHolding(xml, filing) → InstitutionalHolding       │ │
│  │ - validateHolding(holding) → boolean                         │ │
│  │ - extractReportingOwner(xml) → owner info                    │ │
│  │ - extractNonDerivativeTransactions(xml) → any[]              │ │
│  │ - mapXMLToTransaction(xml, owner, filing) → InsiderTx       │ │
│  │ - validateTransaction(tx) → boolean                          │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────┬───────────────────────────────────────┘
                             │
                             │ fetch(url, headers)
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│                   SEC EDGAR API (data.sec.gov)                     │
│  Rate Limit: 10 requests/second                                   │
│  User-Agent: Required (VFR-API/1.0)                               │
│                                                                    │
│  Endpoints:                                                        │
│  - /submissions/CIK{cik}.json → Company submissions list          │
│  - /Archives/edgar/data/{cik}/{accession}.xml → Form 4 filing     │
│  - /Archives/edgar/data/{cik}/{accession}.xml → 13F filing        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. Cache-First Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Request: getInsiderTrading('AAPL', '2022-01-01', '2024-12-31') │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Generate Cache Key:                                         │
│ 'AAPL_2022-01-01_2024-12-31_insider_trades'                 │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Check Cache File:                                           │
│ data/cache/smart-money/insider_trades/AAPL_...json          │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
      ┌──────────────┐      ┌─────────────┐
      │ File exists  │      │ File missing│
      │ & valid TTL  │      │ or expired  │
      └──────┬───────┘      └──────┬──────┘
             │                     │
             ▼                     ▼
    ┌────────────────┐    ┌──────────────────────┐
    │ Read cache     │    │ Call API function:   │
    │ Parse JSON     │    │ secAPI.get...()      │
    │ Return data    │    └──────────┬───────────┘
    │                │               │
    │ ✅ Cache HIT   │               ▼
    │ (milliseconds) │    ┌──────────────────────┐
    └────────────────┘    │ Rate limit queue:    │
                          │ Wait 100ms if needed │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Fetch from SEC API   │
                          │ (2-5 seconds)        │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Parse XML response   │
                          │ (may return [])      │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Save to cache:       │
                          │ Write JSON file      │
                          │ TTL: 7 days          │
                          └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ Return data          │
                          │                      │
                          │ ❌ Cache MISS        │
                          │ (2-5 seconds)        │
                          └──────────────────────┘
```

---

## 3. Error Handling Flow

```
┌────────────────────────────────────────────────────────────┐
│ SECEdgarAPI.getForm4Transactions(symbol, days)             │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│ Get company submissions                                    │
└────────────────────────┬───────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       ┌─────────────┐       ┌─────────────┐
       │ Success     │       │ Error       │
       └──────┬──────┘       └──────┬──────┘
              │                     │
              ▼                     ▼
   ┌────────────────────┐   ┌────────────────────┐
   │ Filter Form 4      │   │ Log error          │
   │ filings by date    │   │ Return []          │
   └─────────┬──────────┘   │ ✅ NO CRASH        │
             │              └────────────────────┘
             ▼
   ┌────────────────────────────────────┐
   │ Loop through filings               │
   └─────────┬──────────────────────────┘
             │
             ▼
   ┌────────────────────────────────────┐
   │ For each filing:                   │
   │ getForm4FilingData(accessionNumber)│
   └─────────┬──────────────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌─────────┐   ┌─────────────┐
│ Success │   │ Error       │
└────┬────┘   └──────┬──────┘
     │               │
     ▼               ▼
┌─────────────┐ ┌──────────────────┐
│ Parse XML   │ │ Log error        │
└─────┬───────┘ │ continue; (skip) │
      │         │ ✅ NO CRASH      │
      ▼         └──────────────────┘
┌──────────────────────────┐
│ parseForm4Transactions() │
└─────────┬────────────────┘
          │
   ┌──────┴──────┐
   │             │
   ▼             ▼
┌─────────┐ ┌──────────────────┐
│ Success │ │ XML parse error  │
└────┬────┘ └──────┬───────────┘
     │             │
     ▼             ▼
┌─────────────────┐ ┌──────────────┐
│ Validate fields │ │ Log error    │
└────┬────────────┘ │ Return []    │
     │              │ ✅ NO CRASH  │
     ▼              └──────────────┘
┌──────────────────────────┐
│ For each transaction:    │
│ - Validate required fields│
│ - Skip if invalid        │
│ - continue; (no throw)   │
└─────────┬────────────────┘
          │
          ▼
┌────────────────────────────┐
│ Return InsiderTransaction[]│
│ (may be partial results)  │
│ ✅ NO CRASH               │
└────────────────────────────┘
```

---

## 4. Rate Limiting Mechanism

```
Request Timeline (10 req/sec = 100ms between requests)

Request 1: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [SENT]
           │
           ├─ 100ms delay
           │
Request 2: ▓▓▓▓▓▓▓▓▓▓▓▓━━━━━━━━━━━━━━━━━━━━━━━━━━━ [WAITING → SENT]
           │         │
           │         ├─ 100ms delay
           │         │
Request 3: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓━━━━━━━━━━━━━━━━━━━━ [WAITING → SENT]
           │                   │
           │                   ├─ 100ms delay
           │                   │
Request 4: ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓━━━━━━━━━━━━━ [WAITING → SENT]

Legend:
▓ = Waiting in queue
━ = Being processed
│ = 100ms delay enforced

Queue Implementation:
┌─────────────────────────────────────────┐
│ requestQueue: [Promise, Promise, ...]   │
│ lastRequestTime: timestamp              │
│ REQUEST_DELAY: 100ms                    │
└─────────────────────────────────────────┘

Each request:
1. Creates a Promise
2. Waits for previous Promise to resolve
3. Checks time since last request
4. Adds delay if needed (<100ms)
5. Executes request
6. Removes itself from queue
```

---

## 5. Type Mapping Flow

```
SEC EDGAR API Response (Form 4 XML)
┌────────────────────────────────────────────┐
│ <transactionCode>P</transactionCode>       │ ─┐
│ <transactionShares>10000</transactionShares>│  │
│ <transactionPricePerShare>150.00<...>      │  │
│ <reportingOwnerName>John Doe</...>         │  │ XML Parsing
│ <relationship>                             │  │
│   <isDirector>1</isDirector>               │  │
│   <isOfficer>1</isOfficer>                 │  │
│   <officerTitle>CEO</officerTitle>         │  │
│ </relationship>                            │  │
└────────────────────────────────────────────┘ ─┘
                    │
                    ▼
Parsed Object (JavaScript)
┌────────────────────────────────────────────┐
│ {                                          │
│   transactionCode: 'P',                    │
│   shares: 10000,                           │
│   pricePerShare: 150.00,                   │ ─┐
│   reportingOwnerName: 'John Doe',          │  │
│   relationship: ['Director', 'Officer'],   │  │ mapXMLToTransaction()
│   sharesOwnedAfter: 100000,                │  │
│   transactionDate: '2024-01-15',           │  │
│   filingDate: '2024-01-16'                 │  │
│ }                                          │  │
└────────────────────────────────────────────┘ ─┘
                    │
                    ▼
SEC EDGAR Type (types.ts)
┌────────────────────────────────────────────┐
│ InsiderTransaction {                       │
│   symbol: 'AAPL',                          │
│   companyName: 'Apple Inc',                │
│   reportingOwnerName: 'John Doe',          │
│   relationship: ['Director', 'Officer'], ─────┐
│   transactionCode: 'P', ──────────────────────┤
│   transactionType: 'BUY',                  │  │
│   shares: 10000,                           │  │
│   pricePerShare: 150.00,                   │  │
│   sharesOwnedAfter: 100000,                │  │
│   transactionDate: '2024-01-15',           │  │
│   filingDate: '2024-01-16'                 │  │
│ }                                          │  │
└────────────────────────────────────────────┘  │
                    │                           │
                    ▼                           │
mapInsiderTransactionFromInstitutional()        │
                    │                           │
                    ▼                           │
ML Type (smart-money-flow/types.ts)             │
┌────────────────────────────────────────────┐  │
│ InsiderTransaction {                       │  │
│   symbol: 'AAPL',                          │  │
│   reportingName: 'John Doe',               │  │
│   typeOfOwner: 'Director, Officer', ◄──────────┘ join(', ')
│   transactionType: 'P', ◄──────────────────────┘ convertTransactionType('P')
│   securitiesTransacted: 10000,             │
│   price: 150.00,                           │
│   securitiesOwned: 100000,                 │
│   transactionDate: '2024-01-15',           │
│   filingDate: '2024-01-16'                 │
│ }                                          │
└────────────────────────────────────────────┘
                    │
                    ▼
Feature Extraction (20 smart money features)
```

---

## 6. Transaction Code Conversion

```
SEC Transaction Codes (Form 4)
┌──────────┬────────────────────────┬────────────┐
│   Code   │     Description        │  ML Type   │
├──────────┼────────────────────────┼────────────┤
│    P     │ Purchase               │     P      │ ◄─ BUY
│    A     │ Award/Grant            │     P      │ ◄─ BUY
│    J     │ Other acquisition      │     P      │ ◄─ BUY
├──────────┼────────────────────────┼────────────┤
│    S     │ Sale                   │     S      │ ◄─ SELL
│    D     │ Disposition            │     S      │ ◄─ SELL
│    F     │ Tax withholding        │     S      │ ◄─ SELL
│    M     │ Exercise option        │     S      │ ◄─ SELL
│    G     │ Gift                   │     S      │ ◄─ SELL
│    K     │ Equity swap            │     S      │ ◄─ SELL
│    L     │ Small acquisition      │     S      │ ◄─ SELL
│    V     │ Transaction in plan    │     S      │ ◄─ SELL
│    W     │ Acquisition/disposition│     S      │ ◄─ SELL
│    X     │ In-the-money option    │     S      │ ◄─ SELL
│    Z     │ Deposit/withdrawal     │     S      │ ◄─ SELL
└──────────┴────────────────────────┴────────────┘

Implementation:
┌──────────────────────────────────────────────────┐
│ convertTransactionType(code: string): 'P' | 'S' {│
│   const buyCodesMap = new Set(['P', 'A', 'J']); │
│   return buyCodesMap.has(code) ? 'P' : 'S';     │
│ }                                                │
└──────────────────────────────────────────────────┘
```

---

## 7. Cache File Structure

```
Project Root
└── data/
    └── cache/
        └── smart-money/
            ├── insider_trades/
            │   ├── AAPL_2022-01-01_2024-12-31_insider_trades.json
            │   ├── MSFT_2023-01-01_2024-12-31_insider_trades.json
            │   └── TSLA_2024-01-01_2024-10-11_insider_trades.json
            │
            ├── institutional_ownership/
            │   ├── AAPL_2023-01-01_2024-12-31_institutional_ownership.json
            │   └── GOOGL_2023-06-01_2024-06-01_institutional_ownership.json
            │
            ├── dark_pool_volume/
            │   └── AAPL_2024-09-11_2024-10-11_dark_pool_volume.json
            │
            ├── options_flow/
            │   └── AAPL_2024-09-11_2024-10-11_options_flow.json
            │
            └── block_trades/
                └── (future data type)

Cache Entry Structure:
┌─────────────────────────────────────────────────────┐
│ {                                                   │
│   "symbol": "AAPL",                                 │
│   "startDate": "2022-01-01",                        │
│   "endDate": "2024-12-31",                          │
│   "dataType": "insider_trades",                     │
│   "data": [ ...InsiderTransaction[] ],              │
│   "cachedAt": 1728662400000,                        │
│   "source": "sec-edgar",                            │
│   "ttlDays": 7                                      │
│ }                                                   │
└─────────────────────────────────────────────────────┘
```

---

## 8. Performance Impact

```
Dataset Generation WITHOUT Caching
┌──────────────────────────────────────────────────────────┐
│ 500 stocks × 5 API calls = 2,500 requests               │
│ Rate limit: 10 req/sec = 100ms/request                  │
│ Total time: 2,500 × 100ms = 250 seconds = 4.2 minutes   │
└──────────────────────────────────────────────────────────┘

Dataset Generation WITH Caching (Second Run)
┌──────────────────────────────────────────────────────────┐
│ 500 stocks × 5 API calls = 2,500 requests               │
│ Cache hit rate: 95%                                      │
│ Cache hits: 2,375 requests × 2ms = 4.75 seconds         │
│ Cache misses: 125 requests × 100ms = 12.5 seconds       │
│ Total time: ~17 seconds                                  │
│ Improvement: 250s → 17s = 93% faster                     │
└──────────────────────────────────────────────────────────┘

Cache Storage Impact
┌──────────────────────────────────────────────────────────┐
│ Average cache entry: ~50KB                               │
│ 2,500 cache entries × 50KB = 125MB total                │
│ TTL: 7 days (auto-cleanup on expiration)                 │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Implementation Phases Timeline

```
Phase 1: Type Mapping (2-3 hours)
┌─────────────────────────────────────────────────────┐
│ ✓ Add secAPI property                               │
│ ✓ Add mapInsiderTransactionFromInstitutional()      │
│ ✓ Add convertTransactionType()                      │
│ ✓ Run npm run type-check                            │
└─────────────────────────────────────────────────────┘
         │
         ▼
Phase 2: XML Parsing (4-6 hours)
┌─────────────────────────────────────────────────────┐
│ ✓ Install xml2js library                            │
│ ✓ Implement parseXML() helper                       │
│ ✓ Replace parse13FHoldings() mock                   │
│ ✓ Replace parseForm4Transactions() mock             │
│ ✓ Add XML helper methods (8 methods)                │
│ ✓ Test with real SEC data                           │
└─────────────────────────────────────────────────────┘
         │
         ▼
Phase 3: Integration Testing (2-3 hours)
┌─────────────────────────────────────────────────────┐
│ ✓ Test insider trading data                         │
│ ✓ Test institutional ownership data                 │
│ ✓ Test error handling (invalid symbols)             │
│ ✓ Test cache performance (95% hit rate)             │
│ ✓ Test rate limiting (10 req/sec)                   │
└─────────────────────────────────────────────────────┘
         │
         ▼
Phase 4: Documentation (1-2 hours)
┌─────────────────────────────────────────────────────┐
│ ✓ Update inline comments                            │
│ ✓ Update CLAUDE.md                                  │
│ ✓ Create integration guide                          │
│ ✓ Add troubleshooting section                       │
└─────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────┐
│              PRODUCTION READY ✅                     │
│  - Real SEC data (not mock)                         │
│  - 95%+ cache hit rate                              │
│  - Graceful error handling                          │
│  - 10 req/sec rate limiting                         │
└─────────────────────────────────────────────────────┘

Total Estimated Time: 9-14 hours
```

---

**End of Diagrams**
