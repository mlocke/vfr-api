# Stock Analysis Dialog Implementation Plan

## Overview
Implementation plan for building an interactive stock analysis dialog that displays comprehensive analysis results in a user-friendly cyberpunk-themed modal. Based on the AAPL dialog screenshot showing sophisticated analysis visualization with expandable sections.

## Core Requirements

### Dialog Structure (from Screenshot Analysis)
```
┌─────────────────────────────────────────────┐
│ AAPL  +2.4% | $185.30                    [×]│
│ BUY 78%                                     │
│ Technology | Market Cap: $3.0 T             │
├─────────────────────────────────────────────┤
│ OVERALL SCORE: 89/100                       │
│ ████████████████████████████▒▒▒▒ 89%       │
├─────────────────────────────────────────────┤
│ Factor Breakdown:                           │
│ Excellent    ████████████████████████████   │
│ Above Mean   ████████████████████▒▒▒▒▒▒▒▒   │
│ Moderate     ████████████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
│ Balanced     ██████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
│ Hit Gate     ████▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒   │
├─────────────────────────────────────────────┤
│ ⌄ Quick Insights                            │
│   ✓ Trading above key price levels         │
│   ✓ Strong earnings growth momentum         │
│   ✓ Positive analyst sentiment             │
├─────────────────────────────────────────────┤
│ ⌄ Risks & Opportunities                     │
│                                             │
├─────────────────────────────────────────────┤
│ Last updated: 18 min ago                    │
└─────────────────────────────────────────────┘
```

## Implementation Tasks

### 1. Component Architecture

#### StockAnalysisDialog.tsx
```typescript
interface StockAnalysisDialogProps {
  stock: EnhancedStockResult | null
  isOpen: boolean
  onClose: () => void
  className?: string
}
```

**Key Features:**
- Modal overlay with cyberpunk dark theme
- Responsive design (mobile-first approach)
- Keyboard navigation support (ESC to close)
- Click-outside-to-close functionality
- Smooth animations for open/close states

#### Sub-components to Create:
- `DialogHeader.tsx` - Stock symbol, price, close button
- `RecommendationBadge.tsx` - BUY/SELL/HOLD with confidence
- `ScoreVisualization.tsx` - Overall score with progress bar
- `FactorBreakdown.tsx` - Colored factor score bars
- `ExpandableSection.tsx` - Reusable collapsible sections
- `QuickInsights.tsx` - Insights with checkmark icons
- `RisksOpportunities.tsx` - Risk/opportunity content

### 2. Data Integration

#### Mapping EnhancedStockResult to Dialog Components
```typescript
// From existing types.ts
interface EnhancedStockResult {
  symbol: string
  score: StockScore  // Contains factorScores, overallScore
  action: 'BUY' | 'SELL' | 'HOLD'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    // ... extended hours data
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
}
```

#### Score Breakdown Visualization
Map `StockScore.factorScores` to visual factor categories:
- **Excellent** (90-100%): Green bars, maximum width
- **Above Mean** (70-89%): Light green bars, proportional width
- **Moderate** (50-69%): Yellow bars, proportional width
- **Balanced** (30-49%): Orange bars, proportional width
- **Hit Gate** (0-29%): Red bars, proportional width

### 3. UI/UX Implementation

#### Cyberpunk Theme Specifications
```css
:root {
  --dialog-bg: rgba(17, 24, 39, 0.95); /* gray-900 with transparency */
  --dialog-border: rgb(75, 85, 99); /* gray-600 */
  --accent-cyan: rgb(34, 211, 238); /* cyan-400 */
  --accent-green: rgb(34, 197, 94); /* green-500 */
  --text-primary: rgb(255, 255, 255);
  --text-secondary: rgb(156, 163, 175); /* gray-400 */
}
```

#### Responsive Breakpoints
- **Mobile (< 640px):** Full-screen dialog, stacked layout
- **Tablet (640px - 1024px):** Modal with reduced margins
- **Desktop (> 1024px):** Centered modal with fixed max-width

#### Animation Specifications
- Dialog fade-in: 200ms ease-out
- Factor bars animate on mount: 500ms ease-out with staggered delay
- Expandable sections: 300ms ease-in-out
- Hover states: 150ms ease-in-out

### 4. Expandable Sections Implementation

#### Quick Insights
```typescript
interface Insight {
  text: string
  type: 'positive' | 'neutral' | 'negative'
  icon: 'check' | 'warning' | 'info'
}
```

Map from `reasoning.primaryFactors` to insights with appropriate icons and styling.

#### Risks & Opportunities
```typescript
interface RiskOpportunity {
  title: string
  description: string
  type: 'risk' | 'opportunity'
  severity?: 'low' | 'medium' | 'high'
}
```

Map from `reasoning.warnings` and `reasoning.opportunities` arrays.

### 5. Performance Optimization

#### Loading States
- Skeleton placeholders while data loads
- Progressive disclosure of complex visualizations
- Optimized re-renders with React.memo

#### Memory Management
- Lazy loading of heavy chart components
- Cleanup of event listeners on unmount
- Memoized calculations for score visualizations

#### Bundle Optimization
- Code splitting for dialog component
- Tree shaking of unused utilities
- Compressed animations and transitions

### 6. Testing Strategy

#### Unit Tests
```typescript
// StockAnalysisDialog.test.tsx
describe('StockAnalysisDialog', () => {
  test('renders stock information correctly')
  test('handles BUY/SELL/HOLD recommendations')
  test('displays factor breakdown with correct percentages')
  test('expands and collapses sections')
  test('closes on ESC key press')
  test('closes on outside click')
  test('handles mobile responsive layout')
})
```

#### Integration Tests
```typescript
// StockAnalysisDialog.integration.test.tsx
describe('StockAnalysisDialog Integration', () => {
  test('integrates with real StockSelectionService data')
  test('handles missing optional data gracefully')
  test('displays extended hours information correctly')
  test('shows appropriate loading states')
})
```

#### Accessibility Tests
- Screen reader compatibility
- Keyboard navigation flow
- Color contrast validation
- Focus management

### 7. File Structure

```
app/components/stock-analysis/
├── StockAnalysisDialog.tsx           # Main dialog component
├── components/
│   ├── DialogHeader.tsx              # Header with symbol/price
│   ├── RecommendationBadge.tsx       # BUY/SELL/HOLD badge
│   ├── ScoreVisualization.tsx        # Overall score bar
│   ├── FactorBreakdown.tsx           # Factor score bars
│   ├── ExpandableSection.tsx         # Reusable collapsible
│   ├── QuickInsights.tsx             # Insights section
│   └── RisksOpportunities.tsx        # Risks section
├── hooks/
│   ├── useDialogKeyboard.ts          # Keyboard handling
│   ├── useScoreAnimation.ts          # Score bar animations
│   └── useExpandableSection.ts       # Section state
├── utils/
│   ├── scoreFormatters.ts            # Score formatting utils
│   ├── colorMappings.ts              # Factor color mapping
│   └── animationHelpers.ts           # Animation utilities
└── __tests__/
    ├── StockAnalysisDialog.test.tsx
    ├── components/                   # Component tests
    ├── hooks/                        # Hook tests
    └── integration/                  # Integration tests
```

### 8. Integration Points

#### Trigger Implementation
Update existing `SelectionResults.tsx` StockCard component:
```typescript
// Add click handler to open dialog
<div
  className="cursor-pointer"
  onClick={() => onOpenAnalysisDialog(stock)}
>
  {/* Existing stock card content */}
</div>
```

#### State Management
Add dialog state to parent component:
```typescript
const [selectedStock, setSelectedStock] = useState<EnhancedStockResult | null>(null)
const [dialogOpen, setDialogOpen] = useState(false)

const handleOpenDialog = (stock: EnhancedStockResult) => {
  setSelectedStock(stock)
  setDialogOpen(true)
}
```

## Success Criteria

### Functional Requirements
✅ Dialog displays all stock analysis data accurately
✅ Expandable sections work smoothly on all devices
✅ Cyberpunk theme matches existing application design
✅ Performance remains optimal with complex visualizations
✅ Accessibility standards met (WCAG 2.1 AA)

### Technical Requirements
✅ Component passes all unit and integration tests
✅ Bundle size increase < 50KB gzipped
✅ Renders in < 200ms on average hardware
✅ Works across all supported browsers
✅ Mobile-responsive with touch interactions

### User Experience Requirements
✅ Intuitive navigation and information hierarchy
✅ Clear visual feedback for all interactions
✅ Consistent with existing application patterns
✅ Smooth animations that enhance rather than distract
✅ Quick access to detailed analysis information

## Implementation Timeline

**Phase 1** (Days 1-2): Core dialog structure and basic data display
**Phase 2** (Days 3-4): Factor visualization and expandable sections
**Phase 3** (Days 5-6): Responsive design and animations
**Phase 4** (Days 7-8): Testing, performance optimization, and integration

## Notes

- Follow existing cyberpunk theme conventions from `globals.css`
- Ensure compatibility with current TypeScript strict mode settings
- Use existing utility components where possible (GlassButton, etc.)
- Maintain consistency with SelectionResults component patterns
- Consider future extensibility for additional analysis features