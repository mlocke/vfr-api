import React, { useState, useEffect } from "react";
import MetricCard from "./MetricCard";
import TrendChart from "./TrendChart";
import {
	EconomicDashboardData,
	EconomicIndicator,
	ChartDataPoint,
} from "../../types/economic-data";
import {
	convertToChartData,
	calculateTrend,
	getGlowColor,
	getSectorConfig,
	generateStaggeredDelay,
} from "../../utils/data-formatters";
import "../../styles/cyberpunk.css";

interface EconomicDashboardProps {
	data: EconomicDashboardData;
	title?: string;
	animated?: boolean;
	showCharts?: boolean;
	layout?: "grid" | "sections";
}

const EconomicDashboard: React.FC<EconomicDashboardProps> = ({
	data,
	title = "Economic Data Command Center",
	animated = true,
	showCharts = true,
	layout = "sections",
}) => {
	const [selectedSector, setSelectedSector] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Simulate data loading
		const timer = setTimeout(() => setIsLoading(false), 1000);
		return () => clearTimeout(timer);
	}, []);

	const sectors = Object.keys(data);

	const renderSectorCard = (sectorName: string, sectorData: any, index: number) => {
		const config = getSectorConfig(sectorName);
		const indicators = Object.keys(sectorData);
		const mainIndicator = sectorData[indicators[0]] as EconomicIndicator;

		const chartData = convertToChartData(mainIndicator);
		const trend = calculateTrend(chartData);
		const glowColor = getGlowColor(trend.direction, "neutral");

		return (
			<div
				key={sectorName}
				className={`cyber-card cyber-card--${config.glowColor} p-6 cursor-pointer transition-all duration-300 ${
					selectedSector === sectorName ? "scale-105" : ""
				}`}
				onClick={() => setSelectedSector(selectedSector === sectorName ? null : sectorName)}
				style={{
					animationDelay: animated ? `${generateStaggeredDelay(index)}s` : "0s",
				}}
				role="button"
				tabIndex={0}
				aria-label={`${sectorName} sector details`}
				onKeyDown={e => {
					if (e.key === "Enter" || e.key === " ") {
						setSelectedSector(selectedSector === sectorName ? null : sectorName);
					}
				}}
			>
				<div className="sector-header flex items-center gap-4 mb-4">
					<div className="sector-icon text-3xl animate-cyber-pulse">{config.icon}</div>
					<div className="sector-info flex-1">
						<h2
							className={`cyber-text cyber-text--glow-${config.glowColor} text-xl font-bold`}
						>
							{sectorName.replace("_", " ")}
						</h2>
						<p className="cyber-text text-sm opacity-70">
							{indicators.length} indicators • Updated {mainIndicator.latest_date}
						</p>
					</div>
					<div className="expand-indicator">
						<span
							className={`cyber-text--glow-${config.glowColor} text-lg transition-transform duration-300 ${
								selectedSector === sectorName ? "rotate-180" : ""
							}`}
						>
							↓
						</span>
					</div>
				</div>

				{/* Main metric preview */}
				<div className="sector-preview">
					<MetricCard
						title={mainIndicator.description}
						value={mainIndicator.latest_value}
						trend={trend.direction}
						change={trend.changePercent}
						glowColor={config.glowColor}
						size="small"
						animated={animated}
					/>
				</div>

				{/* Expanded view */}
				{selectedSector === sectorName && (
					<div className="sector-expanded mt-6 animate-cyber-fadein">
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
							{indicators.map((indicatorKey, idx) => {
								const indicator = sectorData[indicatorKey] as EconomicIndicator;
								const indicatorChartData = convertToChartData(indicator);
								const indicatorTrend = calculateTrend(indicatorChartData);

								return (
									<MetricCard
										key={indicatorKey}
										title={indicator.description}
										value={indicator.latest_value}
										trend={indicatorTrend.direction}
										change={indicatorTrend.changePercent}
										description={`Updated ${indicator.latest_date}`}
										glowColor={getGlowColor(
											indicatorTrend.direction,
											"neutral"
										)}
										size="small"
										animated={animated}
									/>
								);
							})}
						</div>

						{/* Chart for main indicator */}
						{showCharts && chartData.length > 0 && (
							<div className="sector-chart mt-6">
								<TrendChart
									data={chartData}
									title={`${mainIndicator.description} Trend`}
									color={
										config.glowColor === "cyan"
											? "#00FFFF"
											: config.glowColor === "green"
												? "#00FF7F"
												: config.glowColor === "pink"
													? "#FF00FF"
													: config.glowColor === "blue"
														? "#0080FF"
														: config.glowColor === "yellow"
															? "#FFFF00"
															: "#FF0080"
									}
									height={200}
									animated={animated}
									showGrid={true}
									showTooltip={true}
								/>
							</div>
						)}
					</div>
				)}
			</div>
		);
	};

	const renderGridLayout = () => (
		<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{sectors.map((sectorName, index) =>
				renderSectorCard(sectorName, data[sectorName as keyof EconomicDashboardData], index)
			)}
		</div>
	);

	const renderSectionsLayout = () => (
		<div className="space-y-8">
			{sectors.map((sectorName, index) =>
				renderSectorCard(sectorName, data[sectorName as keyof EconomicDashboardData], index)
			)}
		</div>
	);

	if (isLoading && animated) {
		return (
			<div className="economic-dashboard min-h-screen flex items-center justify-center">
				<div className="text-center">
					<div className="cyber-text cyber-text--glow text-2xl font-bold mb-4 animate-text-glow">
						Initializing Economic Analysis System
					</div>
					<div className="flex justify-center space-x-2 mb-4">
						{[...Array(5)].map((_, i) => (
							<div
								key={i}
								className="w-3 h-3 bg-cyan-400 rounded-full animate-cyber-pulse"
								style={{ animationDelay: `${i * 0.2}s` }}
							/>
						))}
					</div>
					<div className="cyber-text text-sm opacity-60">
						Connecting to FRED data streams...
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="economic-dashboard min-h-screen bg-gradient-to-br from-black via-space-blue to-matrix-green p-6">
			{/* Background effects */}
			<div className="fixed inset-0 pointer-events-none">
				<div className="absolute top-1/4 left-1/4 w-96 h-96 bg-cyan-500 rounded-full blur-3xl opacity-5 animate-cyber-pulse" />
				<div
					className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500 rounded-full blur-3xl opacity-5 animate-cyber-pulse"
					style={{ animationDelay: "1s" }}
				/>
				<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-1 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-20 animate-scan-line" />
			</div>

			<div className="relative z-10 max-w-7xl mx-auto">
				{/* Header */}
				<header className="mb-12 text-center">
					<h1 className="cyber-text cyber-text--glow text-4xl md:text-5xl font-bold mb-4 animate-cyber-fadein">
						{title}
					</h1>
					<div className="cyber-text text-lg opacity-80 mb-6">
						Real-time Federal Reserve Economic Data • AI-Powered Analysis
					</div>

					{/* Status indicators */}
					<div className="flex justify-center items-center gap-8 mb-8">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-green-400 rounded-full animate-cyber-pulse" />
							<span className="cyber-text text-sm">FRED API Connected</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-cyan-400 rounded-full animate-cyber-pulse" />
							<span className="cyber-text text-sm">Data Stream Active</span>
						</div>
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 bg-pink-400 rounded-full animate-cyber-pulse" />
							<span className="cyber-text text-sm">Analysis Engine Online</span>
						</div>
					</div>

					{/* Layout toggle */}
					<div className="layout-controls flex justify-center gap-2">
						<button
							className={`cyber-card cyber-card--cyan px-4 py-2 text-sm transition-all ${
								layout === "grid" ? "bg-cyan-900/30" : ""
							}`}
							onClick={() => setSelectedSector(null)}
							aria-label="Switch to grid layout"
						>
							<span className="cyber-text">Grid View</span>
						</button>
						<button
							className={`cyber-card cyber-card--cyan px-4 py-2 text-sm transition-all ${
								layout === "sections" ? "bg-cyan-900/30" : ""
							}`}
							onClick={() => setSelectedSector(null)}
							aria-label="Switch to sections layout"
						>
							<span className="cyber-text">Sections View</span>
						</button>
					</div>
				</header>

				{/* Dashboard content */}
				<main className="dashboard-content">
					{layout === "grid" ? renderGridLayout() : renderSectionsLayout()}
				</main>

				{/* Footer */}
				<footer className="mt-16 text-center">
					<div className="cyber-card cyber-card--cyan p-4 inline-block">
						<p className="cyber-text text-sm opacity-60">
							Data provided by Federal Reserve Economic Data (FRED) • Last updated:{" "}
							{new Date().toLocaleString()}
						</p>
					</div>
				</footer>
			</div>
		</div>
	);
};

export default EconomicDashboard;
