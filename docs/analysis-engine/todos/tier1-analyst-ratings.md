# Analyst Ratings Collection

## Objective
Track analyst sentiment and price targets

## Data Sources
1. **FMP** - Primary (good coverage)
2. **TwelveData** - Limited backup
3. **Consider**: FactSet or Refinitiv for premium data

## Required Data
### Ratings
- Consensus rating (Strong Buy/Buy/Hold/Sell/Strong Sell)
- Number of analysts covering
- Recent rating changes (upgrades/downgrades)

### Price Targets
- Average target price
- High/low target range
- Target vs current price %
- Recent target revisions

### Trends
- Rating momentum (improving/deteriorating)
- Revision trends (up/down)
- Analyst conviction level

## Implementation Tasks
- [ ] Map FMP analyst endpoints
- [ ] Create rating aggregation logic
- [ ] Build consensus calculation
- [ ] Set up rating change alerts
- [ ] Track price target changes
- [ ] Create sentiment scoring (1-5)
- [ ] Add revision trend analysis
- [ ] Cache with daily refresh

## Success Criteria
- Daily analyst data updates
- Alert on rating changes
- Price target tracking
- Sentiment score generation