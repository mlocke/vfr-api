# Fundamental Ratios Collection

## Objective
Fetch and process fundamental ratios with multi-source fallback

## Data Sources (Priority Order)
1. **FMP** - Primary (best coverage)
2. **TwelveData** - Secondary
3. **Alpha Vantage** - Fallback (25 req/day limit)

## Required Ratios
### Valuation
- P/E, P/B, PEG ratios
- EV/EBITDA, Price/Sales

### Profitability
- ROE, ROA, ROIC
- Gross/Operating/Net margins

### Financial Health
- Debt-to-Equity
- Current ratio, Quick ratio
- Interest coverage

## Implementation Tasks
- [ ] Map FMP fundamental endpoints
- [ ] Create TwelveData fallback logic
- [ ] Add Alpha Vantage as last resort
- [ ] Build ratio calculation validators
- [ ] Set quarterly update schedule
- [ ] Create data quality checks
- [ ] Implement caching strategy
- [ ] Add significant change alerts

## Success Criteria
- Daily fundamental data updates
- Ratio validation against reasonable bounds
- Automatic source switching on failure
- Alert on >20% ratio changes