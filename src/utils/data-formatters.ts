import { EconomicIndicator, ChartDataPoint, EconomicObservation } from "../types/economic-data";

/**
 * Format number values for display with appropriate precision and units
 */
export const formatValue = (value: string | number, unit?: string): string => {
	if (value === "." || value === "" || value === null || value === undefined) {
		return "N/A";
	}

	const numValue = typeof value === "string" ? parseFloat(value) : value;

	if (isNaN(numValue)) return "N/A";

	// Format based on magnitude
	if (numValue >= 1000000000) {
		return `$${(numValue / 1000000000).toFixed(2)}T`;
	} else if (numValue >= 1000000) {
		return `$${(numValue / 1000000).toFixed(1)}B`;
	} else if (numValue >= 1000) {
		return `${(numValue / 1000).toFixed(1)}K`;
	} else if (numValue % 1 === 0) {
		return numValue.toString();
	} else {
		return numValue.toFixed(2);
	}
};

/**
 * Format percentage values
 */
export const formatPercentage = (value: string | number): string => {
	if (value === "." || value === "" || value === null || value === undefined) {
		return "N/A";
	}

	const numValue = typeof value === "string" ? parseFloat(value) : value;

	if (isNaN(numValue)) return "N/A";

	return `${numValue.toFixed(2)}%`;
};

/**
 * Format dates for display
 */
export const formatDate = (dateString: string): string => {
	try {
		const date = new Date(dateString);
		return date.toLocaleDateString("en-US", {
			year: "numeric",
			month: "short",
		});
	} catch {
		return dateString;
	}
};

/**
 * Convert economic indicator data to chart data points
 */
export const convertToChartData = (indicator: EconomicIndicator): ChartDataPoint[] => {
	const observations = indicator.observations || indicator.recent_observations || [];

	return observations
		.filter(obs => obs.value !== "." && obs.value !== "" && obs.value !== null)
		.map(obs => ({
			date: obs.date,
			value: typeof obs.value === "string" ? parseFloat(obs.value) : obs.value,
			label: formatDate(obs.date),
		}))
		.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/**
 * Calculate trend direction and percentage change
 */
export const calculateTrend = (
	data: ChartDataPoint[]
): {
	direction: "Rising" | "Falling" | "Stable";
	changePercent: number;
} => {
	if (data.length < 2) {
		return { direction: "Stable", changePercent: 0 };
	}

	const firstValue = data[0].value;
	const lastValue = data[data.length - 1].value;
	const changePercent = ((lastValue - firstValue) / firstValue) * 100;

	let direction: "Rising" | "Falling" | "Stable" = "Stable";
	if (Math.abs(changePercent) > 0.1) {
		direction = changePercent > 0 ? "Rising" : "Falling";
	}

	return { direction, changePercent };
};

/**
 * Get appropriate glow color based on trend and metric type
 */
export const getGlowColor = (
	trend?: "Rising" | "Falling" | "Stable",
	metricType?: "positive" | "negative" | "neutral"
): "cyan" | "green" | "pink" | "blue" | "yellow" | "red" => {
	if (!trend || trend === "Stable") return "cyan";

	// For metrics where rising is good (GDP, employment, etc.)
	if (metricType === "positive") {
		return trend === "Rising" ? "green" : "red";
	}

	// For metrics where falling is good (unemployment, inflation, etc.)
	if (metricType === "negative") {
		return trend === "Falling" ? "green" : "red";
	}

	// Default neutral coloring
	return trend === "Rising" ? "blue" : "pink";
};

/**
 * Generate smooth animation delays for staggered effects
 */
export const generateStaggeredDelay = (index: number, baseDelay: number = 0.1): number => {
	return baseDelay + index * 0.1;
};

/**
 * Format large numbers with K, M, B, T suffixes
 */
export const formatLargeNumber = (value: number): string => {
	if (value >= 1e12) {
		return `${(value / 1e12).toFixed(1)}T`;
	} else if (value >= 1e9) {
		return `${(value / 1e9).toFixed(1)}B`;
	} else if (value >= 1e6) {
		return `${(value / 1e6).toFixed(1)}M`;
	} else if (value >= 1e3) {
		return `${(value / 1e3).toFixed(1)}K`;
	}
	return value.toFixed(2);
};

/**
 * Get sector-specific styling and icons
 */
export const getSectorConfig = (sectorName: string) => {
	const configs: Record<
		string,
		{
			icon: string;
			color: string;
			glowColor: "cyan" | "green" | "pink" | "blue" | "yellow" | "red";
		}
	> = {
		Employment: {
			icon: "👥",
			color: "from-blue-500 to-cyan-500",
			glowColor: "blue",
		},
		Inflation: {
			icon: "📊",
			color: "from-red-500 to-pink-500",
			glowColor: "red",
		},
		Interest_Rates: {
			icon: "💰",
			color: "from-green-500 to-emerald-500",
			glowColor: "green",
		},
		Economic_Growth: {
			icon: "📈",
			color: "from-purple-500 to-indigo-500",
			glowColor: "pink",
		},
		Housing: {
			icon: "🏠",
			color: "from-orange-500 to-yellow-500",
			glowColor: "yellow",
		},
		International: {
			icon: "🌍",
			color: "from-teal-500 to-cyan-500",
			glowColor: "cyan",
		},
	};

	return (
		configs[sectorName] || {
			icon: "📊",
			color: "from-gray-500 to-slate-500",
			glowColor: "cyan" as const,
		}
	);
};
