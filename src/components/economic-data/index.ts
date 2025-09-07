/**
 * Cyberpunk Economic Data Visualization Components
 *
 * A comprehensive suite of React components for visualizing FRED economic data
 * with a cyberpunk aesthetic, featuring real-time animations, interactive charts,
 * and full accessibility support.
 *
 * @author Claude Code
 * @version 1.0.0
 */

// Main visualization components
export { default as EconomicDataVisualization } from "./EconomicDataVisualization";
export { default as EconomicDashboard } from "./EconomicDashboard";
export { default as MetricCard } from "./MetricCard";
export { default as TrendChart } from "./TrendChart";
export { default as ComparisonChart } from "./ComparisonChart";

// Types
export type {
	EconomicObservation,
	EconomicIndicatorStats,
	EconomicIndicator,
	EconomicSector,
	EconomicDashboardData,
	FredDataResponse,
	MetricCardProps,
	ChartDataPoint,
	TrendChartProps,
} from "../../types/economic-data";

// Utility functions
export {
	formatValue,
	formatPercentage,
	formatDate,
	convertToChartData,
	calculateTrend,
	getGlowColor,
	getSectorConfig,
	generateStaggeredDelay,
	formatLargeNumber,
} from "../../utils/data-formatters";

// Accessibility utilities
export {
	generateAriaDescription,
	generateChartDescription,
	getAccessibleColors,
	prefersReducedMotion,
	prefersHighContrast,
	announceToScreenReader,
	getKeyboardInstructions,
	FocusManager,
	getColorBlindFriendlyPalette,
	generateTableDescription,
} from "../../utils/accessibility";

// Hooks
export { useResponsive, useGridColumns, useChartDimensions } from "../../hooks/useResponsive";

// Style imports - These need to be imported in your app
// import './cyberpunk.css';
// import './responsive.css';
