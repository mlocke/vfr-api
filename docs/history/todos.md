# Service Utilization Fix - Todo List

## Phase 1: Critical Fixes (1-2 days)

### 1. Fix Sentiment Analysis Reporting - HIGHEST PRIORITY
- **File**: `app/services/stock-selection/StockSelectionService.ts`
- **Issue**: Service works but shows 0% utilization
- **Fix**: Update utilization tracking to capture AlgorithmEngine sentiment execution
- **Test**: Verify admin dashboard shows 10% utilization

### 2. Connect Technical Analysis Tracking
- **File**: `app/services/stock-selection/StockSelectionService.ts`
- **Issue**: TechnicalIndicatorService execution not tracked
- **Fix**: Propagate technical analysis utilization (35% weight)
- **Test**: Admin dashboard shows technical analysis usage

## Phase 2: Integration Fixes (3-5 days)

### 3. VWAP Service Integration
- **File**: `app/services/financial-data/VWAPService.ts`
- **Fix**: Connect VWAP execution to main tracking layer
- **Test**: VWAP features show as utilized

### 4. Fundamental Analysis Tracking
- **Files**: Quality composite execution tracking
- **Fix**: Connect FMP/EODHD dual-source to reporting
- **Test**: 25% weight properly reported

### 5. Macroeconomic Service Tracking
- **Files**: FRED + BLS + EIA service integration
- **Fix**: Connect economic context execution to tracking
- **Test**: 20% weight properly reported

## Phase 3: Architecture (1-2 weeks)

### 6. Unified Tracking Architecture
- **Goal**: Single source of truth for utilization
- **Fix**: Eliminate dual-layer execution disconnect
- **Test**: All services show accurate real-time utilization

## Success Metrics

- Phase 1: Sentiment (10%) + Technical (35%) = 45% accurate reporting
- Phase 2: All 5 services show correct utilization percentages
- Phase 3: Real-time accuracy, no reporting disconnects

## Key Files to Update

- `/app/services/stock-selection/StockSelectionService.ts` - Main tracking fixes
- `/app/services/algorithms/AlgorithmEngine.ts` - Ensure layer connections
- `/app/api/admin/analysis/route.ts` - Dashboard reporting