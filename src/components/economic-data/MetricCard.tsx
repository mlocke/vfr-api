import React from "react";
import { MetricCardProps } from "../../types/economic-data";
import { formatValue, formatPercentage } from "../../utils/data-formatters";
import "../../styles/cyberpunk.css";

const MetricCard: React.FC<MetricCardProps> = ({
	title,
	value,
	change,
	trend,
	unit,
	description,
	animated = true,
	glowColor = "cyan",
	size = "medium",
}) => {
	const formatDisplayValue = (val: string | number): string => {
		if (typeof val === "string") {
			// Check if it's already formatted (contains %, $, etc.)
			if (val.includes("%") || val.includes("$") || val.includes("T") || val.includes("B")) {
				return val;
			}

			// Check if it looks like a percentage (common economic indicators)
			const numVal = parseFloat(val);
			if (
				!isNaN(numVal) &&
				(title.toLowerCase().includes("rate") ||
					title.toLowerCase().includes("unemployment") ||
					title.toLowerCase().includes("inflation"))
			) {
				return formatPercentage(numVal);
			}
		}

		return unit ? `${formatValue(val)}${unit}` : formatValue(val);
	};

	const getTrendIcon = (trendDirection?: string) => {
		switch (trendDirection) {
			case "Rising":
				return "↗";
			case "Falling":
				return "↘";
			default:
				return "→";
		}
	};

	const getTrendClass = (trendDirection?: string) => {
		switch (trendDirection) {
			case "Rising":
				return "trend-indicator--rising";
			case "Falling":
				return "trend-indicator--falling";
			default:
				return "trend-indicator--stable";
		}
	};

	const cardClasses = [
		"cyber-card",
		`cyber-card--${glowColor}`,
		`metric-card`,
		`metric-card--${size}`,
		animated ? "animate-cyber-fadein" : "",
		animated ? "animate-scan-line" : "",
	]
		.filter(Boolean)
		.join(" ");

	const valueClasses = [
		"cyber-text",
		"cyber-text--data",
		`cyber-text--glow-${glowColor}`,
		`metric-value`,
		`metric-value--${size}`,
		animated ? "animate-text-glow" : "",
	]
		.filter(Boolean)
		.join(" ");

	return (
		<div
			className={cardClasses}
			role="img"
			aria-label={`${title}: ${formatDisplayValue(value)}`}
		>
			<div className="metric-card-content">
				<h3 className="cyber-text text-sm font-semibold mb-2 opacity-80">{title}</h3>

				<div className={valueClasses}>{formatDisplayValue(value)}</div>

				{trend && (
					<div className={`trend-indicator ${getTrendClass(trend)} mt-2`}>
						<span className="trend-icon">{getTrendIcon(trend)}</span>
						<span className="trend-text">{trend}</span>
						{change !== undefined && (
							<span className="trend-change ml-1">
								({change > 0 ? "+" : ""}
								{change.toFixed(2)}%)
							</span>
						)}
					</div>
				)}

				{description && (
					<p className="cyber-text text-xs opacity-60 mt-2 leading-tight">
						{description}
					</p>
				)}
			</div>

			{/* Scanning beam effect */}
			{animated && <div className="scanning-beam absolute inset-0 pointer-events-none" />}
		</div>
	);
};

export default MetricCard;
