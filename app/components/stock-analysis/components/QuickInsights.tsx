"use client";

import React from "react";
import { DialogStockData } from "../types/dialog-types";
import { formatMarketCap } from "../utils/formatters";

interface Insight {
	id: string;
	title: string;
	status: "positive" | "negative" | "neutral";
	expandable: boolean;
	icon: string;
	details?: string[];
	category: string;
}

interface QuickInsightsProps {
	stockData: DialogStockData;
	expandedInsights: Set<string>;
	onToggle: (insightId: string) => void;
}

// Generate insights from stock data
const generateInsights = (stockData: DialogStockData): Insight[] => {
	const insights: Insight[] = [];

	// Why This Recommendation - Always first
	insights.push({
		id: "recommendation-reason",
		title: "Why This Recommendation",
		status: "neutral",
		expandable: true,
		icon: "💡",
		category: "Analysis",
		details:
			stockData.reasoning.primaryFactors.length > 0
				? stockData.reasoning.primaryFactors
				: [
						"Comprehensive multi-factor analysis",
						"Market data integration",
						"Risk-adjusted scoring",
					],
	});

	// Technical Analysis Insights
	if (stockData.score.technical > 0.7) {
		insights.push({
			id: "technical-positive",
			title: "Strong Technical Signals",
			status: "positive",
			expandable: true,
			icon: "📈",
			category: "Technical",
			details: [
				"Trading above key moving averages",
				"Positive momentum indicators",
				"Healthy volume patterns",
				"Breaking through resistance levels",
			],
		});
	} else if (stockData.score.technical < 0.4) {
		insights.push({
			id: "technical-negative",
			title: "Technical Concerns",
			status: "negative",
			expandable: true,
			icon: "📉",
			category: "Technical",
			details: [
				"Trading below key support levels",
				"Negative momentum trends",
				"Declining volume patterns",
				"Technical indicators showing weakness",
			],
		});
	}

	// Fundamental Insights
	if (stockData.score.fundamental > 0.6) {
		insights.push({
			id: "fundamental-strong",
			title: "Strong Fundamental Profile",
			status: "positive",
			expandable: true,
			icon: "💰",
			category: "Fundamental",
			details: [
				"Solid earnings growth trajectory",
				"Healthy balance sheet metrics",
				"Strong competitive position",
				"Effective management performance",
			],
		});
	} else if (stockData.score.fundamental < 0.4) {
		insights.push({
			id: "fundamental-concerns",
			title: "Fundamental Challenges",
			status: "negative",
			expandable: true,
			icon: "⚠️",
			category: "Fundamental",
			details: [
				"Declining profitability metrics",
				"High debt-to-equity ratio",
				"Market share erosion",
				"Management execution concerns",
			],
		});
	}

	// Sentiment Insights
	if (stockData.score.sentiment > 0.5) {
		insights.push({
			id: "sentiment-positive",
			title: "Positive Market Sentiment",
			status: "positive",
			expandable: true,
			icon: "👍",
			category: "Sentiment",
			details: [
				"Recent analyst upgrades detected",
				"Social media sentiment trending positive",
				"Institutional buying pressure observed",
				"News flow generally supportive",
			],
		});
	} else if (stockData.score.sentiment < 0.3) {
		insights.push({
			id: "sentiment-negative",
			title: "Negative Sentiment Headwinds",
			status: "negative",
			expandable: true,
			icon: "👎",
			category: "Sentiment",
			details: [
				"Recent analyst downgrades",
				"Negative social media buzz",
				"Institutional selling pressure",
				"Concerning news developments",
			],
		});
	}

	// Market Conditions
	if (stockData.context.marketCap > 100e9) {
		insights.push({
			id: "large-cap-stability",
			title: "Large-Cap Stability",
			status: "positive",
			expandable: false,
			icon: "🏛️",
			category: "Market",
		});
	} else if (stockData.context.marketCap < 2e9) {
		insights.push({
			id: "small-cap-volatility",
			title: "Small-Cap Growth Potential",
			status: "neutral",
			expandable: true,
			icon: "🚀",
			category: "Market",
			details: [
				"Higher growth potential",
				"Increased volatility risk",
				"Limited institutional coverage",
				"More sensitive to market conditions",
			],
		});
	}

	// Price Movement
	if (stockData.context.priceChange24h !== undefined) {
		if (stockData.context.priceChange24h > 5) {
			insights.push({
				id: "strong-momentum",
				title: "Strong Recent Momentum",
				status: "positive",
				expandable: false,
				icon: "🔥",
				category: "Price Action",
			});
		} else if (stockData.context.priceChange24h < -5) {
			insights.push({
				id: "recent-weakness",
				title: "Recent Price Weakness",
				status: "negative",
				expandable: true,
				icon: "📉",
				category: "Price Action",
				details: [
					"Significant recent decline",
					"May present buying opportunity",
					"Consider market context",
					"Monitor for support levels",
				],
			});
		}
	}

	// Sector-specific insights
	insights.push({
		id: "sector-context",
		title: `${stockData.context.sector} Sector Outlook`,
		status: "neutral",
		expandable: true,
		icon: "🏭",
		category: "Sector",
		details: [
			`Operating in ${stockData.context.sector} sector`,
			"Sector-specific trends and dynamics",
			"Competitive landscape analysis",
			"Regulatory environment considerations",
		],
	});

	return insights;
};

const StatusIcon: React.FC<{
	status: "positive" | "negative" | "neutral";
	customIcon?: string;
}> = ({ status, customIcon }) => {
	const getStatusStyles = () => {
		const styles = {
			positive: {
				backgroundColor: "rgba(0, 200, 83, 0.9)",
				icon: "✓",
			},
			negative: {
				backgroundColor: "rgba(239, 68, 68, 0.9)",
				icon: "⚠",
			},
			neutral: {
				backgroundColor: "rgba(255, 193, 7, 0.9)",
				icon: "i",
			},
		};
		return styles[status];
	};

	const statusStyles = getStatusStyles();

	return (
		<div
			style={{
				width: "24px",
				height: "24px",
				borderRadius: "50%",
				background: statusStyles.backgroundColor,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				fontSize: "12px",
				fontWeight: "bold",
				color: "white",
				flexShrink: 0,
			}}
			aria-hidden="true"
		>
			{customIcon || statusStyles.icon}
		</div>
	);
};

const InsightCard: React.FC<{
	insight: Insight;
	isExpanded: boolean;
	onToggle: () => void;
	index: number;
}> = ({ insight, isExpanded, onToggle, index }) => {
	const getStatusBorderColor = (status: "positive" | "negative" | "neutral") => {
		const colors = {
			positive: "rgba(0, 200, 83, 0.5)",
			negative: "rgba(239, 68, 68, 0.5)",
			neutral: "rgba(255, 193, 7, 0.5)",
		};
		return colors[status];
	};

	return (
		<div
			style={{
				background: "rgba(255, 255, 255, 0.05)",
				border: `1px solid ${getStatusBorderColor(insight.status)}`,
				borderRadius: "12px",
				overflow: "hidden",
				transition: "all 0.2s ease",
				opacity: 0,
				animation: `fadeInUp 0.4s ease-out ${0.1 + index * 0.05}s forwards`,
				marginBottom: "0.75rem",
			}}
		>
			{/* Insight Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "0.75rem",
					padding: "1rem",
					cursor: insight.expandable ? "pointer" : "default",
					transition: "background-color 0.2s ease",
				}}
				onClick={() => insight.expandable && onToggle()}
				onKeyDown={e => {
					if (insight.expandable && (e.key === "Enter" || e.key === " ")) {
						e.preventDefault();
						onToggle();
					}
				}}
				role={insight.expandable ? "button" : undefined}
				tabIndex={insight.expandable ? 0 : undefined}
				aria-expanded={insight.expandable ? isExpanded : undefined}
				aria-controls={insight.expandable ? `insight-details-${insight.id}` : undefined}
				onMouseEnter={e => {
					if (insight.expandable) {
						e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
					}
				}}
				onMouseLeave={e => {
					e.currentTarget.style.backgroundColor = "transparent";
				}}
			>
				{/* Status Icon */}
				<StatusIcon status={insight.status} customIcon={insight.icon} />

				{/* Title and Category */}
				<div style={{ flex: 1 }}>
					<div
						style={{
							fontSize: "0.95rem",
							fontWeight: "500",
							color: "white",
							marginBottom: "0.25rem",
						}}
					>
						{insight.title}
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							color: "rgba(255, 255, 255, 0.5)",
							fontWeight: "400",
						}}
					>
						{insight.category}
					</div>
				</div>

				{/* Expand Icon */}
				{insight.expandable && (
					<div
						style={{
							fontSize: "0.875rem",
							color: "rgba(255, 255, 255, 0.6)",
							transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
							transition: "transform 0.2s ease",
						}}
						aria-hidden="true"
					>
						▼
					</div>
				)}
			</div>

			{/* Expandable Details */}
			{insight.expandable && isExpanded && insight.details && (
				<div
					id={`insight-details-${insight.id}`}
					style={{
						padding: "0 1rem 1rem 1rem",
						borderTop: `1px solid ${getStatusBorderColor(insight.status)}`,
						animation: "expandIn 0.2s ease-out",
					}}
				>
					<ul
						style={{
							margin: 0,
							paddingLeft: "1.5rem",
							fontSize: "0.875rem",
							color: "rgba(255, 255, 255, 0.8)",
							lineHeight: "1.5",
						}}
					>
						{insight.details.map((detail, index) => (
							<li
								key={index}
								style={{
									marginBottom: "0.5rem",
									listStyleType: "disc",
								}}
							>
								{detail}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};

const QuickInsights: React.FC<QuickInsightsProps> = ({ stockData, expandedInsights, onToggle }) => {
	const insights = generateInsights(stockData);

	return (
		<>
			<style jsx>{`
				@keyframes fadeInUp {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				@keyframes expandIn {
					from {
						opacity: 0;
						transform: translateY(-10px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				.insights-container {
					margin-bottom: 2rem;
				}

				.insights-header {
					font-size: 1.25rem;
					font-weight: 600;
					color: white;
					margin-bottom: 1rem;
					text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
					display: flex;
					align-items: center;
					gap: 0.5rem;
				}

				.insights-grid {
					display: flex;
					flex-direction: column;
				}

				/* Responsive adjustments */
				@media (max-width: 480px) {
					.insights-header {
						font-size: 1.1rem;
					}

					.insight-card {
						padding: 0.75rem;
					}
				}
			`}</style>

			<section className="insights-container" aria-labelledby="insights-heading">
				<h3 className="insights-header" id="insights-heading">
					<span style={{ fontSize: "1.1rem" }}>🔍</span>
					Quick Insights
				</h3>

				<div className="insights-grid" role="list" aria-label="Stock analysis insights">
					{insights.map((insight, index) => (
						<div key={insight.id} role="listitem">
							<InsightCard
								insight={insight}
								isExpanded={expandedInsights.has(insight.id)}
								onToggle={() => onToggle(insight.id)}
								index={index}
							/>
						</div>
					))}
				</div>

				{/* Summary Stats */}
				<div
					style={{
						marginTop: "1.5rem",
						padding: "1rem",
						background: "rgba(255, 255, 255, 0.03)",
						borderRadius: "8px",
						border: "1px solid rgba(255, 255, 255, 0.05)",
					}}
				>
					<div
						style={{
							fontSize: "0.85rem",
							color: "rgba(255, 255, 255, 0.6)",
							textAlign: "center",
						}}
					>
						{insights.filter(i => i.status === "positive").length} Positive •{" "}
						{insights.filter(i => i.status === "negative").length} Concerns •{" "}
						{insights.filter(i => i.status === "neutral").length} Neutral
					</div>
				</div>
			</section>
		</>
	);
};

export { QuickInsights };
export default QuickInsights;
