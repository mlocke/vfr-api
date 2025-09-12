# Stock Ticker Sector Synchronization TODO

**Objective**: Fix stock ticker to show sector-appropriate stocks with mix of leaders and movers  
**Status**: PENDING  
**Priority**: IMMEDIATE

## Tasks

### 1. Fix Stock Selection Algorithm
- [ ] Open `/app/api/stocks/by-sector/route.ts`
- [ ] Locate `getCuratedSectorStocks()` function
- [ ] Modify to return balanced selection:
  - [ ] Top 10 by market cap
  - [ ] Top 5 gainers
  - [ ] Top 5 losers
- [ ] Test with each sector

### 2. Update Curated Stock Data
- [ ] Ensure each sector has 20+ stocks minimum
- [ ] Add volatile stocks for movement display
- [ ] Include recognizable brand names
- [ ] Balance large/mid/small cap

### 3. Simplify Response Format
- [ ] Remove unnecessary data fields
- [ ] Keep only: symbol, name, price, change%, volume
- [ ] Ensure consistent format across sectors
- [ ] Add proper typing

### 4. Test Sector Switching
- [ ] Technology → Verify AAPL, MSFT, GOOGL, etc.
- [ ] Healthcare → Verify JNJ, PFE, UNH, etc.
- [ ] Financials → Verify JPM, BAC, GS, etc.
- [ ] Energy → Verify XOM, CVX, COP, etc.
- [ ] Each sector shows 15-20 stocks

### 5. Verify Display
- [ ] Stock ticker shows correct stocks
- [ ] Smooth sector transitions
- [ ] No duplicate stocks
- [ ] Proper scrolling behavior

## Implementation Order
1. First: Fix the selection algorithm
2. Second: Update stock data
3. Third: Test each sector
4. Fourth: Verify UI display

## Code Changes Needed

### In `/app/api/stocks/by-sector/route.ts`:
```typescript
// Simplified selection logic
const leaders = stocks
  .sort((a, b) => b.marketCap - a.marketCap)
  .slice(0, 10)

const movers = stocks
  .filter(s => !leaders.includes(s))
  .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
  .slice(0, 10)

return [...leaders, ...movers]
```

## Definition of Done
✅ Each sector shows appropriate stocks
✅ Mix of market leaders and price movers
✅ 15-20 stocks per sector
✅ Clean, fast sector switching
✅ No UI complexity or overwhelming elements