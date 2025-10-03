"use client";

import React from "react";

/**
 * OptionsFeatureMatrix - Visual grid showing feature availability
 * Displays UnicornBay vs Standard features with real-time status
 */

interface OptionsFeature {
	id: string;
	name: string;
	description: string;
	category: "basic" | "advanced" | "premium";
	standardAvailable: boolean;
	unicornbayAvailable: boolean;
	requiredForTrading: boolean;
	performanceImpact: "low" | "medium" | "high";
	dataQuality: "basic" | "enhanced" | "institutional";
}

interface OptionsFeatureMatrixProps {
	featureMatrix?: {
		features: OptionsFeature[];
		lastUpdated: number;
		providersStatus: {
			standard: "online" | "degraded" | "offline";
			unicornbay: "online" | "degraded" | "offline";
		};
	} | null;
}

export default function OptionsFeatureMatrix({ featureMatrix }: OptionsFeatureMatrixProps) {
	// Default feature set when no data is available
	const defaultFeatures: OptionsFeature[] = [
		{
			id: "options_chain",
			name: "Options Chain Data",
			description: "Basic options chain with strikes and expirations",
			category: "basic",
			standardAvailable: true,
			unicornbayAvailable: true,
			requiredForTrading: true,
			performanceImpact: "low",
			dataQuality: "basic",
		},
		{
			id: "put_call_ratio",
			name: "Put/Call Ratios",
			description: "Volume and open interest ratios",
			category: "basic",
			standardAvailable: true,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "low",
			dataQuality: "enhanced",
		},
		{
			id: "implied_volatility",
			name: "Implied Volatility",
			description: "Basic IV calculations and percentiles",
			category: "basic",
			standardAvailable: true,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "medium",
			dataQuality: "enhanced",
		},
		{
			id: "unusual_activity",
			name: "Unusual Activity Detection",
			description: "Large volume and block trade detection",
			category: "advanced",
			standardAvailable: true,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "medium",
			dataQuality: "enhanced",
		},
		{
			id: "options_flow",
			name: "Options Flow Analysis",
			description: "Smart money flow and sentiment analysis",
			category: "advanced",
			standardAvailable: false,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "high",
			dataQuality: "institutional",
		},
		{
			id: "greeks_analysis",
			name: "Advanced Greeks",
			description: "Portfolio Greeks and risk analysis",
			category: "premium",
			standardAvailable: false,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "high",
			dataQuality: "institutional",
		},
		{
			id: "iv_surface",
			name: "IV Surface Analysis",
			description: "Volatility surface and term structure",
			category: "premium",
			standardAvailable: false,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "high",
			dataQuality: "institutional",
		},
		{
			id: "risk_metrics",
			name: "Risk Metrics",
			description: "Pin risk, gamma squeeze, volatility risk",
			category: "premium",
			standardAvailable: false,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "medium",
			dataQuality: "institutional",
		},
		{
			id: "real_time_updates",
			name: "Real-time Updates",
			description: "Live options data streaming",
			category: "premium",
			standardAvailable: false,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "high",
			dataQuality: "institutional",
		},
		{
			id: "historical_analysis",
			name: "Historical Analysis",
			description: "Historical volatility and pattern analysis",
			category: "advanced",
			standardAvailable: true,
			unicornbayAvailable: true,
			requiredForTrading: false,
			performanceImpact: "medium",
			dataQuality: "enhanced",
		},
	];

	const features = featureMatrix?.features || defaultFeatures;
	const providersStatus = featureMatrix?.providersStatus || {
		standard: "online" as const,
		unicornbay: "online" as const,
	};

	const getCategoryIcon = (category: string) => {
		switch (category) {
			case "basic":
				return "📊";
			case "advanced":
				return "⚡";
			case "premium":
				return "💎";
			default:
				return "📋";
		}
	};

	const getCategoryColor = (category: string) => {
		switch (category) {
			case "basic":
				return "rgba(34, 197, 94, 0.8)";
			case "advanced":
				return "rgba(251, 191, 36, 0.8)";
			case "premium":
				return "rgba(168, 85, 247, 0.8)";
			default:
				return "rgba(99, 102, 241, 0.8)";
		}
	};

	const getDataQualityIcon = (quality: string) => {
		switch (quality) {
			case "basic":
				return "🔵";
			case "enhanced":
				return "🟡";
			case "institutional":
				return "🟢";
			default:
				return "⚪";
		}
	};

	const getPerformanceIcon = (impact: string) => {
		switch (impact) {
			case "low":
				return "🟢";
			case "medium":
				return "🟡";
			case "high":
				return "🔴";
			default:
				return "⚪";
		}
	};

	const getProviderStatusIcon = (status: string) => {
		switch (status) {
			case "online":
				return "🟢";
			case "degraded":
				return "🟡";
			case "offline":
				return "🔴";
			default:
				return "⚫";
		}
	};

	// Group features by category
	const featuresByCategory = features.reduce(
		(acc, feature) => {
			if (!acc[feature.category]) {
				acc[feature.category] = [];
			}
			acc[feature.category].push(feature);
			return acc;
		},
		{} as Record<string, OptionsFeature[]>
	);

	return (
		<div>
			<h3
				style={{
					fontSize: "1.2rem",
					fontWeight: "600",
					color: "white",
					marginBottom: "1rem",
					display: "flex",
					alignItems: "center",
					gap: "0.5rem",
				}}
			>
				🎯 Feature Availability Matrix
			</h3>

			{/* Provider Status Overview */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "1rem",
					marginBottom: "1.5rem",
				}}
			>
				<div
					style={{
						padding: "1rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "8px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "0.9rem",
							fontWeight: "600",
							color: "white",
							marginBottom: "0.5rem",
						}}
					>
						{getProviderStatusIcon(providersStatus.standard)} 📈 Standard Options
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							color: "rgba(255, 255, 255, 0.7)",
						}}
					>
						Basic options analysis with core features
					</div>
				</div>

				<div
					style={{
						padding: "1rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "8px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "0.9rem",
							fontWeight: "600",
							color: "white",
							marginBottom: "0.5rem",
						}}
					>
						{getProviderStatusIcon(providersStatus.unicornbay)} 🦄 UnicornBay Enhanced
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							color: "rgba(255, 255, 255, 0.7)",
						}}
					>
						Institutional-grade options intelligence
					</div>
				</div>
			</div>

			{/* Feature Categories */}
			<div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
				{Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
					<div key={category}>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								marginBottom: "1rem",
								fontSize: "1rem",
								fontWeight: "600",
								color: getCategoryColor(category),
							}}
						>
							{getCategoryIcon(category)} {category.toUpperCase()} FEATURES
							<div
								style={{
									marginLeft: "auto",
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.6)",
								}}
							>
								{categoryFeatures.length} features
							</div>
						</div>

						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
								gap: "1rem",
							}}
						>
							{categoryFeatures.map(feature => (
								<div
									key={feature.id}
									style={{
										padding: "1.25rem",
										background: "rgba(255, 255, 255, 0.05)",
										borderRadius: "10px",
										border: "1px solid rgba(255, 255, 255, 0.1)",
										transition: "all 0.3s ease",
									}}
									onMouseEnter={e => {
										e.currentTarget.style.background =
											"rgba(255, 255, 255, 0.08)";
										e.currentTarget.style.borderColor =
											"rgba(255, 255, 255, 0.2)";
									}}
									onMouseLeave={e => {
										e.currentTarget.style.background =
											"rgba(255, 255, 255, 0.05)";
										e.currentTarget.style.borderColor =
											"rgba(255, 255, 255, 0.1)";
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											marginBottom: "0.75rem",
										}}
									>
										<div
											style={{
												fontSize: "0.95rem",
												fontWeight: "600",
												color: "white",
											}}
										>
											{feature.name}
										</div>
										{feature.requiredForTrading && (
											<div
												style={{
													fontSize: "0.7rem",
													background: "rgba(239, 68, 68, 0.2)",
													color: "rgba(239, 68, 68, 0.9)",
													padding: "0.25rem 0.5rem",
													borderRadius: "12px",
													fontWeight: "600",
												}}
											>
												REQUIRED
											</div>
										)}
									</div>

									<div
										style={{
											fontSize: "0.8rem",
											color: "rgba(255, 255, 255, 0.7)",
											marginBottom: "1rem",
											lineHeight: "1.4",
										}}
									>
										{feature.description}
									</div>

									{/* Provider Availability */}
									<div
										style={{
											display: "grid",
											gridTemplateColumns: "1fr 1fr",
											gap: "0.5rem",
											marginBottom: "1rem",
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												padding: "0.5rem",
												background: feature.standardAvailable
													? "rgba(34, 197, 94, 0.1)"
													: "rgba(100, 100, 100, 0.1)",
												borderRadius: "6px",
												fontSize: "0.8rem",
												color: feature.standardAvailable
													? "rgba(34, 197, 94, 0.9)"
													: "rgba(255, 255, 255, 0.5)",
											}}
										>
											📈{" "}
											{feature.standardAvailable
												? "✅ Available"
												: "❌ Not Available"}
										</div>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "0.5rem",
												padding: "0.5rem",
												background: feature.unicornbayAvailable
													? "rgba(168, 85, 247, 0.1)"
													: "rgba(100, 100, 100, 0.1)",
												borderRadius: "6px",
												fontSize: "0.8rem",
												color: feature.unicornbayAvailable
													? "rgba(168, 85, 247, 0.9)"
													: "rgba(255, 255, 255, 0.5)",
											}}
										>
											🦄{" "}
											{feature.unicornbayAvailable
												? "✅ Enhanced"
												: "❌ Not Available"}
										</div>
									</div>

									{/* Feature Metrics */}
									<div
										style={{
											display: "grid",
											gridTemplateColumns: "repeat(3, 1fr)",
											gap: "0.5rem",
											fontSize: "0.75rem",
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "0.25rem",
												color: "rgba(255, 255, 255, 0.7)",
											}}
										>
											{getDataQualityIcon(feature.dataQuality)}{" "}
											{feature.dataQuality}
										</div>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "0.25rem",
												color: "rgba(255, 255, 255, 0.7)",
											}}
										>
											{getPerformanceIcon(feature.performanceImpact)}{" "}
											{feature.performanceImpact}
										</div>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "0.25rem",
												color: getCategoryColor(feature.category),
											}}
										>
											{getCategoryIcon(feature.category)} {feature.category}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>
				))}
			</div>

			{/* Legend */}
			<div
				style={{
					marginTop: "2rem",
					padding: "1rem",
					background: "rgba(255, 255, 255, 0.05)",
					borderRadius: "8px",
					border: "1px solid rgba(255, 255, 255, 0.1)",
				}}
			>
				<div
					style={{
						fontSize: "0.9rem",
						fontWeight: "600",
						color: "white",
						marginBottom: "0.75rem",
					}}
				>
					Legend
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
						gap: "1rem",
						fontSize: "0.75rem",
						color: "rgba(255, 255, 255, 0.7)",
					}}
				>
					<div>
						<div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
							Data Quality:
						</div>
						<div>🔵 Basic • 🟡 Enhanced • 🟢 Institutional</div>
					</div>
					<div>
						<div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
							Performance Impact:
						</div>
						<div>🟢 Low • 🟡 Medium • 🔴 High</div>
					</div>
					<div>
						<div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
							Provider Status:
						</div>
						<div>🟢 Online • 🟡 Degraded • 🔴 Offline</div>
					</div>
					<div>
						<div style={{ fontWeight: "600", marginBottom: "0.25rem" }}>
							Categories:
						</div>
						<div>📊 Basic • ⚡ Advanced • 💎 Premium</div>
					</div>
				</div>
			</div>

			{featureMatrix?.lastUpdated && (
				<div
					style={{
						marginTop: "1rem",
						textAlign: "center",
						fontSize: "0.75rem",
						color: "rgba(255, 255, 255, 0.6)",
					}}
				>
					Last updated: {new Date(featureMatrix.lastUpdated).toLocaleString()}
				</div>
			)}
		</div>
	);
}
