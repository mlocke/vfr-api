export interface EconomicObservation {
	realtime_start: string;
	realtime_end: string;
	date: string;
	value: string | number;
}

export interface EconomicIndicatorStats {
	current: number;
	min: number;
	max: number;
	average: number;
	trend: "Rising" | "Falling" | "Stable";
}

export interface EconomicIndicator {
	description: string;
	latest_value: string | number;
	latest_date: string;
	recent_observations?: EconomicObservation[];
	observations?: EconomicObservation[];
	statistics?: EconomicIndicatorStats;
	data_points?: number;
	units?: string;
	frequency?: string;
}

export interface EconomicSector {
	[key: string]: EconomicIndicator;
}

export interface EconomicDashboardData {
	Employment: EconomicSector;
	Inflation: EconomicSector;
	Interest_Rates: EconomicSector;
	Economic_Growth: EconomicSector;
	Housing: EconomicSector;
	International: EconomicSector;
}

export interface FredDataResponse {
	description: string;
	timestamp: string;
	sample_data: EconomicDashboardData | { [key: string]: EconomicIndicator };
	data_type: string;
	source: string;
}

export interface MetricCardProps {
	title: string;
	value: string | number;
	change?: number;
	trend?: "Rising" | "Falling" | "Stable";
	unit?: string;
	description?: string;
	animated?: boolean;
	glowColor?: "cyan" | "green" | "pink" | "blue" | "yellow" | "red";
	size?: "small" | "medium" | "large";
}

export interface ChartDataPoint {
	date: string;
	value: number;
	label?: string;
}

export interface TrendChartProps {
	data: ChartDataPoint[];
	title: string;
	color?: string;
	height?: number;
	animated?: boolean;
	showGrid?: boolean;
	showTooltip?: boolean;
}
