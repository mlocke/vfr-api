/**
 * TypeScript interfaces for Interactive Stock Analysis Dialog
 * Provides comprehensive type safety for Next.js 15 dialog components
 */

import { EnhancedStockResult } from '../../services/stock-selection/types'

/**
 * Core dialog data interface - enhanced from API response
 */
export interface DialogStockData {
  symbol: string
  score: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
    macro: number
    alternative: number
  }
  weight: number
  action: 'STRONG_BUY' | 'BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL' | 'SELL' | 'STRONG_SELL'
  confidence: number
  context: {
    sector: string
    marketCap: number
    priceChange24h?: number
    volumeChange24h?: number
    beta?: number
    currentPrice?: number
    preMarketPrice?: number
    preMarketChange?: number
    preMarketChangePercent?: number
    afterHoursPrice?: number
    afterHoursChange?: number
    afterHoursChangePercent?: number
    marketStatus?: 'pre-market' | 'market-hours' | 'after-hours' | 'closed'
  }
  reasoning: {
    primaryFactors: string[]
    warnings?: string[]
    opportunities?: string[]
  }
  dataQuality: {
    overall: {
      overall: number
      timestamp: number
      source: string
      metrics: {
        freshness: number
        completeness: number
        accuracy: number
        sourceReputation: number
        latency: number
      }
    }
    lastUpdated: number
  }
  sentimentBreakdown?: {
    newsScore: number
    redditScore: number
    analystScore: number
    overallSentiment: string
    confidence: number
  }
  realtime?: {
    price: number
    change: number
    changePercent: number
    volume: number
    timestamp: number
  }
}

/**
 * Main dialog component props
 */
export interface StockAnalysisDialogProps {
  symbol: string | null
  isOpen: boolean
  onClose: () => void
  onActionTaken?: (action: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL', symbol: string) => void
  className?: string
}

/**
 * Dialog state management interface
 */
export interface DialogState {
  stockData: DialogStockData | null
  loading: boolean
  error: string | null
  expandedInsights: Set<string>
  expandedRisksOpportunities: boolean
  lastUpdated: number
  refreshing: boolean
}

/**
 * Dialog context for state management
 */
export interface DialogContextType {
  activeDialog: string | null
  dialogData: Map<string, DialogStockData>
  loadingStates: Map<string, boolean>
  errorStates: Map<string, string>
  lastUpdated: Map<string, number>
  openDialog: (symbol: string) => void
  closeDialog: () => void
  refreshDialog: (symbol: string) => void
  isLoading: (symbol: string) => boolean
  getError: (symbol: string) => string | null
}

/**
 * Header component props
 */
export interface DialogHeaderProps {
  stockData: DialogStockData
  onClose: () => void
  onRefresh?: () => void
}

/**
 * Recommendation badge props
 * PHASE 1 CALIBRATION: Updated to support STRONG_BUY and STRONG_SELL
 */
export interface RecommendationBadgeProps {
  action: 'STRONG_BUY' | 'BUY' | 'MODERATE_BUY' | 'HOLD' | 'MODERATE_SELL' | 'SELL' | 'STRONG_SELL'
  confidence: number
  size?: 'small' | 'medium' | 'large'
  showConfidence?: boolean
}

/**
 * Score visualization props
 */
export interface ScoreVisualizationProps {
  scores: {
    overall: number
    technical: number
    fundamental: number
    sentiment: number
    macro: number
    alternative: number
  }
  size?: number
  animated?: boolean
  showBreakdown?: boolean
}

/**
 * Individual insight interface
 */
export interface Insight {
  id: string
  title: string
  status: 'positive' | 'negative' | 'neutral' | 'warning'
  expandable: boolean
  icon: string
  details?: string[]
  confidence?: number
  category: 'technical' | 'fundamental' | 'sentiment' | 'macro' | 'alternative'
}

/**
 * Quick insights component props
 */
export interface QuickInsightsProps {
  insights: Insight[]
  expandedInsights: Set<string>
  onToggle: (insightId: string) => void
  maxVisible?: number
  showAll?: boolean
}

/**
 * Risk and opportunity items
 */
export interface RiskOpportunityItem {
  id: string
  title: string
  description: string
  type: 'risk' | 'opportunity'
  severity: 'low' | 'medium' | 'high'
  category: 'technical' | 'fundamental' | 'macro' | 'regulatory' | 'market'
  impact?: number // 0-1 scale
  probability?: number // 0-1 scale
}

/**
 * Risks and opportunities component props
 */
export interface RisksOpportunitiesProps {
  risks: string[]
  opportunities: string[]
  warnings?: string[]
  isExpanded: boolean
  onToggle: () => void
  maxItems?: number
}

/**
 * Dialog footer props
 */
export interface DialogFooterProps {
  lastUpdated: number
  onAction?: (action: 'BUY' | 'SELL' | 'HOLD', symbol: string) => void
  symbol: string
  recommendation: 'BUY' | 'SELL' | 'HOLD'
  showActions?: boolean
  dataQuality?: number
}

/**
 * Action button props
 */
export interface ActionButtonProps {
  action: 'BUY' | 'SELL' | 'HOLD'
  isRecommended: boolean
  onClick: () => void
  disabled?: boolean
  size?: 'small' | 'medium' | 'large'
}

/**
 * Loading state props
 */
export interface DialogLoadingStateProps {
  symbol?: string
  stage?: 'fetching' | 'analyzing' | 'processing'
  progress?: number
}

/**
 * Error state props
 */
export interface DialogErrorStateProps {
  error: string
  symbol?: string
  onRetry?: () => void
  onDismiss?: () => void
  type?: 'network' | 'data' | 'timeout' | 'validation'
}

/**
 * Expandable section props
 */
export interface ExpandableSectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  icon?: string
  badge?: string | number
  variant?: 'default' | 'info' | 'warning' | 'error'
}

/**
 * Animation configuration
 */
export interface DialogAnimationConfig {
  duration: number
  easing: string
  fadeIn: boolean
  slideIn: boolean
  scaleIn: boolean
  stagger?: number
}

/**
 * Theme configuration for dialog
 */
export interface DialogThemeConfig {
  colors: {
    background: {
      primary: string
      secondary: string
      overlay: string
    }
    border: {
      primary: string
      accent: string
      error: string
      success: string
    }
    text: {
      primary: string
      secondary: string
      muted: string
    }
    actions: {
      buy: string
      sell: string
      hold: string
    }
  }
  effects: {
    glassBlur: string
    borderRadius: string
    shadow: string
  }
  breakpoints: {
    mobile: string
    tablet: string
    desktop: string
  }
}

/**
 * Dialog performance metrics
 */
export interface DialogPerformanceMetrics {
  loadTime: number
  renderTime: number
  interactionTime: number
  animationFrames?: number
  memoryUsage?: number
}

/**
 * Dialog accessibility props
 */
export interface DialogA11yProps {
  ariaLabel?: string
  ariaLabelledBy?: string
  ariaDescribedBy?: string
  role?: string
  focusTrap?: boolean
  initialFocus?: string
  returnFocus?: boolean
}

/**
 * Keyboard navigation interface
 */
export interface KeyboardNavigation {
  enabled: boolean
  shortcuts: {
    [key: string]: () => void
  }
  tabOrder: string[]
  trapFocus: boolean
}

/**
 * Mobile gestures interface
 */
export interface MobileGestures {
  swipeToClose: boolean
  pullToRefresh: boolean
  pinchToZoom: boolean
  touchScrolling: boolean
}

/**
 * Dialog configuration interface
 */
export interface DialogConfig {
  animation: DialogAnimationConfig
  theme: DialogThemeConfig
  accessibility: DialogA11yProps
  keyboard: KeyboardNavigation
  mobile: MobileGestures
  performance: {
    lazyLoad: boolean
    virtualScrolling: boolean
    memoryLimit: number
  }
}

/**
 * API response interface
 */
export interface DialogAPIResponse {
  success: boolean
  data?: DialogStockData
  error?: string
  metadata?: {
    executionTime: number
    dataSourcesUsed: string[]
    cacheHit: boolean
    analysisMode: string
  }
}

/**
 * Dialog event types for analytics
 */
export type DialogEventType =
  | 'dialog_opened'
  | 'dialog_closed'
  | 'insight_expanded'
  | 'insight_collapsed'
  | 'action_taken'
  | 'error_occurred'
  | 'refresh_requested'
  | 'keyboard_navigation'
  | 'mobile_gesture'

/**
 * Dialog analytics event
 */
export interface DialogAnalyticsEvent {
  type: DialogEventType
  symbol: string
  timestamp: number
  data?: Record<string, any>
  userAgent?: string
  sessionId?: string
}

/**
 * Utility type for dialog component variants
 */
export type DialogVariant = 'default' | 'compact' | 'expanded' | 'mobile'

/**
 * Utility type for dialog sizes
 */
export type DialogSize = 'small' | 'medium' | 'large' | 'full'

/**
 * Utility type for dialog positions
 */
export type DialogPosition = 'center' | 'top' | 'bottom' | 'left' | 'right'