"use client";

import { useState } from "react";

interface ScoreBreakdownProps {
	symbol: string;
	compositeScore: number;
	technicalScore?: number;
	fundamentalScore?: number;
	macroScore?: number;
	sentimentScore?: number;
	esgScore?: number;
	analystScore?: number;
	mlPrediction?: {
		direction: string;
		confidence: number;
		prediction: number;
		modelVotes?: Array<{
			modelName: string;
			signal: string;
			confidence: number;
		}>;
	};
}

export default function ScoreBreakdown({
	symbol,
	compositeScore,
	technicalScore,
	fundamentalScore,
	macroScore,
	sentimentScore,
	esgScore,
	analystScore,
	mlPrediction
}: ScoreBreakdownProps) {
	const [isExpanded, setIsExpanded] = useState(false);

	// Helper function to get score color
	const getScoreColor = (score: number) => {
		if (score >= 70) return "rgba(34, 197, 94, 0.9)"; // Green
		if (score >= 50) return "rgba(234, 179, 8, 0.9)"; // Yellow
		return "rgba(239, 68, 68, 0.9)"; // Red
	};

	// Helper function to get score label
	const getScoreLabel = (score: number) => {
		if (score >= 70) return "Strong";
		if (score >= 50) return "Moderate";
		return "Weak";
	};

	// Helper function to render progress bar
	const renderScoreBar = (label: string, score: number | undefined, icon: string) => {
		if (score === undefined) return null;

		const normalizedScore = Math.round(score);
		const color = getScoreColor(normalizedScore);
		const scoreLabel = getScoreLabel(normalizedScore);

		return (
			<div style={{ marginBottom: "1rem" }}>
				<div
					style={{
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
						marginBottom: "0.5rem"
					}}
				>
					<span style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.9)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
						<span>{icon}</span>
						<span>{label}</span>
					</span>
					<span style={{ fontSize: "0.85rem", color, fontWeight: "600" }}>
						{normalizedScore}/100 ({scoreLabel})
					</span>
				</div>
				<div
					style={{
						width: "100%",
						height: "8px",
						background: "rgba(255, 255, 255, 0.1)",
						borderRadius: "4px",
						overflow: "hidden"
					}}
				>
					<div
						style={{
							width: `${normalizedScore}%`,
							height: "100%",
							background: color,
							transition: "width 0.3s ease",
							borderRadius: "4px"
						}}
					/>
				</div>
			</div>
		);
	};

	// Render ML prediction section
	const renderMLPrediction = () => {
		if (!mlPrediction) return null;

		const directionIcon = mlPrediction.direction === "UP" ? "📈" : mlPrediction.direction === "DOWN" ? "📉" : "➡️";
		const directionColor = mlPrediction.direction === "UP"
			? "rgba(34, 197, 94, 0.9)"
			: mlPrediction.direction === "DOWN"
			? "rgba(239, 68, 68, 0.9)"
			: "rgba(234, 179, 8, 0.9)";

		return (
			<div
				style={{
					marginTop: "1.5rem",
					padding: "1rem",
					background: "rgba(99, 102, 241, 0.05)",
					border: "1px solid rgba(99, 102, 241, 0.2)",
					borderRadius: "8px"
				}}
			>
				<div style={{ fontSize: "0.95rem", fontWeight: "600", color: "rgba(99, 102, 241, 0.9)", marginBottom: "0.75rem" }}>
					🤖 ML Models (1-week forecast)
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
					<span style={{ fontSize: "1.5rem" }}>{directionIcon}</span>
					<div style={{ flex: 1 }}>
						<div style={{ fontSize: "1rem", fontWeight: "600", color: directionColor }}>
							{mlPrediction.direction}
						</div>
						<div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.7)" }}>
							{Math.round(mlPrediction.confidence * 100)}% confident
						</div>
					</div>
				</div>

				{mlPrediction.modelVotes && mlPrediction.modelVotes.length > 0 && (
					<div style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
						<div style={{ color: "rgba(255, 255, 255, 0.6)", marginBottom: "0.5rem" }}>Model Votes:</div>
						{mlPrediction.modelVotes.map((vote, idx) => (
							<div
								key={idx}
								style={{
									display: "flex",
									justifyContent: "space-between",
									padding: "0.25rem 0",
									color: "rgba(255, 255, 255, 0.8)"
								}}
							>
								<span>• {vote.modelName}</span>
								<span>{vote.signal} ({Math.round(vote.confidence * 100)}%)</span>
							</div>
						))}
					</div>
				)}

				<div
					style={{
						marginTop: "0.75rem",
						padding: "0.5rem",
						background: "rgba(0, 0, 0, 0.2)",
						borderRadius: "4px",
						fontSize: "0.75rem",
						color: "rgba(255, 255, 255, 0.6)"
					}}
				>
					ℹ️ ML predictions focus on short-term price movements. Overall recommendation considers long-term fundamentals.
				</div>
			</div>
		);
	};

	return (
		<div>
			{/* Toggle Button */}
			<button
				onClick={() => setIsExpanded(!isExpanded)}
				style={{
					width: "100%",
					padding: "1rem",
					background: "rgba(255, 255, 255, 0.05)",
					border: "1px solid rgba(255, 255, 255, 0.1)",
					borderRadius: "8px",
					color: "white",
					fontSize: "0.95rem",
					fontWeight: "600",
					cursor: "pointer",
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					transition: "all 0.3s ease",
					marginTop: "1rem"
				}}
				onMouseEnter={(e) => {
					e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
					e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
				}}
				onMouseLeave={(e) => {
					e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
					e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
				}}
			>
				<span>📊 {isExpanded ? "Hide" : "Show"} Detailed Score Breakdown</span>
				<span style={{ fontSize: "1.2rem", transition: "transform 0.3s ease", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
					▼
				</span>
			</button>

			{/* Expanded Content */}
			{isExpanded && (
				<div
					style={{
						marginTop: "1rem",
						padding: "1.5rem",
						background: "rgba(0, 0, 0, 0.2)",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						borderRadius: "8px",
						animation: "fadeIn 0.3s ease"
					}}
				>
					<div style={{ marginBottom: "1.5rem" }}>
						<div style={{ fontSize: "1.1rem", fontWeight: "600", color: "white", marginBottom: "1rem" }}>
							Category Scores
						</div>
						{renderScoreBar("Technical Analysis", technicalScore, "📈")}
						{renderScoreBar("Fundamental Data", fundamentalScore, "📊")}
						{renderScoreBar("Macroeconomic", macroScore, "🌍")}
						{renderScoreBar("Sentiment", sentimentScore, "💬")}
						{renderScoreBar("ESG", esgScore, "🌱")}
						{renderScoreBar("Analyst Rating", analystScore ? analystScore * 100 : undefined, "👔")}
					</div>

					{renderMLPrediction()}

					{/* Key Insight */}
					<div
						style={{
							marginTop: "1.5rem",
							padding: "1rem",
							background: "rgba(168, 85, 247, 0.05)",
							border: "1px solid rgba(168, 85, 247, 0.2)",
							borderRadius: "8px"
						}}
					>
						<div style={{ fontSize: "0.85rem", color: "rgba(168, 85, 247, 0.9)", fontWeight: "600", marginBottom: "0.5rem" }}>
							💡 Key Insight
						</div>
						<div style={{ fontSize: "0.85rem", color: "rgba(255, 255, 255, 0.8)", lineHeight: "1.5" }}>
							{mlPrediction && mlPrediction.direction !== "NEUTRAL" ? (
								<>
									The overall {compositeScore >= 60 ? "BUY" : compositeScore >= 40 ? "HOLD" : "SELL"} rating reflects long-term fundamentals and market conditions.
									ML models predict a short-term {mlPrediction.direction.toLowerCase()} movement,
									which may present a {mlPrediction.direction === "DOWN" ? "buying opportunity on dips" : "profit-taking opportunity"}.
								</>
							) : (
								<>
									The {compositeScore >= 60 ? "BUY" : compositeScore >= 40 ? "HOLD" : "SELL"} rating is driven by{" "}
									{macroScore && macroScore > 80 ? "strong macroeconomic tailwinds" :
									 technicalScore && technicalScore > 70 ? "positive technical momentum" :
									 fundamentalScore && fundamentalScore > 70 ? "solid fundamentals" :
									 sentimentScore && sentimentScore > 70 ? "positive market sentiment" :
									 "a balanced assessment across all factors"}.
								</>
							)}
						</div>
					</div>
				</div>
			)}

			{/* CSS Animation */}
			<style jsx>{`
				@keyframes fadeIn {
					from {
						opacity: 0;
						transform: translateY(-10px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}
			`}</style>
		</div>
	);
}
