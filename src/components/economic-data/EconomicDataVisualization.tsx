import React, { useState, useEffect, useRef } from "react";
import EconomicDashboard from "./EconomicDashboard";
import ComparisonChart from "./ComparisonChart";
import MetricCard from "./MetricCard";
import TrendChart from "./TrendChart";
import { useResponsive } from "../../hooks/useResponsive";
import { EconomicDashboardData, FredDataResponse, ChartDataPoint } from "../../types/economic-data";
import {
	convertToChartData,
	getSectorConfig,
	generateAriaDescription,
	generateChartDescription,
	announceToScreenReader,
	FocusManager,
} from "../../utils/accessibility";
import "../../styles/cyberpunk.css";
import "../../styles/responsive.css";

interface EconomicDataVisualizationProps {
	/** Sample data from FRED API */
	fredData?: FredDataResponse;
	/** Override title */
	title?: string;
	/** Enable/disable animations */
	animated?: boolean;
	/** View mode */
	viewMode?: "dashboard" | "comparison" | "overview";
	/** Custom theme overrides */
	theme?: {
		primaryColor?: string;
		accentColors?: string[];
		reducedMotion?: boolean;
		highContrast?: boolean;
	};
}

const EconomicDataVisualization: React.FC<EconomicDataVisualizationProps> = ({
	fredData,
	title = "FRED Economic Data Visualization",
	animated = true,
	viewMode = "dashboard",
	theme,
}) => {
	const [activeView, setActiveView] = useState<"dashboard" | "comparison" | "overview">(viewMode);
	const [selectedMetrics, setSelectedMetrics] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [announcement, setAnnouncement] = useState<string>("");

	const containerRef = useRef<HTMLDivElement>(null);
	const focusManagerRef = useRef(new FocusManager());
	const { isMobile, isTablet, screenWidth } = useResponsive();

	// Use sample data if no fredData provided
	const sampleDashboardData: EconomicDashboardData = {
		Employment: {
			UNRATE: {
				description: "Unemployment Rate",
				latest_value: "4.3",
				latest_date: "2025-08-01",
				recent_observations: [
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-08-01",
						value: "4.3",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-07-01",
						value: "4.2",
					},
					{
						realtime_start: "2025-09-05",
						realtime_end: "2025-09-05",
						date: "2025-06-01",
						value: "4.1",
					},
				],
			},
			PAYEMS: {
				description: "Total Nonfarm Payrolls",
				latest_value: "159540",
				latest_date: "2025-08-01",
			},
		},
		Inflation: {
			CPIAUCSL: {
				description: "Consumer Price Index",
				latest_value: "322.132",
				latest_date: "2025-07-01",
				recent_observations: [
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-07-01",
						value: "322.132",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-06-01",
						value: "321.500",
					},
					{
						realtime_start: "2025-08-21",
						realtime_end: "2025-08-21",
						date: "2025-05-01",
						value: "320.580",
					},
				],
			},
		},
		Interest_Rates: {
			FEDFUNDS: {
				description: "Federal Funds Rate",
				latest_value: "4.33",
				latest_date: "2025-08-01",
				recent_observations: [
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-08-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-07-01",
						value: "4.33",
					},
					{
						realtime_start: "2025-09-06",
						realtime_end: "2025-09-06",
						date: "2025-06-01",
						value: "4.33",
					},
				],
			},
		},
		Economic_Growth: {
			GDP: {
				description: "Gross Domestic Product",
				latest_value: "30353.902",
				latest_date: "2025-04-01",
			},
		},
		Housing: {
			HOUST: {
				description: "Housing Starts",
				latest_value: "1428.0",
				latest_date: "2025-07-01",
			},
		},
		International: {
			DEXUSEU: {
				description: "US/Euro Exchange Rate",
				latest_value: "1.1695",
				latest_date: "2025-08-29",
			},
		},
	};

	const dashboardData = (fredData?.sample_data as EconomicDashboardData) || sampleDashboardData;

	useEffect(() => {
		// Simulate data loading
		const timer = setTimeout(() => {
			setIsLoading(false);
			announceToScreenReader("Economic data visualization loaded successfully");
		}, 1000);

		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		// Announce view changes
		if (announcement) {
			announceToScreenReader(announcement);
			setAnnouncement("");
		}
	}, [announcement]);

	const handleViewChange = (newView: "dashboard" | "comparison" | "overview") => {
		setActiveView(newView);
		setAnnouncement(`Switched to ${newView} view`);

		// Focus management
		if (containerRef.current) {
			const firstFocusable = containerRef.current.querySelector(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			) as HTMLElement;
			if (firstFocusable) {
				focusManagerRef.current.moveFocus(firstFocusable);
			}
		}
	};

	const handleKeyboardNavigation = (event: React.KeyboardEvent) => {
		if (event.key === "Escape") {
			// Reset to default view
			handleViewChange("dashboard");
		} else if (event.key === "1") {
			handleViewChange("dashboard");
		} else if (event.key === "2") {
			handleViewChange("comparison");
		} else if (event.key === "3") {
			handleViewChange("overview");
		}
	};

	const prepareComparisonData = () => {
		const series = [];

		// Employment data
		const unemploymentData = convertToChartData(dashboardData.Employment.UNRATE);
		if (unemploymentData.length > 0) {
			series.push({
				name: "Unemployment Rate",
				data: unemploymentData,
				color: "#FF0080",
				yAxis: "left" as const,
			});
		}

		// Interest rates data
		const fedFundsData = convertToChartData(dashboardData.Interest_Rates.FEDFUNDS);
		if (fedFundsData.length > 0) {
			series.push({
				name: "Federal Funds Rate",
				data: fedFundsData,
				color: "#00FF7F",
				yAxis: "left" as const,
			});
		}

		// Inflation data
		const inflationData = convertToChartData(dashboardData.Inflation.CPIAUCSL);
		if (inflationData.length > 0) {
			series.push({
				name: "Consumer Price Index",
				data: inflationData.map(d => ({ ...d, value: ((d.value - 300) / 300) * 100 })), // Normalize for comparison
				color: "#0080FF",
				yAxis: "right" as const,
			});
		}

		return series;
	};

	const renderLoadingState = () => (
		<div
			className="min-h-screen flex items-center justify-center"
			role="status"
			aria-label="Loading economic data"
		>
			<div className="text-center">
				<div className="cyber-text cyber-text--glow text-3xl font-bold mb-6 animate-text-glow">
					{title}
				</div>
				<div className="cyber-text cyber-text--glow-cyan text-xl mb-8 animate-cyber-pulse">
					Initializing Financial Data Matrix...
				</div>
				<div className="flex justify-center space-x-3 mb-6">
					{[...Array(6)].map((_, i) => (
						<div
							key={i}
							className="w-4 h-4 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-full animate-cyber-pulse"
							style={{ animationDelay: `${i * 0.2}s` }}
						/>
					))}
				</div>
				<div className="cyber-text text-sm opacity-60">
					Establishing secure connection to FRED data streams...
				</div>
			</div>
		</div>
	);

	const renderDashboardView = () => (
		<EconomicDashboard
			data={dashboardData}
			title={title}
			animated={animated && !theme?.reducedMotion}
			showCharts={true}
			layout={isMobile ? "sections" : "grid"}
		/>
	);

	const renderComparisonView = () => {
		const comparisonSeries = prepareComparisonData();

		return (
			<div className="min-h-screen bg-gradient-to-br from-black via-space-blue to-matrix-green p-6">
				<div className="relative z-10 max-w-7xl mx-auto">
					<header className="mb-12 text-center">
						<h1 className="cyber-text cyber-text--glow text-4xl md:text-5xl font-bold mb-4">
							Economic Indicators Comparison
						</h1>
						<p className="cyber-text text-lg opacity-80">
							Multi-metric analysis and trend correlation
						</p>
					</header>

					<div className="grid gap-8">
						<ComparisonChart
							series={comparisonSeries}
							title="Key Economic Indicators Trend Analysis"
							height={isMobile ? 250 : isTablet ? 300 : 400}
							animated={animated && !theme?.reducedMotion}
							chartType="line"
							showLegend={true}
							showGrid={true}
							dualAxis={true}
						/>
					</div>
				</div>
			</div>
		);
	};

	const renderOverviewView = () => {
		const sectors = Object.keys(dashboardData);

		return (
			<div className="min-h-screen bg-gradient-to-br from-black via-space-blue to-matrix-green p-6">
				<div className="relative z-10 max-w-7xl mx-auto">
					<header className="mb-12 text-center">
						<h1 className="cyber-text cyber-text--glow text-4xl md:text-5xl font-bold mb-4">
							Economic Overview Dashboard
						</h1>
						<p className="cyber-text text-lg opacity-80">
							High-level view of all economic indicators
						</p>
					</header>

					<div
						className={`grid gap-6 ${
							isMobile
								? "grid-cols-1"
								: isTablet
									? "grid-cols-2"
									: "grid-cols-3 lg:grid-cols-4"
						}`}
					>
						{sectors.map((sectorName, index) => {
							const sectorData =
								dashboardData[sectorName as keyof EconomicDashboardData];
							const indicators = Object.keys(sectorData);
							const mainIndicator = sectorData[indicators[0]];
							const config = getSectorConfig(sectorName);

							return (
								<MetricCard
									key={sectorName}
									title={sectorName.replace("_", " ")}
									value={mainIndicator.latest_value}
									description={mainIndicator.description}
									glowColor={config.glowColor}
									size={isMobile ? "small" : "medium"}
									animated={animated && !theme?.reducedMotion}
								/>
							);
						})}
					</div>
				</div>
			</div>
		);
	};

	if (isLoading && animated) {
		return renderLoadingState();
	}

	return (
		<div
			ref={containerRef}
			className="economic-data-visualization"
			onKeyDown={handleKeyboardNavigation}
			role="application"
			aria-label={`${title} - Economic data visualization interface`}
			tabIndex={0}
		>
			{/* Navigation */}
			<nav
				className="fixed top-4 right-4 z-50 flex gap-2"
				role="tablist"
				aria-label="Visualization views"
			>
				{[
					{ key: "dashboard", label: "Dashboard", shortcut: "1" },
					{ key: "comparison", label: "Compare", shortcut: "2" },
					{ key: "overview", label: "Overview", shortcut: "3" },
				].map(({ key, label, shortcut }) => (
					<button
						key={key}
						className={`cyber-card cyber-card--cyan px-4 py-2 text-sm transition-all ${
							activeView === key ? "bg-cyan-900/40" : "opacity-70 hover:opacity-100"
						}`}
						onClick={() => handleViewChange(key as any)}
						role="tab"
						aria-selected={activeView === key}
						aria-label={`${label} view (Shortcut: ${shortcut})`}
						title={`Switch to ${label} view (Press ${shortcut})`}
					>
						<span className="cyber-text">{label}</span>
					</button>
				))}
			</nav>

			{/* Accessibility instructions */}
			<div className="sr-only" aria-live="polite">
				Use number keys 1, 2, 3 to switch between views. Press Tab to navigate elements.
				Press Escape to return to dashboard.
			</div>

			{/* Main content */}
			<main role="main">
				{activeView === "dashboard" && renderDashboardView()}
				{activeView === "comparison" && renderComparisonView()}
				{activeView === "overview" && renderOverviewView()}
			</main>

			{/* Skip link for keyboard users */}
			<a
				href="#main-content"
				className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 cyber-card cyber-card--cyan px-4 py-2 z-50"
			>
				Skip to main content
			</a>
		</div>
	);
};

export default EconomicDataVisualization;
