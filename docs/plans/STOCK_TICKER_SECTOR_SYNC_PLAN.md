# Stock Ticker Sector Synchronization Plan

**Purpose**: Make the stock ticker display exactly match the selected sector with appropriate stocks  
**Priority**: HIGH - User-requested feature  
**Estimated Time**: 30 minutes

## Current Problem
- Stock ticker doesn't properly show sector-specific stocks
- Missing stocks with significant price movements
- Too focused on market cap alone

## Desired Outcome
When a user selects a sector (e.g., Healthcare):
1. Ticker shows 15-20 stocks from that sector
2. Mix of high market cap leaders AND high movers (up/down)
3. Real-time updates if enabled
4. Clear, simple display

## Implementation Strategy

### 1. Fix Stock Selection Logic
**File**: `/app/api/stocks/by-sector/route.ts`

- Modify the selection algorithm to:
  - Get top 10 market cap leaders
  - Get top 5 biggest gainers
  - Get top 5 biggest losers
  - Combine for balanced view

### 2. Enhance Curated Stock Lists
**File**: `/app/api/stocks/by-sector/route.ts`

- Ensure each sector has 20+ quality stocks
- Include mix of large/mid/small cap
- Add known volatile stocks for movement

### 3. Simplify API Response
**File**: `/app/api/stocks/by-sector/route.ts`

- Return clean stock array
- Include essential data only:
  - Symbol (proName)
  - Name (title)
  - Price
  - Change %
  - Volume

### 4. Update Frontend Integration
**File**: `/app/page.tsx`

- Ensure ticker receives correct symbols
- Remove unnecessary complexity
- Focus on display clarity

## Stock Selection Algorithm

```javascript
function getBalancedSectorStocks(sector) {
  // 1. Get all stocks for sector
  const allStocks = getSectorStocks(sector)
  
  // 2. Sort by market cap
  const byMarketCap = sortByMarketCap(allStocks)
  const leaders = byMarketCap.slice(0, 10)
  
  // 3. Sort by price change
  const byChange = sortByAbsoluteChange(allStocks)
  const movers = byChange
    .filter(s => !leaders.includes(s))
    .slice(0, 10)
  
  // 4. Combine and return
  return [...leaders, ...movers].slice(0, 20)
}
```

## Testing Checklist
- [ ] Select Technology → See tech stocks
- [ ] Select Healthcare → See healthcare stocks  
- [ ] Select Financials → See financial stocks
- [ ] Verify mix of leaders and movers
- [ ] Check real-time updates work
- [ ] Confirm 15-20 stocks per sector

## Success Criteria
✅ Ticker shows correct sector stocks
✅ Mix of market leaders and movers
✅ Clean, simple display
✅ Fast sector switching
✅ No overwhelming UI elements