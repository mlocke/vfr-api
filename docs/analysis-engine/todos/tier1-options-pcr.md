# Options Put/Call Ratio Collection

## Objective
Track options sentiment through put/call ratios

## Data Sources
1. **Polygon.io** - Primary (best options coverage)
2. **TwelveData** - Limited backup
3. **Consider**: Direct CBOE integration for official ratios

## Required Metrics
- Daily put/call volume ratios
- Put/call open interest ratios
- Individual stock P/C ratios
- Market-wide P/C ratios
- Historical P/C trends (20-day moving average)

## Implementation Tasks
- [ ] Research Polygon options endpoints
- [ ] Implement P/C ratio calculations
- [ ] Create daily collection schedule
- [ ] Build trend analysis (5, 10, 20 day MA)
- [ ] Add extreme ratio alerts (>1.2 or <0.7)
- [ ] Store historical ratios for backtesting
- [ ] Create sentiment scoring algorithm
- [ ] Integrate with stock selection service

## Success Criteria
- Daily P/C ratio updates by 5 PM EST
- Historical data for trend analysis
- Alert on extreme readings
- Integration with AI analysis engine