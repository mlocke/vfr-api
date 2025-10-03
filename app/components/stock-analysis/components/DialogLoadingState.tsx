/**
 * DialogLoadingState - Loading state component for stock dialog
 * Shows animated loading indicators with different stages and progress
 */

"use client";

import React from "react";
import { DialogLoadingStateProps } from "../types";

/**
 * Loading stage configurations
 */
const LOADING_STAGES = {
	fetching: {
		icon: "🔍",
		title: "Fetching Data",
		description: "Connecting to financial data sources...",
		color: "rgba(59, 130, 246, 0.8)",
	},
	analyzing: {
		icon: "🧠",
		title: "Analyzing",
		description: "Processing multi-factor analysis...",
		color: "rgba(168, 85, 247, 0.8)",
	},
	processing: {
		icon: "⚡",
		title: "Processing",
		description: "Generating insights and recommendations...",
		color: "rgba(0, 200, 83, 0.8)",
	},
};

/**
 * Animated dots component
 */
const AnimatedDots: React.FC = () => (
	<span style={{ display: "inline-block" }}>
		<span style={{ animation: "dot-pulse 1.5s infinite 0s" }}>.</span>
		<span style={{ animation: "dot-pulse 1.5s infinite 0.2s" }}>.</span>
		<span style={{ animation: "dot-pulse 1.5s infinite 0.4s" }}>.</span>
	</span>
);

/**
 * Progress bar component
 */
const ProgressBar: React.FC<{ progress?: number }> = ({ progress }) => {
	const displayProgress = progress || 0;

	return (
		<div
			style={{
				width: "100%",
				height: "4px",
				backgroundColor: "rgba(255, 255, 255, 0.1)",
				borderRadius: "2px",
				overflow: "hidden",
				marginTop: "1rem",
			}}
		>
			<div
				style={{
					width: displayProgress > 0 ? `${displayProgress}%` : "30%",
					height: "100%",
					background:
						displayProgress > 0
							? "linear-gradient(90deg, rgba(0, 200, 83, 0.8), rgba(59, 130, 246, 0.8))"
							: "linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent)",
					borderRadius: "2px",
					transition: displayProgress > 0 ? "width 0.3s ease" : "none",
					animation: displayProgress > 0 ? "none" : "loading-shimmer 1.5s infinite",
				}}
			/>
		</div>
	);
};

/**
 * Skeleton loader for data preview
 */
const SkeletonLoader: React.FC = () => (
	<div
		style={{
			display: "flex",
			flexDirection: "column",
			gap: "0.75rem",
			marginTop: "1.5rem",
			opacity: 0.6,
		}}
	>
		{[1, 2, 3].map(index => (
			<div
				key={index}
				style={{
					display: "flex",
					alignItems: "center",
					gap: "1rem",
				}}
			>
				<div
					style={{
						width: "40px",
						height: "8px",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						borderRadius: "4px",
						animation: `skeleton-pulse 2s infinite ${index * 0.2}s`,
					}}
				/>
				<div
					style={{
						flex: 1,
						height: "8px",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						borderRadius: "4px",
						animation: `skeleton-pulse 2s infinite ${index * 0.2}s`,
					}}
				/>
				<div
					style={{
						width: "30px",
						height: "8px",
						backgroundColor: "rgba(255, 255, 255, 0.1)",
						borderRadius: "4px",
						animation: `skeleton-pulse 2s infinite ${index * 0.2}s`,
					}}
				/>
			</div>
		))}
	</div>
);

/**
 * DialogLoadingState Component
 */
export const DialogLoadingState: React.FC<DialogLoadingStateProps> = ({
	symbol,
	stage = "fetching",
	progress,
}) => {
	const stageConfig = LOADING_STAGES[stage];

	return (
		<>
			{/* CSS Animations */}
			<style jsx>{`
				@keyframes loading-spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}

				@keyframes loading-shimmer {
					0% {
						transform: translateX(-100%);
					}
					100% {
						transform: translateX(200%);
					}
				}

				@keyframes dot-pulse {
					0%,
					20% {
						opacity: 0.2;
					}
					50% {
						opacity: 1;
					}
					80%,
					100% {
						opacity: 0.2;
					}
				}

				@keyframes skeleton-pulse {
					0% {
						opacity: 0.3;
					}
					50% {
						opacity: 0.6;
					}
					100% {
						opacity: 0.3;
					}
				}

				@keyframes fade-in-up {
					from {
						opacity: 0;
						transform: translateY(20px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				.loading-container {
					animation: fade-in-up 0.4s ease-out;
				}

				.loading-icon {
					animation: loading-spin 2s linear infinite;
				}
			`}</style>

			<div
				className="loading-container"
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					padding: "3rem 2rem",
					textAlign: "center",
					background: "rgba(255, 255, 255, 0.05)",
					backdropFilter: "blur(10px)",
					WebkitBackdropFilter: "blur(10px)",
					border: "1px solid rgba(255, 255, 255, 0.1)",
					borderRadius: "15px",
					minHeight: "300px",
				}}
			>
				{/* Loading Icon */}
				<div
					className="loading-icon"
					style={{
						fontSize: "3rem",
						marginBottom: "1.5rem",
						filter: "drop-shadow(0 4px 12px rgba(0, 0, 0, 0.3))",
					}}
				>
					{stageConfig.icon}
				</div>

				{/* Loading Title */}
				<h3
					style={{
						fontSize: "1.5rem",
						fontWeight: "600",
						color: "white",
						marginBottom: "0.5rem",
						textShadow: "0 2px 4px rgba(0, 0, 0, 0.3)",
					}}
				>
					{stageConfig.title}
					{symbol && ` ${symbol}`}
					<AnimatedDots />
				</h3>

				{/* Loading Description */}
				<p
					style={{
						fontSize: "1rem",
						color: "rgba(255, 255, 255, 0.7)",
						marginBottom: progress ? "1rem" : "1.5rem",
						maxWidth: "400px",
						lineHeight: "1.5",
					}}
				>
					{stageConfig.description}
				</p>

				{/* Progress Bar */}
				<div style={{ width: "100%", maxWidth: "300px" }}>
					<ProgressBar progress={progress} />
				</div>

				{/* Progress Text */}
				{progress && (
					<div
						style={{
							fontSize: "0.875rem",
							color: "rgba(255, 255, 255, 0.6)",
							marginTop: "0.5rem",
						}}
					>
						{Math.round(progress)}% Complete
					</div>
				)}

				{/* Skeleton Loader Preview */}
				<div style={{ width: "100%", maxWidth: "400px" }}>
					<SkeletonLoader />
				</div>

				{/* Loading Tips */}
				<div
					style={{
						marginTop: "2rem",
						padding: "1rem",
						background: "rgba(59, 130, 246, 0.1)",
						border: "1px solid rgba(59, 130, 246, 0.2)",
						borderRadius: "8px",
						maxWidth: "400px",
						fontSize: "0.875rem",
						color: "rgba(255, 255, 255, 0.7)",
						lineHeight: "1.4",
					}}
				>
					<div
						style={{
							fontWeight: "600",
							color: "rgba(59, 130, 246, 0.9)",
							marginBottom: "0.5rem",
						}}
					>
						💡 Did you know?
					</div>
					{stage === "fetching" && (
						<div>
							We analyze data from 15+ sources including SEC filings, real-time market
							data, and sentiment indicators.
						</div>
					)}
					{stage === "analyzing" && (
						<div>
							Our AI engine processes technical, fundamental, macro, and sentiment
							factors to generate comprehensive scores.
						</div>
					)}
					{stage === "processing" && (
						<div>
							Final recommendations combine multiple analysis layers with confidence
							scoring for informed decisions.
						</div>
					)}
				</div>

				{/* Cancel Option (if needed) */}
				<button
					style={{
						marginTop: "1.5rem",
						padding: "0.5rem 1rem",
						background: "rgba(255, 255, 255, 0.1)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						borderRadius: "8px",
						color: "rgba(255, 255, 255, 0.7)",
						fontSize: "0.875rem",
						cursor: "pointer",
						transition: "all 0.2s ease",
					}}
					onMouseEnter={e => {
						e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
						e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.3)";
					}}
					onMouseLeave={e => {
						e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
						e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
					}}
					onClick={() => {
						// Cancel functionality would be implemented here
						console.log("Loading cancelled");
					}}
				>
					Cancel
				</button>
			</div>
		</>
	);
};

export default DialogLoadingState;
