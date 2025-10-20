"use client";

import { useState } from "react";
import { formatMarketCap } from "./stock-analysis/utils/formatters";
import {
	getESDRecommendationStrength,
	getCombinedRecommendation,
} from "../services/utils/RecommendationUtils";
import ScoreBreakdown from "./ScoreBreakdown";

interface StockRecommendationCardProps {
	stock: {
		symbol: string;
		price?: number;
		priceChange?: number;
		priceChangePercent?: number;
		recommendation?: string;
		confidence?: number;
		compositeScore?: number;
		sector?: string;
		marketCap?: string;
		technicalScore?: number;
		fundamentalScore?: number;
		macroScore?: number;
		sentimentScore?: number;
		esgScore?: number;
		analystScore?: number;
		insights?: {
			positive?: string[];
			risks?: string[];
		};
		reasoning?:
			| string
			| {
					primaryFactors?: string[];
					warnings?: string[];
					opportunities?: string[];
					optionsAnalysis?: any;
			  };
		early_signal?: {
			upgrade_likely: boolean;
			downgrade_likely: boolean;
			confidence: number;
			horizon: "2_weeks";
			reasoning: string[];
			feature_importance: Record<string, number>;
			prediction_timestamp: number;
			model_version: string;
		};
		mlPrediction?: {
			symbol: string;
			modelId: string;
			modelType: string;
			horizon: string;
			prediction: number;
			confidence: number;
			direction: "UP" | "DOWN" | "NEUTRAL";
			probability?: {
				up: number;
				down: number;
				neutral: number;
			};
			latencyMs: number;
			fromCache: boolean;
			timestamp: number;
		};
		sentiment_fusion?: {
			direction: "UP" | "NEUTRAL" | "DOWN";
			confidence: number;
			probabilities: {
				UP: number;
				NEUTRAL: number;
				DOWN: number;
			};
			horizon: "3_days";
			reasoning: string[];
			model_version: string;
			prediction_timestamp: number;
		};
		mlEnsemblePrediction?: {
			prediction: "UP" | "DOWN" | "NEUTRAL";
			confidence: number;
			votes: Array<{
				model: string;
				modelName: string;
				modelVersion: string;
				modelId: string;
				prediction: string;
				signal: "BULLISH" | "BEARISH" | "NEUTRAL";
				confidence: number;
				weight: number;
			}>;
			reasoning: string[];
		};
		smart_money_flow?: {
			action: "BUY" | "SELL";
			confidence: number;
			probability: number;
			reasoning: string;
			feature_importance: Record<string, number>;
			prediction_timestamp: number;
			model_version: string;
		};
		volatility_prediction?: {
			predicted_volatility: number;
			confidence_level: "low" | "medium" | "high";
			risk_category: "very_low" | "low" | "moderate" | "high" | "extreme";
			prediction_horizon_days: number;
			reasoning: string;
			feature_completeness: number;
			prediction_timestamp: number;
			model_version: string;
		};
	};
}

export default function StockRecommendationCard({ stock }: StockRecommendationCardProps) {
	const [expandedSection, setExpandedSection] = useState<string | null>(null);

	const getRecommendationColor = (rec?: string) => {
		switch (rec?.toUpperCase()) {
			case "BUY":
			case "STRONG BUY":
				return {
					bg: "rgba(34, 197, 94, 0.2)",
					text: "rgba(34, 197, 94, 0.9)",
					border: "rgba(34, 197, 94, 0.5)",
				};
			case "SELL":
			case "STRONG SELL":
				return {
					bg: "rgba(239, 68, 68, 0.2)",
					text: "rgba(239, 68, 68, 0.9)",
					border: "rgba(239, 68, 68, 0.5)",
				};
			default:
				return {
					bg: "rgba(251, 191, 36, 0.2)",
					text: "rgba(251, 191, 36, 0.9)",
					border: "rgba(251, 191, 36, 0.5)",
				};
		}
	};

	const getScoreColor = (score: number) => {
		if (score >= 70) return "rgba(34, 197, 94, 0.9)";
		if (score >= 50) return "rgba(251, 191, 36, 0.9)";
		if (score >= 30) return "rgba(251, 191, 36, 0.7)";
		return "rgba(239, 68, 68, 0.9)";
	};

	const getScoreLabel = (score: number) => {
		if (score >= 70) return "Strong";
		if (score >= 50) return "Moderate";
		if (score >= 30) return "Weak";
		return "Extreme";
	};

	const recColors = getRecommendationColor(stock.recommendation);
	const compositeScore = stock.compositeScore || 0;

	// Helper function to normalize scores to 0-100 scale
	const normalizeScore = (score: number): number => {
		// If score is already in 0-100 range (>1), return as is
		if (score > 1) return score;
		// If score is in 0-1 range (decimal percentage), convert to 0-100
		return score * 100;
	};

	// Calculate score metrics with fallbacks and normalization
	const scoreMetrics = [
		{ label: "Technical", value: normalizeScore(stock.technicalScore || 0), key: "technical" },
		{
			label: "Fundamental",
			value: normalizeScore(stock.fundamentalScore || 0),
			key: "fundamental",
		},
		{ label: "Macro", value: normalizeScore(stock.macroScore || 0), key: "macro" },
		{ label: "Sentiment", value: normalizeScore(stock.sentimentScore || 0), key: "sentiment" },
		{ label: "ESG", value: normalizeScore(stock.esgScore || 0), key: "esg" },
		{ label: "Analyst", value: normalizeScore(stock.analystScore || 0), key: "analyst" },
	];

	const toggleSection = (section: string) => {
		setExpandedSection(expandedSection === section ? null : section);
	};

	// Helper function to format camelCase factor names to display names
	const formatFactorName = (factor: string): string => {
		// Handle common factor names
		const factorMap: Record<string, string> = {
			fundamentalScore: "Fundamental Score",
			technicalScore: "Technical Score",
			macroScore: "Macro Score",
			sentimentScore: "Sentiment Score",
			esgScore: "ESG Score",
			analystScore: "Analyst Score",
			momentum_composite: "Momentum Composite",
			quality_composite: "Quality Composite",
			value_composite: "Value Composite",
			composite: "Composite Score",
		};

		// Return mapped name if exists
		if (factorMap[factor]) {
			return factorMap[factor];
		}

		// Otherwise, convert camelCase to Title Case
		return factor
			.replace(/([A-Z])/g, " $1") // Add space before capital letters
			.replace(/_/g, " ") // Replace underscores with spaces
			.trim()
			.split(" ")
			.map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
			.join(" ");
	};

	return (
		<div
			style={{
				background:
					"linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)",
				border: `2px solid ${recColors.border}`,
				borderRadius: "20px",
				padding: "2rem",
				boxShadow: "0 20px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 200, 83, 0.1)",
				maxWidth: "600px",
				margin: "0 auto",
			}}
		>
			{/* Header Section */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "flex-start",
					marginBottom: "1.5rem",
				}}
			>
				<div>
					<h2
						style={{
							fontSize: "2.5rem",
							fontWeight: "700",
							color: "white",
							margin: 0,
							letterSpacing: "0.5px",
						}}
					>
						{stock.symbol}
					</h2>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							marginTop: "0.25rem",
						}}
					>
						{stock.price && (
							<span
								style={{
									fontSize: "1rem",
									fontWeight: "600",
									color: "rgba(255, 255, 255, 0.9)",
								}}
							>
								${stock.price.toFixed(2)}
							</span>
						)}
						{stock.priceChangePercent !== undefined && (
							<span
								style={{
									background:
										stock.priceChangePercent >= 0
											? "rgba(34, 197, 94, 0.2)"
											: "rgba(239, 68, 68, 0.2)",
									color:
										stock.priceChangePercent >= 0
											? "rgba(34, 197, 94, 0.9)"
											: "rgba(239, 68, 68, 0.9)",
									padding: "0.2rem 0.5rem",
									borderRadius: "6px",
									fontSize: "0.85rem",
									fontWeight: "600",
								}}
							>
								{stock.priceChangePercent >= 0 ? "+" : ""}
								{stock.priceChangePercent.toFixed(2)}%
							</span>
						)}
					</div>
					{stock.sector && (
						<div
							style={{
								fontSize: "0.9rem",
								color: "rgba(255, 255, 255, 0.6)",
								marginTop: "0.25rem",
							}}
						>
							{stock.sector}{" "}
							{stock.marketCap && `| Market Cap: ${formatMarketCap(stock.marketCap)}`}
						</div>
					)}
				</div>

				{/* Recommendation Display */}
				{(() => {
					// Use combined recommendation when ESD exists, otherwise use current recommendation
					const displayRec = stock.early_signal
						? getCombinedRecommendation(
								(stock.recommendation?.toUpperCase() as any) || "HOLD",
								stock.early_signal
							)
						: stock.recommendation?.toUpperCase() || "HOLD";
					const displayColors = getRecommendationColor(displayRec);

					return (
						<div
							style={{
								background: displayColors.bg,
								border: `2px solid ${displayColors.border}`,
								borderRadius: "12px",
								padding: "1rem 1.5rem",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "0.5rem",
								minWidth: "120px",
							}}
						>
							<div
								style={{
									fontSize: "1.5rem",
									fontWeight: "700",
									color: displayColors.text,
									letterSpacing: "0.5px",
								}}
							>
								{displayRec}
							</div>
							{stock.confidence && (
								<div
									style={{
										fontSize: "0.85rem",
										fontWeight: "600",
										color: displayColors.text,
										background: "rgba(0, 0, 0, 0.3)",
										padding: "0.25rem 0.75rem",
										borderRadius: "20px",
									}}
								>
									{stock.confidence}%
								</div>
							)}
						</div>
					);
				})()}
			</div>

			{/* Overall Score Section */}
			<div
				style={{
					background: "rgba(0, 0, 0, 0.3)",
					borderRadius: "12px",
					padding: "1rem",
					marginBottom: "1.5rem",
				}}
			>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "0.75rem",
					}}
				>
					<span
						style={{
							fontSize: "0.9rem",
							fontWeight: "600",
							color: "rgba(255, 255, 255, 0.8)",
							textTransform: "uppercase",
							letterSpacing: "0.5px",
						}}
					>
						Overall Score: {Math.round(compositeScore)}/100
					</span>
					<span
						style={{
							fontSize: "0.85rem",
							color: getScoreColor(compositeScore),
							fontWeight: "600",
						}}
					>
						{getScoreLabel(compositeScore)}
					</span>
				</div>

				{/* Score Bar */}
				<div
					style={{
						background: "rgba(255, 255, 255, 0.1)",
						borderRadius: "20px",
						height: "12px",
						overflow: "hidden",
						marginBottom: "1rem",
					}}
				>
					<div
						style={{
							background: `linear-gradient(90deg, ${getScoreColor(compositeScore)}, rgba(0, 200, 83, 0.6))`,
							height: "100%",
							width: `${compositeScore}%`,
							borderRadius: "20px",
							transition: "width 0.5s ease",
						}}
					/>
				</div>

				{/* Score Metrics Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: "0.75rem",
					}}
				>
					{scoreMetrics.map(metric => (
						<div
							key={metric.key}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "0.25rem",
							}}
						>
							<span
								style={{
									fontSize: "0.75rem",
									color: "rgba(255, 255, 255, 0.6)",
									textTransform: "uppercase",
									letterSpacing: "0.3px",
								}}
							>
								{metric.label}
							</span>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
								}}
							>
								<span
									style={{
										fontSize: "1rem",
										fontWeight: "700",
										color: getScoreColor(metric.value),
									}}
								>
									{Math.round(metric.value)}
								</span>
								<div
									style={{
										width: "50px",
										height: "4px",
										background: "rgba(255, 255, 255, 0.1)",
										borderRadius: "2px",
										overflow: "hidden",
										marginTop: "0.25rem",
									}}
								>
									<div
										style={{
											background: getScoreColor(metric.value),
											height: "100%",
											width: `${metric.value}%`,
											borderRadius: "2px",
										}}
									/>
								</div>
							</div>
							<span
								style={{
									fontSize: "0.65rem",
									color: getScoreColor(metric.value),
									fontWeight: "500",
								}}
							>
								{getScoreLabel(metric.value)}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* ML Price Prediction Section */}
			{stock.mlPrediction && (
				<>
					{/* Show info banner about ensemble consensus */}
					{stock.mlPrediction.confidence < 0.4 && (
						<div
							style={{
								background: "rgba(59, 130, 246, 0.1)",
								border: "1px solid rgba(59, 130, 246, 0.3)",
								borderRadius: "12px",
								padding: "1rem",
								marginTop: "1rem",
								marginBottom: "0.75rem",
								display: "flex",
								alignItems: "flex-start",
								gap: "0.75rem",
							}}
						>
							<span style={{ fontSize: "1.5rem" }}>ℹ️</span>
							<div style={{ flex: 1 }}>
								<div style={{ color: "rgba(59, 130, 246, 0.9)", fontWeight: "600", marginBottom: "0.5rem", fontSize: "0.95rem" }}>
									Ensemble ML Consensus
								</div>
								<div style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", lineHeight: "1.5" }}>
									Current consensus confidence ({(stock.mlPrediction.confidence * 100).toFixed(1)}%) reflects disagreement among the 3 ML models.
									<br />
									<strong style={{ color: "rgba(255,255,255,0.9)" }}>Models voting:</strong> Sentiment-Fusion, Price-Prediction, and Early-Signal-Detection
									<br />
									<span style={{ color: "rgba(59, 130, 246, 0.9)" }}>Lower confidence indicates models don't strongly agree on direction. See individual votes below.</span>
								</div>
							</div>
						</div>
					)}

					<div
						onClick={() => toggleSection("ml_prediction")}
						style={{
							background: stock.mlPrediction.confidence < 0.4
								? "rgba(251, 191, 36, 0.05)"
								: "rgba(139, 92, 246, 0.1)",
							border: stock.mlPrediction.confidence < 0.4
								? "1px solid rgba(251, 191, 36, 0.2)"
								: "1px solid rgba(139, 92, 246, 0.3)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "0.75rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
							<span style={{ fontSize: "1.5rem" }}>
								{stock.mlPrediction.direction === "UP"
									? "📈"
									: stock.mlPrediction.direction === "DOWN"
										? "📉"
										: "➡️"}
							</span>
							<div>
								<span
									style={{
										fontSize: "0.9rem",
										fontWeight: "600",
										color: "rgba(139, 92, 246, 0.9)",
									}}
								>
									ML Price Prediction
								</span>
								<div
									style={{
										fontSize: "0.75rem",
										color: "rgba(255,255,255,0.6)",
										marginTop: "0.25rem",
									}}
								>
									{stock.mlPrediction.direction} trend expected (
									{stock.mlPrediction.horizon})
								</div>
							</div>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.75rem",
							}}
						>
							<div
								style={{
									background:
										stock.mlPrediction.direction === "UP"
											? "rgba(34, 197, 94, 0.2)"
											: stock.mlPrediction.direction === "DOWN"
												? "rgba(239, 68, 68, 0.2)"
												: "rgba(251, 191, 36, 0.2)",
									border: `1px solid ${
										stock.mlPrediction.direction === "UP"
											? "rgba(34, 197, 94, 0.4)"
											: stock.mlPrediction.direction === "DOWN"
												? "rgba(239, 68, 68, 0.4)"
												: "rgba(251, 191, 36, 0.4)"
									}`,
									color:
										stock.mlPrediction.direction === "UP"
											? "rgba(34, 197, 94, 0.9)"
											: stock.mlPrediction.direction === "DOWN"
												? "rgba(239, 68, 68, 0.9)"
												: "rgba(251, 191, 36, 0.9)",
									padding: "0.5rem 1rem",
									borderRadius: "8px",
									fontSize: "1rem",
									fontWeight: "700",
								}}
							>
								{stock.mlPrediction.direction}
							</div>
							<span style={{ fontSize: "1.2rem", color: "rgba(139, 92, 246, 0.6)" }}>
								{expandedSection === "ml_prediction" ? "−" : "+"}
							</span>
						</div>
					</div>

					{expandedSection === "ml_prediction" && (
						<div
							style={{
								background: "rgba(139, 92, 246, 0.05)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "0.75rem",
							}}
						>
							{/* Confidence Display */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(139, 92, 246, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Prediction Confidence
								</h5>
								<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
									<div
										style={{
											flex: 1,
											background: "rgba(255,255,255,0.1)",
											borderRadius: "20px",
											height: "8px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												background:
													"linear-gradient(90deg, rgba(139,92,246,0.8), rgba(168,85,247,0.8))",
												height: "100%",
												width: `${stock.mlPrediction.confidence * 100}%`,
												borderRadius: "20px",
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "1.2rem",
											fontWeight: "700",
											color: "rgba(139,92,246,0.9)",
										}}
									>
										{(stock.mlPrediction.confidence * 100).toFixed(1)}%
									</span>
								</div>
							</div>

							{/* Probability Breakdown */}
							{stock.mlPrediction.probability && (
								<div style={{ marginBottom: "1rem" }}>
									<h5
										style={{
											color: "rgba(139, 92, 246, 0.9)",
											fontSize: "0.85rem",
											margin: "0 0 0.5rem 0",
										}}
									>
										Direction Probabilities
									</h5>
									<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
										{/* UP Probability */}
										<div>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													fontSize: "0.8rem",
													marginBottom: "0.25rem",
												}}
											>
												<span style={{ color: "rgba(34, 197, 94, 0.9)" }}>
													📈 Upward
												</span>
												<span style={{ color: "rgba(255,255,255,0.8)" }}>
													{(stock.mlPrediction.probability.up * 100).toFixed(1)}%
												</span>
											</div>
											<div
												style={{
													background: "rgba(255,255,255,0.1)",
													borderRadius: "4px",
													height: "6px",
													overflow: "hidden",
												}}
											>
												<div
													style={{
														background: "rgba(34, 197, 94, 0.8)",
														height: "100%",
														width: `${stock.mlPrediction.probability.up * 100}%`,
														borderRadius: "4px",
													}}
												/>
											</div>
										</div>

										{/* NEUTRAL Probability */}
										<div>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													fontSize: "0.8rem",
													marginBottom: "0.25rem",
												}}
											>
												<span style={{ color: "rgba(251, 191, 36, 0.9)" }}>
													➡️ Neutral
												</span>
												<span style={{ color: "rgba(255,255,255,0.8)" }}>
													{(stock.mlPrediction.probability.neutral * 100).toFixed(
														1
													)}
													%
												</span>
											</div>
											<div
												style={{
													background: "rgba(255,255,255,0.1)",
													borderRadius: "4px",
													height: "6px",
													overflow: "hidden",
												}}
											>
												<div
													style={{
														background: "rgba(251, 191, 36, 0.8)",
														height: "100%",
														width: `${stock.mlPrediction.probability.neutral * 100}%`,
														borderRadius: "4px",
													}}
												/>
											</div>
										</div>

										{/* DOWN Probability */}
										<div>
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													fontSize: "0.8rem",
													marginBottom: "0.25rem",
												}}
											>
												<span style={{ color: "rgba(239, 68, 68, 0.9)" }}>
													📉 Downward
												</span>
												<span style={{ color: "rgba(255,255,255,0.8)" }}>
													{(stock.mlPrediction.probability.down * 100).toFixed(1)}
													%
												</span>
											</div>
											<div
												style={{
													background: "rgba(255,255,255,0.1)",
													borderRadius: "4px",
													height: "6px",
													overflow: "hidden",
												}}
											>
												<div
													style={{
														background: "rgba(239, 68, 68, 0.8)",
														height: "100%",
														width: `${stock.mlPrediction.probability.down * 100}%`,
														borderRadius: "4px",
													}}
												/>
											</div>
										</div>
									</div>
								</div>
							)}

							{/* Ensemble Model Votes */}
							{stock.mlEnsemblePrediction && stock.mlEnsemblePrediction.votes && (
								<div style={{ marginBottom: "1rem" }}>
									<h5
										style={{
											color: "rgba(139, 92, 246, 0.9)",
											fontSize: "0.85rem",
											margin: "0 0 0.5rem 0",
										}}
									>
										Individual Model Votes
									</h5>
									<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
										{stock.mlEnsemblePrediction.votes.map((vote: {
											model: string;
											modelName: string;
											modelVersion: string;
											modelId: string;
											prediction: string;
											signal: "BULLISH" | "BEARISH" | "NEUTRAL";
											confidence: number;
											weight: number;
										}, idx: number) => (
											<div key={idx} style={{
												display: "flex",
												alignItems: "center",
												justifyContent: "space-between",
												padding: "0.5rem",
												background: "rgba(255,255,255,0.05)",
												borderRadius: "6px",
												borderLeft: `3px solid ${
													vote.signal === "BULLISH" ? "rgba(34, 197, 94, 0.8)" :
													vote.signal === "BEARISH" ? "rgba(239, 68, 68, 0.8)" :
													"rgba(251, 191, 36, 0.8)"
												}`
											}}>
												<div>
													<div style={{ fontSize: "0.8rem", fontWeight: "600", color: "rgba(255,255,255,0.9)" }}>
														{vote.modelName} {vote.modelVersion}
													</div>
													<div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", marginTop: "0.15rem" }}>
														{vote.modelId}
													</div>
												</div>
												<div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
													<span style={{
														fontSize: "0.75rem",
														fontWeight: "700",
														color: vote.signal === "BULLISH" ? "rgba(34, 197, 94, 0.9)" :
															vote.signal === "BEARISH" ? "rgba(239, 68, 68, 0.9)" :
															"rgba(251, 191, 36, 0.9)"
													}}>
														{vote.signal}
													</span>
													<span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>
														{(vote.confidence * 100).toFixed(1)}%
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}

							{/* Prediction Details */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(139, 92, 246, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Prediction Details
								</h5>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr",
										gap: "0.5rem",
										fontSize: "0.8rem",
									}}
								>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Time Horizon:</span>
										<span
											style={{
												color: "rgba(255,255,255,0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											{stock.mlPrediction.horizon.toUpperCase()}
										</span>
									</div>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Model Type:</span>
										<span
											style={{
												color: "rgba(255,255,255,0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											{stock.mlPrediction.modelType}
										</span>
									</div>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Predicted Value:</span>
										<span
											style={{
												color: "rgba(255,255,255,0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											{stock.mlPrediction.prediction.toFixed(4)}
										</span>
									</div>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Data Source:</span>
										<span
											style={{
												color: stock.mlPrediction.fromCache
													? "rgba(251, 191, 36, 0.9)"
													: "rgba(34, 197, 94, 0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											{stock.mlPrediction.fromCache ? "Cached" : "Live"}
										</span>
									</div>
								</div>
							</div>

							{/* Model Metadata Footer */}
							<div
								style={{
									marginTop: "1rem",
									paddingTop: "0.75rem",
									borderTop: "1px solid rgba(255,255,255,0.1)",
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.5)",
									display: "flex",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: "0.5rem",
								}}
							>
								<span>Model: {stock.mlPrediction.modelId}</span>
								<span>
									Predicted: {new Date(stock.mlPrediction.timestamp).toLocaleString()}
								</span>
								{stock.mlPrediction.latencyMs && (
									<span>Latency: {stock.mlPrediction.latencyMs}ms</span>
								)}
							</div>
						</div>
					)}
				</>
			)}

			{/* Sentiment-Fusion Prediction Section */}
			{stock.sentiment_fusion && (
				<>
					<div
						onClick={() => toggleSection("sentiment_fusion")}
						style={{
							background: "rgba(168, 85, 247, 0.1)",
							border: "1px solid rgba(168, 85, 247, 0.3)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "0.75rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
							<span style={{ fontSize: "1.5rem" }}>
								{stock.sentiment_fusion.direction === "UP"
									? "🚀"
									: stock.sentiment_fusion.direction === "DOWN"
										? "⚠️"
										: "⏸️"}
							</span>
							<div>
								<span
									style={{
										fontSize: "0.9rem",
										fontWeight: "600",
										color: "rgba(168, 85, 247, 0.9)",
									}}
								>
									Sentiment-Fusion Prediction
								</span>
								<div
									style={{
										fontSize: "0.75rem",
										color: "rgba(255,255,255,0.6)",
										marginTop: "0.25rem",
									}}
								>
									{stock.sentiment_fusion.direction} movement expected (3-day horizon)
								</div>
							</div>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.75rem",
							}}
						>
							<div
								style={{
									background:
										stock.sentiment_fusion.direction === "UP"
											? "rgba(34, 197, 94, 0.2)"
											: stock.sentiment_fusion.direction === "DOWN"
												? "rgba(239, 68, 68, 0.2)"
												: "rgba(251, 191, 36, 0.2)",
									border: `1px solid ${
										stock.sentiment_fusion.direction === "UP"
											? "rgba(34, 197, 94, 0.4)"
											: stock.sentiment_fusion.direction === "DOWN"
												? "rgba(239, 68, 68, 0.4)"
												: "rgba(251, 191, 36, 0.4)"
									}`,
									color:
										stock.sentiment_fusion.direction === "UP"
											? "rgba(34, 197, 94, 0.9)"
											: stock.sentiment_fusion.direction === "DOWN"
												? "rgba(239, 68, 68, 0.9)"
												: "rgba(251, 191, 36, 0.9)",
									padding: "0.5rem 1rem",
									borderRadius: "8px",
									fontSize: "1rem",
									fontWeight: "700",
								}}
							>
								{stock.sentiment_fusion.direction}
							</div>
							<span style={{ fontSize: "1.2rem", color: "rgba(168, 85, 247, 0.6)" }}>
								{expandedSection === "sentiment_fusion" ? "−" : "+"}
							</span>
						</div>
					</div>

					{expandedSection === "sentiment_fusion" && (
						<div
							style={{
								background: "rgba(168, 85, 247, 0.05)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "0.75rem",
							}}
						>
							{/* Confidence Display */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(168, 85, 247, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Prediction Confidence
								</h5>
								<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
									<div
										style={{
											flex: 1,
											background: "rgba(255,255,255,0.1)",
											borderRadius: "20px",
											height: "8px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												background:
													"linear-gradient(90deg, rgba(168,85,247,0.8), rgba(217,70,239,0.8))",
												height: "100%",
												width: `${stock.sentiment_fusion.confidence * 100}%`,
												borderRadius: "20px",
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "1.2rem",
											fontWeight: "700",
											color: "rgba(168,85,247,0.9)",
										}}
									>
										{(stock.sentiment_fusion.confidence * 100).toFixed(1)}%
									</span>
								</div>
							</div>

							{/* Probability Breakdown */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(168, 85, 247, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Direction Probabilities
								</h5>
								<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
									{/* UP Probability */}
									<div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												fontSize: "0.8rem",
												marginBottom: "0.25rem",
											}}
										>
											<span style={{ color: "rgba(34, 197, 94, 0.9)" }}>
												🚀 Upward
											</span>
											<span style={{ color: "rgba(255,255,255,0.8)" }}>
												{(stock.sentiment_fusion.probabilities.UP * 100).toFixed(1)}%
											</span>
										</div>
										<div
											style={{
												background: "rgba(255,255,255,0.1)",
												borderRadius: "4px",
												height: "6px",
												overflow: "hidden",
											}}
										>
											<div
												style={{
													background: "rgba(34, 197, 94, 0.8)",
													height: "100%",
													width: `${stock.sentiment_fusion.probabilities.UP * 100}%`,
													borderRadius: "4px",
												}}
											/>
										</div>
									</div>

									{/* NEUTRAL Probability */}
									<div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												fontSize: "0.8rem",
												marginBottom: "0.25rem",
											}}
										>
											<span style={{ color: "rgba(251, 191, 36, 0.9)" }}>
												⏸️ Neutral
											</span>
											<span style={{ color: "rgba(255,255,255,0.8)" }}>
												{(stock.sentiment_fusion.probabilities.NEUTRAL * 100).toFixed(
													1
												)}
												%
											</span>
										</div>
										<div
											style={{
												background: "rgba(255,255,255,0.1)",
												borderRadius: "4px",
												height: "6px",
												overflow: "hidden",
											}}
										>
											<div
												style={{
													background: "rgba(251, 191, 36, 0.8)",
													height: "100%",
													width: `${stock.sentiment_fusion.probabilities.NEUTRAL * 100}%`,
													borderRadius: "4px",
												}}
											/>
										</div>
									</div>

									{/* DOWN Probability */}
									<div>
										<div
											style={{
												display: "flex",
												justifyContent: "space-between",
												fontSize: "0.8rem",
												marginBottom: "0.25rem",
											}}
										>
											<span style={{ color: "rgba(239, 68, 68, 0.9)" }}>
												⚠️ Downward
											</span>
											<span style={{ color: "rgba(255,255,255,0.8)" }}>
												{(stock.sentiment_fusion.probabilities.DOWN * 100).toFixed(1)}
												%
											</span>
										</div>
										<div
											style={{
												background: "rgba(255,255,255,0.1)",
												borderRadius: "4px",
												height: "6px",
												overflow: "hidden",
											}}
										>
											<div
												style={{
													background: "rgba(239, 68, 68, 0.8)",
													height: "100%",
													width: `${stock.sentiment_fusion.probabilities.DOWN * 100}%`,
													borderRadius: "4px",
												}}
											/>
										</div>
									</div>
								</div>
							</div>

							{/* Reasoning */}
							{stock.sentiment_fusion.reasoning &&
								stock.sentiment_fusion.reasoning.length > 0 && (
									<div style={{ marginBottom: "1rem" }}>
										<h5
											style={{
												color: "rgba(168, 85, 247, 0.9)",
												fontSize: "0.85rem",
												margin: "0 0 0.5rem 0",
											}}
										>
											Why This Prediction
										</h5>
										<ul
											style={{
												margin: "0.5rem 0 0 0",
												paddingLeft: "1.25rem",
												listStyle: "disc",
												color: "rgba(255,255,255,0.8)",
											}}
										>
											{stock.sentiment_fusion.reasoning.map((reason, idx) => (
												<li
													key={idx}
													style={{
														marginBottom: "0.5rem",
														fontSize: "0.9rem",
														lineHeight: "1.5",
													}}
												>
													{reason}
												</li>
											))}
										</ul>
									</div>
								)}

							{/* Prediction Details */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(168, 85, 247, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Prediction Details
								</h5>
								<div
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 1fr",
										gap: "0.5rem",
										fontSize: "0.8rem",
									}}
								>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Time Horizon:</span>
										<span
											style={{
												color: "rgba(255,255,255,0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											3 DAYS
										</span>
									</div>
									<div>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Model Type:</span>
										<span
											style={{
												color: "rgba(255,255,255,0.9)",
												marginLeft: "0.5rem",
												fontWeight: "600",
											}}
										>
											Sentiment + Technical
										</span>
									</div>
								</div>
							</div>

							{/* Model Metadata Footer */}
							<div
								style={{
									marginTop: "1rem",
									paddingTop: "0.75rem",
									borderTop: "1px solid rgba(255,255,255,0.1)",
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.5)",
									display: "flex",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: "0.5rem",
								}}
							>
								<span>Model: Sentiment-Fusion {stock.sentiment_fusion.model_version}</span>
								<span>
									Predicted:{" "}
									{new Date(stock.sentiment_fusion.prediction_timestamp).toLocaleString()}
								</span>
							</div>
						</div>
					)}
				</>
			)}

			{/* Smart Money Flow Section */}
			{stock.smart_money_flow && (
				<>
					<div
						onClick={() => toggleSection("smart_money_flow")}
						style={{
							background: "rgba(251, 191, 36, 0.1)",
							border: "1px solid rgba(251, 191, 36, 0.3)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "0.75rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
							<span style={{ fontSize: "1.5rem" }}>
								{stock.smart_money_flow.action === "BUY" ? "💰" : "📊"}
							</span>
							<div>
								<span
									style={{
										fontSize: "0.9rem",
										fontWeight: "600",
										color: "rgba(251, 191, 36, 0.9)",
									}}
								>
									Smart Money Flow
								</span>
								<div
									style={{
										fontSize: "0.75rem",
										color: "rgba(255,255,255,0.6)",
										marginTop: "0.25rem",
									}}
								>
									Institutional & insider activity detected
								</div>
							</div>
						</div>
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: "0.75rem",
							}}
						>
							<div
								style={{
									background:
										stock.smart_money_flow.action === "BUY"
											? "rgba(34, 197, 94, 0.2)"
											: "rgba(239, 68, 68, 0.2)",
									border: `1px solid ${
										stock.smart_money_flow.action === "BUY"
											? "rgba(34, 197, 94, 0.4)"
											: "rgba(239, 68, 68, 0.4)"
									}`,
									color:
										stock.smart_money_flow.action === "BUY"
											? "rgba(34, 197, 94, 0.9)"
											: "rgba(239, 68, 68, 0.9)",
									padding: "0.5rem 1rem",
									borderRadius: "8px",
									fontSize: "1rem",
									fontWeight: "700",
								}}
							>
								{stock.smart_money_flow.action}
							</div>
							<span style={{ fontSize: "1.2rem", color: "rgba(251, 191, 36, 0.6)" }}>
								{expandedSection === "smart_money_flow" ? "−" : "+"}
							</span>
						</div>
					</div>

					{expandedSection === "smart_money_flow" && (
						<div
							style={{
								background: "rgba(251, 191, 36, 0.05)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "0.75rem",
							}}
						>
							{/* Confidence Display */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(251, 191, 36, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Signal Confidence
								</h5>
								<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
									<div
										style={{
											flex: 1,
											background: "rgba(255,255,255,0.1)",
											borderRadius: "20px",
											height: "8px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												background:
													"linear-gradient(90deg, rgba(251,191,36,0.8), rgba(245,158,11,0.8))",
												height: "100%",
												width: `${stock.smart_money_flow.confidence * 100}%`,
												borderRadius: "20px",
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "1.2rem",
											fontWeight: "700",
											color: "rgba(251,191,36,0.9)",
										}}
									>
										{(stock.smart_money_flow.confidence * 100).toFixed(1)}%
									</span>
								</div>
							</div>

							{/* Reasoning */}
							{stock.smart_money_flow.reasoning && (
								<div style={{ marginBottom: "1rem" }}>
									<h5
										style={{
											color: "rgba(251, 191, 36, 0.9)",
											fontSize: "0.85rem",
											margin: "0 0 0.5rem 0",
										}}
									>
										Why This Signal
									</h5>
									<div
										style={{
											fontSize: "0.9rem",
											color: "rgba(255,255,255,0.8)",
											lineHeight: "1.5",
											background: "rgba(0,0,0,0.2)",
											padding: "0.75rem",
											borderRadius: "6px",
										}}
									>
										{stock.smart_money_flow.reasoning}
									</div>
								</div>
							)}

							{/* Feature Importance */}
							{stock.smart_money_flow.feature_importance &&
								Object.keys(stock.smart_money_flow.feature_importance).length > 0 && (
								<div style={{ marginBottom: "1rem" }}>
									<h5
										style={{
											color: "rgba(251, 191, 36, 0.9)",
											fontSize: "0.85rem",
											margin: "0 0 0.5rem 0",
										}}
									>
										Top Influencing Factors
									</h5>
									<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
										{Object.entries(stock.smart_money_flow.feature_importance)
											.sort((a, b) => b[1] - a[1])
											.slice(0, 5)
											.map(([feature, importance], idx) => (
												<div
													key={idx}
													style={{
														display: "flex",
														justifyContent: "space-between",
														alignItems: "center",
														padding: "0.5rem",
														background: "rgba(255,255,255,0.05)",
														borderRadius: "6px",
													}}
												>
													<span style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.9)" }}>
														{feature.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
													</span>
													<span style={{ fontSize: "0.75rem", color: "rgba(251,191,36,0.9)", fontWeight: "600" }}>
														{importance.toFixed(0)}
													</span>
												</div>
											))}
									</div>
								</div>
							)}

							{/* Model Metadata Footer */}
							<div
								style={{
									marginTop: "1rem",
									paddingTop: "0.75rem",
									borderTop: "1px solid rgba(255,255,255,0.1)",
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.5)",
									display: "flex",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: "0.5rem",
								}}
							>
								<span>Model: Smart Money Flow {stock.smart_money_flow.model_version}</span>
								<span>
									Predicted:{" "}
									{new Date(stock.smart_money_flow.prediction_timestamp).toLocaleString()}
								</span>
							</div>
						</div>
					)}
				</>
			)}

			{/* Volatility Prediction Section */}
			{stock.volatility_prediction && (
				<>
					<div
						onClick={() => toggleSection("volatility_prediction")}
						style={{
							background: "rgba(168, 85, 247, 0.1)",
							border: "1px solid rgba(168, 85, 247, 0.3)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "1rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
							<span style={{ fontSize: "1.5rem" }}>📊</span>
							<div>
								<span
									style={{
										fontSize: "0.9rem",
										fontWeight: "600",
										color: "white",
										display: "flex",
										alignItems: "center",
										gap: "0.5rem",
									}}
								>
									Volatility Prediction
								</span>
								<div
									style={{
										fontSize: "0.75rem",
										color: "rgba(255,255,255,0.6)",
										marginTop: "0.25rem",
									}}
								>
									{stock.volatility_prediction.predicted_volatility.toFixed(1)}% volatility expected (
									{stock.volatility_prediction.prediction_horizon_days}-day horizon)
								</div>
							</div>
						</div>
						<div
							style={{
								display: "flex",
								gap: "1rem",
								alignItems: "center",
							}}
						>
							<div
								style={{
									background:
										stock.volatility_prediction.risk_category === "very_low"
											? "rgba(34, 197, 94, 0.2)"
											: stock.volatility_prediction.risk_category === "low"
												? "rgba(132, 204, 22, 0.2)"
												: stock.volatility_prediction.risk_category === "moderate"
													? "rgba(251, 191, 36, 0.2)"
													: stock.volatility_prediction.risk_category === "high"
														? "rgba(249, 115, 22, 0.2)"
														: "rgba(239, 68, 68, 0.2)",
									border: `1px solid ${
										stock.volatility_prediction.risk_category === "very_low"
											? "rgba(34, 197, 94, 0.4)"
											: stock.volatility_prediction.risk_category === "low"
												? "rgba(132, 204, 22, 0.4)"
												: stock.volatility_prediction.risk_category === "moderate"
													? "rgba(251, 191, 36, 0.4)"
													: stock.volatility_prediction.risk_category === "high"
														? "rgba(249, 115, 22, 0.4)"
														: "rgba(239, 68, 68, 0.4)"
									}`,
									color:
										stock.volatility_prediction.risk_category === "very_low"
											? "rgba(34, 197, 94, 0.9)"
											: stock.volatility_prediction.risk_category === "low"
												? "rgba(132, 204, 22, 0.9)"
												: stock.volatility_prediction.risk_category === "moderate"
													? "rgba(251, 191, 36, 0.9)"
													: stock.volatility_prediction.risk_category === "high"
														? "rgba(249, 115, 22, 0.9)"
														: "rgba(239, 68, 68, 0.9)",
									padding: "0.5rem 1rem",
									borderRadius: "8px",
									fontSize: "0.85rem",
									fontWeight: "700",
									textTransform: "uppercase",
								}}
							>
								{stock.volatility_prediction.risk_category.replace("_", " ")}
							</div>
							<span style={{ fontSize: "1.2rem", color: "rgba(168, 85, 247, 0.6)" }}>
								{expandedSection === "volatility_prediction" ? "−" : "+"}
							</span>
						</div>
					</div>

					{expandedSection === "volatility_prediction" && (
						<div
							style={{
								background: "rgba(168, 85, 247, 0.05)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "1rem",
								border: "1px solid rgba(168, 85, 247, 0.2)",
							}}
						>
							{/* Predicted Volatility */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(168, 85, 247, 0.9)",
										fontSize: "0.85rem",
										marginBottom: "0.5rem",
									}}
								>
									Predicted Volatility
								</h5>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "1rem",
									}}
								>
									<div
										style={{
											flex: 1,
											background: "rgba(255,255,255,0.1)",
											borderRadius: "20px",
											height: "8px",
											position: "relative",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												background:
													"linear-gradient(90deg, rgba(168,85,247,0.8), rgba(217,70,239,0.8))",
												height: "100%",
												width: `${Math.min(stock.volatility_prediction.predicted_volatility, 100)}%`,
												borderRadius: "20px",
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "1.5rem",
											fontWeight: "700",
											color: "rgba(168,85,247,0.9)",
										}}
									>
										{stock.volatility_prediction.predicted_volatility.toFixed(1)}%
									</span>
								</div>
							</div>

							{/* Confidence Level */}
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(168, 85, 247, 0.9)",
										fontSize: "0.85rem",
										marginBottom: "0.5rem",
									}}
								>
									Confidence Level
								</h5>
								<div
									style={{
										display: "flex",
										gap: "0.5rem",
										alignItems: "center",
									}}
								>
									<div
										style={{
											padding: "0.5rem 1rem",
											background:
												stock.volatility_prediction.confidence_level === "high"
													? "rgba(34, 197, 94, 0.2)"
													: stock.volatility_prediction.confidence_level === "medium"
														? "rgba(251, 191, 36, 0.2)"
														: "rgba(239, 68, 68, 0.2)",
											border: `1px solid ${
												stock.volatility_prediction.confidence_level === "high"
													? "rgba(34, 197, 94, 0.4)"
													: stock.volatility_prediction.confidence_level === "medium"
														? "rgba(251, 191, 36, 0.4)"
														: "rgba(239, 68, 68, 0.4)"
											}`,
											borderRadius: "8px",
											color:
												stock.volatility_prediction.confidence_level === "high"
													? "rgba(34, 197, 94, 0.9)"
													: stock.volatility_prediction.confidence_level === "medium"
														? "rgba(251, 191, 36, 0.9)"
														: "rgba(239, 68, 68, 0.9)",
											fontWeight: "600",
											textTransform: "capitalize",
										}}
									>
										{stock.volatility_prediction.confidence_level} Confidence
									</div>
									<span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.85rem" }}>
										Feature Completeness:{" "}
										{(stock.volatility_prediction.feature_completeness * 100).toFixed(0)}%
									</span>
								</div>
							</div>

							{/* Reasoning */}
							{stock.volatility_prediction.reasoning && (
								<div style={{ marginBottom: "1rem" }}>
									<h5
										style={{
											color: "rgba(168, 85, 247, 0.9)",
											fontSize: "0.85rem",
											marginBottom: "0.5rem",
										}}
									>
										Analysis
									</h5>
									<div
										style={{
											fontSize: "0.9rem",
											lineHeight: "1.6",
											color: "rgba(255,255,255,0.8)",
											background: "rgba(0,0,0,0.2)",
											padding: "0.75rem",
											borderRadius: "6px",
										}}
									>
										{stock.volatility_prediction.reasoning}
									</div>
								</div>
							)}

							{/* Model Info */}
							<div
								style={{
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.5)",
									marginTop: "0.5rem",
									display: "flex",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: "0.5rem",
								}}
							>
								<span>
									Model: Volatility Prediction{" "}
									{stock.volatility_prediction.model_version || "1.0.0"}
								</span>
								<span>
									Predicted:{" "}
									{new Date(
										stock.volatility_prediction.prediction_timestamp ||
											Date.now()
									).toLocaleString()}
								</span>
							</div>
						</div>
					)}
				</>
			)}

			{/* Quick Insights */}
			{stock.insights?.positive && stock.insights.positive.length > 0 && (
				<div
					style={{
						background: "rgba(0, 0, 0, 0.3)",
						borderRadius: "12px",
						padding: "1rem",
						marginBottom: "1rem",
					}}
				>
					<h4
						style={{
							fontSize: "0.9rem",
							fontWeight: "600",
							color: "rgba(255, 255, 255, 0.9)",
							margin: "0 0 0.75rem 0",
							textTransform: "uppercase",
							letterSpacing: "0.5px",
						}}
					>
						Quick Insights
					</h4>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
						{stock.insights.positive.slice(0, 3).map((insight, idx) => (
							<div
								key={idx}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
								}}
							>
								<span style={{ color: "rgba(34, 197, 94, 0.9)", fontSize: "1rem" }}>
									✓
								</span>
								<span
									style={{
										fontSize: "0.9rem",
										color: "rgba(255, 255, 255, 0.8)",
										lineHeight: "1.4",
									}}
								>
									{insight}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Expandable Sections */}

			{/* ESD Details Section */}
			{stock.early_signal && (
				<>
					<div
						onClick={() => toggleSection("esd_details")}
						style={{
							background: "rgba(99, 102, 241, 0.1)",
							border: "1px solid rgba(99, 102, 241, 0.3)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "0.75rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<div>
							<span
								style={{
									fontSize: "0.9rem",
									fontWeight: "600",
									color: "rgba(99, 102, 241, 0.9)",
								}}
							>
								🔮 Future Signal Details
							</span>
							<span
								style={{
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.6)",
									marginLeft: "0.5rem",
								}}
							>
								{stock.early_signal.upgrade_likely ? "Upgrade" : "Downgrade"} likely
								in 2 weeks
							</span>
						</div>
						<span style={{ fontSize: "1.2rem", color: "rgba(99, 102, 241, 0.6)" }}>
							{expandedSection === "esd_details" ? "−" : "+"}
						</span>
					</div>

					{expandedSection === "esd_details" && (
						<div
							style={{
								background: "rgba(99, 102, 241, 0.05)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "0.75rem",
							}}
						>
							<div style={{ marginBottom: "1rem" }}>
								<h5
									style={{
										color: "rgba(99, 102, 241, 0.9)",
										fontSize: "0.85rem",
										margin: "0 0 0.5rem 0",
									}}
								>
									Prediction Confidence
								</h5>
								<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
									<div
										style={{
											flex: 1,
											background: "rgba(255,255,255,0.1)",
											borderRadius: "20px",
											height: "8px",
											overflow: "hidden",
										}}
									>
										<div
											style={{
												background:
													"linear-gradient(90deg, rgba(99,102,241,0.8), rgba(168,85,247,0.8))",
												height: "100%",
												width: `${stock.early_signal.confidence * 100}%`,
												borderRadius: "20px",
											}}
										/>
									</div>
									<span
										style={{
											fontSize: "1.2rem",
											fontWeight: "700",
											color: "rgba(99,102,241,0.9)",
										}}
									>
										{(stock.early_signal.confidence * 100).toFixed(1)}%
									</span>
								</div>
							</div>

							{stock.early_signal.reasoning &&
								stock.early_signal.reasoning.length > 0 && (
									<div style={{ marginBottom: "1rem" }}>
										<h5
											style={{
												color: "rgba(99, 102, 241, 0.9)",
												fontSize: "0.85rem",
												margin: "0 0 0.5rem 0",
											}}
										>
											Why This Prediction
										</h5>
										<ul
											style={{
												margin: "0.5rem 0 0 0",
												paddingLeft: "1.25rem",
												listStyle: "disc",
												color: "rgba(255,255,255,0.8)",
											}}
										>
											{stock.early_signal.reasoning.map((reason, idx) => (
												<li
													key={idx}
													style={{
														marginBottom: "0.5rem",
														fontSize: "0.9rem",
														lineHeight: "1.5",
													}}
												>
													{reason}
												</li>
											))}
										</ul>
									</div>
								)}

							<div
								style={{
									marginTop: "1rem",
									paddingTop: "0.75rem",
									borderTop: "1px solid rgba(255,255,255,0.1)",
									fontSize: "0.75rem",
									color: "rgba(255,255,255,0.5)",
									display: "flex",
									justifyContent: "space-between",
									flexWrap: "wrap",
									gap: "0.5rem",
								}}
							>
								<span>Model: LightGBM {stock.early_signal.model_version}</span>
								<span>
									Predicted:{" "}
									{new Date(
										stock.early_signal.prediction_timestamp
									).toLocaleString()}
								</span>
							</div>
						</div>
					)}
				</>
			)}

			{stock.reasoning && (
				<>
					<div
						onClick={() => toggleSection("reasoning")}
						style={{
							background: "rgba(0, 0, 0, 0.3)",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "12px",
							padding: "1rem",
							marginBottom: "0.75rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "0.9rem",
								fontWeight: "600",
								color: "rgba(255, 255, 255, 0.9)",
							}}
						>
							Why This Recommendation
						</span>
						<span
							style={{
								fontSize: "1.2rem",
								color: "rgba(255, 255, 255, 0.6)",
								transform:
									expandedSection === "reasoning"
										? "rotate(180deg)"
										: "rotate(0deg)",
								transition: "transform 0.3s ease",
							}}
						>
							›
						</span>
					</div>
					{expandedSection === "reasoning" && (
						<div
							style={{
								background: "rgba(0, 0, 0, 0.2)",
								borderRadius: "8px",
								padding: "1rem",
								marginBottom: "0.75rem",
								fontSize: "0.9rem",
								color: "rgba(255, 255, 255, 0.8)",
								lineHeight: "1.6",
							}}
						>
							{typeof stock.reasoning === "string" ? (
								stock.reasoning
							) : (
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "1rem",
									}}
								>
									{stock.reasoning.primaryFactors &&
										stock.reasoning.primaryFactors.length > 0 && (
											<div>
												<h5
													style={{
														fontSize: "0.85rem",
														fontWeight: "600",
														color: "rgba(255, 255, 255, 0.9)",
														marginBottom: "0.5rem",
														textTransform: "uppercase",
														letterSpacing: "0.5px",
													}}
												>
													Primary Factors
												</h5>
												<ul
													style={{
														margin: 0,
														paddingLeft: "1.25rem",
														listStyle: "disc",
													}}
												>
													{stock.reasoning.primaryFactors.map(
														(factor, idx) => (
															<li
																key={idx}
																style={{ marginBottom: "0.25rem" }}
															>
																{formatFactorName(factor)}
															</li>
														)
													)}
												</ul>
											</div>
										)}
									{stock.reasoning.opportunities &&
										stock.reasoning.opportunities.length > 0 && (
											<div>
												<h5
													style={{
														fontSize: "0.85rem",
														fontWeight: "600",
														color: "rgba(34, 197, 94, 0.9)",
														marginBottom: "0.5rem",
														textTransform: "uppercase",
														letterSpacing: "0.5px",
													}}
												>
													Opportunities
												</h5>
												<ul
													style={{
														margin: 0,
														paddingLeft: "1.25rem",
														listStyle: "disc",
													}}
												>
													{stock.reasoning.opportunities.map(
														(opp, idx) => (
															<li
																key={idx}
																style={{ marginBottom: "0.25rem" }}
															>
																{opp}
															</li>
														)
													)}
												</ul>
											</div>
										)}
									{stock.reasoning.warnings &&
										stock.reasoning.warnings.length > 0 && (
											<div>
												<h5
													style={{
														fontSize: "0.85rem",
														fontWeight: "600",
														color: "rgba(251, 191, 36, 0.9)",
														marginBottom: "0.5rem",
														textTransform: "uppercase",
														letterSpacing: "0.5px",
													}}
												>
													Warnings
												</h5>
												<ul
													style={{
														margin: 0,
														paddingLeft: "1.25rem",
														listStyle: "disc",
													}}
												>
													{stock.reasoning.warnings.map(
														(warning, idx) => (
															<li
																key={idx}
																style={{ marginBottom: "0.25rem" }}
															>
																{warning}
															</li>
														)
													)}
												</ul>
											</div>
										)}
								</div>
							)}
						</div>
					)}
				</>
			)}

			{stock.insights?.risks && stock.insights.risks.length > 0 && (
				<>
					<div
						onClick={() => toggleSection("risks")}
						style={{
							background: "rgba(0, 0, 0, 0.3)",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "12px",
							padding: "1rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							justifyContent: "space-between",
							alignItems: "center",
						}}
					>
						<span
							style={{
								fontSize: "0.9rem",
								fontWeight: "600",
								color: "rgba(255, 255, 255, 0.9)",
							}}
						>
							Risks & Opportunities
						</span>
						<span
							style={{
								fontSize: "1.2rem",
								color: "rgba(255, 255, 255, 0.6)",
								transform:
									expandedSection === "risks" ? "rotate(180deg)" : "rotate(0deg)",
								transition: "transform 0.3s ease",
							}}
						>
							›
						</span>
					</div>
					{expandedSection === "risks" && (
						<div
							style={{
								background: "rgba(0, 0, 0, 0.2)",
								borderRadius: "8px",
								padding: "1rem",
								marginTop: "0.75rem",
							}}
						>
							<div
								style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
							>
								{stock.insights.risks.map((risk, idx) => (
									<div
										key={idx}
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
										}}
									>
										<span
											style={{
												color: "rgba(251, 191, 36, 0.9)",
												fontSize: "1rem",
											}}
										>
											⚠
										</span>
										<span
											style={{
												fontSize: "0.9rem",
												color: "rgba(255, 255, 255, 0.8)",
												lineHeight: "1.4",
											}}
										>
											{risk}
										</span>
									</div>
								))}
							</div>
						</div>
					)}
				</>
			)}

			{/* Score Breakdown Component */}
			<ScoreBreakdown
				symbol={stock.symbol}
				compositeScore={stock.compositeScore || 0}
				technicalScore={stock.technicalScore}
				fundamentalScore={stock.fundamentalScore}
				macroScore={stock.macroScore}
				sentimentScore={stock.sentimentScore}
				esgScore={stock.esgScore}
				analystScore={stock.analystScore}
				mlPrediction={stock.mlPrediction}
			/>

			{/* Timestamp */}
			<div
				style={{
					marginTop: "1.5rem",
					paddingTop: "1rem",
					borderTop: "1px solid rgba(255, 255, 255, 0.1)",
					fontSize: "0.75rem",
					color: "rgba(255, 255, 255, 0.4)",
					textAlign: "right",
					display: "flex",
					alignItems: "center",
					justifyContent: "flex-end",
					gap: "0.5rem",
				}}
			>
				<span>⏱</span>
				<span>Last updated: {new Date().toLocaleTimeString()}</span>
			</div>
		</div>
	);
}
