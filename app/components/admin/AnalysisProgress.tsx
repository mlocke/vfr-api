"use client";

import { useEffect, useState, useRef } from "react";

export interface ProgressUpdate {
	stage: string;
	message: string;
	progress: number;
	timestamp: number;
	duration?: number;
	metadata?: Record<string, any>;
}

interface AnalysisProgressProps {
	sessionId: string | null;
	onComplete?: () => void;
}

// Track status of parallel services
type ServiceStatus = "pending" | "in_progress" | "completed" | "failed";

interface ServiceProgress {
	status: ServiceStatus;
	message?: string;
	duration?: number;
}

// Map stage IDs to service names
const PARALLEL_SERVICES = [
	{ id: "sentiment", name: "Sentiment", icon: "💭" },
	{ id: "vwap", name: "VWAP", icon: "📉" },
	{ id: "macro", name: "Macro", icon: "🌍" },
	{ id: "esg", name: "ESG", icon: "🌱" },
	{ id: "short_interest", name: "Short Interest", icon: "📊" },
	{ id: "extended_hours", name: "Extended Hours", icon: "🕐" },
	{ id: "options", name: "Options", icon: "📈" },
	{ id: "smart_money_flow", name: "Smart Money", icon: "💰" },
	{ id: "volatility_prediction", name: "Volatility", icon: "📊" },
];

export default function AnalysisProgress({ sessionId, onComplete }: AnalysisProgressProps) {
	const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
	const [currentProgress, setCurrentProgress] = useState(0);
	const [currentMessage, setCurrentMessage] = useState("Starting analysis...");
	const [isConnected, setIsConnected] = useState(false);
	const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<number | null>(null);
	const [serviceProgress, setServiceProgress] = useState<Record<string, ServiceProgress>>({});
	const eventSourceRef = useRef<EventSource | null>(null);
	const startTimeRef = useRef<number>(Date.now());

	useEffect(() => {
		if (!sessionId) {
			console.log("❌ No sessionId provided to AnalysisProgress");
			return;
		}

		console.log(`📡 AnalysisProgress: Connecting to SSE for session: ${sessionId}`);
		console.log(`📡 SSE URL: /api/stocks/analyze/progress/${sessionId}`);
		startTimeRef.current = Date.now();

		// Connect to SSE endpoint
		const eventSource = new EventSource(
			`/api/stocks/analyze/progress/${sessionId}`
		);
		eventSourceRef.current = eventSource;

		console.log("📡 EventSource created, waiting for connection...");

		eventSource.onopen = () => {
			console.log("✅ SSE connection established successfully!");
			setIsConnected(true);
		};

		eventSource.onmessage = (event) => {
			try {
				const update: ProgressUpdate = JSON.parse(event.data);
				console.log("📨 Progress update received:", update);
				console.log("📊 Progress:", update.progress + "%", "Stage:", update.stage);

				setProgressUpdates((prev) => [...prev, update]);
				setCurrentProgress(update.progress);
				setCurrentMessage(update.message);

				// Update service progress tracking
				const isParallelService = PARALLEL_SERVICES.some(s => s.id === update.stage);
				if (isParallelService) {
					setServiceProgress((prev) => {
						// Determine status based on message content
						let status: ServiceStatus = "in_progress";
						if (update.message.includes("completed") || update.duration !== undefined) {
							status = "completed";
						} else if (update.metadata?.error) {
							status = "failed";
						}

						return {
							...prev,
							[update.stage]: {
								status,
								message: update.message,
								duration: update.duration,
							},
						};
					});
				}

				// Calculate estimated time remaining
				const elapsed = Date.now() - startTimeRef.current;
				if (update.progress > 0 && update.progress < 100) {
					const estimated = (elapsed / update.progress) * (100 - update.progress);
					setEstimatedTimeRemaining(estimated);
				}

				// Handle errors first
				if (update.metadata?.error || update.stage === "error") {
					console.error("❌ Analysis error:", update.message);
					setEstimatedTimeRemaining(null);
					// Don't close immediately - let the error message display
					setTimeout(() => {
						eventSource.close();
					}, 2000);
					return; // Don't process as completion
				}

				// Handle completion
				if (update.stage === "complete" || update.progress === 100) {
					console.log("✅ Analysis complete");
					setEstimatedTimeRemaining(null);
					setTimeout(() => {
						eventSource.close();
						if (onComplete) onComplete();
					}, 1000);
				}
			} catch (error) {
				console.error("Failed to parse SSE message:", error);
			}
		};

		eventSource.onerror = (error) => {
			console.error("❌ SSE connection error:", error);
			setIsConnected(false);
			eventSource.close();
		};

		// Cleanup on unmount
		return () => {
			console.log("🔒 Closing SSE connection");
			eventSource.close();
		};
	}, [sessionId, onComplete]);

	if (!sessionId) return null;

	const formatTime = (ms: number) => {
		const seconds = Math.ceil(ms / 1000);
		return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	};

	const getStageIcon = (stage: string) => {
		const icons: Record<string, string> = {
			init: "🚀",
			market_data: "📊",
			technical: "📈",
			fundamentals: "💰",
			analyst: "👔",
			sentiment: "💭",
			vwap: "📉",
			macro: "🌍",
			esg: "🌱",
			short_interest: "📉",
			extended_hours: "🕐",
			options: "📊",
			ml_prediction: "🤖",
			smart_money_flow: "💰",
			volatility_prediction: "📊",
			composite: "🎯",
			complete: "✅",
			error: "❌",
			connected: "🔗",
		};
		return icons[stage] || "⏳";
	};

	return (
		<div
			style={{
				position: "fixed",
				top: "50%",
				left: "50%",
				transform: "translate(-50%, -50%)",
				width: "600px",
				maxWidth: "90vw",
				maxHeight: "90vh",
				background: "rgba(17, 24, 39, 0.98)",
				backdropFilter: "blur(20px)",
				border: "2px solid rgba(99, 102, 241, 0.4)",
				borderRadius: "20px",
				padding: "1.5rem",
				boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(99, 102, 241, 0.2)",
				zIndex: 9999,
				overflow: "hidden",
				display: "flex",
				flexDirection: "column",
			}}
		>
			{/* Header */}
			<div style={{ marginBottom: "1.5rem", textAlign: "center" }}>
				<h2
					style={{
						fontSize: "1.5rem",
						fontWeight: "700",
						color: "white",
						marginBottom: "0.5rem",
					}}
				>
					{currentProgress === 100 ? "Analysis Complete" : "Analyzing Stock..."}
				</h2>
				<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
					<div
						style={{
							width: "8px",
							height: "8px",
							borderRadius: "50%",
							background: isConnected ? "rgba(34, 197, 94, 0.8)" : "rgba(239, 68, 68, 0.8)",
							boxShadow: isConnected
								? "0 0 10px rgba(34, 197, 94, 0.6)"
								: "0 0 10px rgba(239, 68, 68, 0.6)",
							animation: isConnected ? "pulse 2s ease-in-out infinite" : "none",
						}}
					/>
					<p style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.7)", margin: 0 }}>
						{isConnected ? "Connected" : "Connecting..."}
					</p>
				</div>
			</div>

			{/* Progress Bar */}
			<div style={{ marginBottom: "1.5rem" }}>
				<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
					<span style={{ fontSize: "0.9rem", fontWeight: "600", color: "white" }}>
						{currentProgress}%
					</span>
					{estimatedTimeRemaining !== null && currentProgress < 100 && (
						<span style={{ fontSize: "0.9rem", color: "rgba(255, 255, 255, 0.6)" }}>
							~{formatTime(estimatedTimeRemaining)} remaining
						</span>
					)}
				</div>
				<div
					style={{
						width: "100%",
						height: "12px",
						background: "rgba(255, 255, 255, 0.1)",
						borderRadius: "6px",
						overflow: "hidden",
						position: "relative",
					}}
				>
					<div
						style={{
							width: `${currentProgress}%`,
							height: "100%",
							background: progressUpdates[progressUpdates.length - 1]?.metadata?.error
								? "linear-gradient(90deg, rgba(239, 68, 68, 0.8), rgba(220, 38, 38, 0.8))"
								: currentProgress === 100
								? "linear-gradient(90deg, rgba(34, 197, 94, 0.8), rgba(16, 185, 129, 0.8))"
								: "linear-gradient(90deg, rgba(99, 102, 241, 0.8), rgba(59, 130, 246, 0.8))",
							transition: "width 0.3s ease-out",
							borderRadius: "6px",
							boxShadow: progressUpdates[progressUpdates.length - 1]?.metadata?.error
								? "0 0 20px rgba(239, 68, 68, 0.5)"
								: currentProgress === 100
								? "0 0 20px rgba(34, 197, 94, 0.5)"
								: "0 0 20px rgba(99, 102, 241, 0.5)",
						}}
					/>
				</div>
			</div>

			{/* Current Status */}
			<div
				style={{
					background:
						progressUpdates[progressUpdates.length - 1]?.metadata?.error
							? "rgba(239, 68, 68, 0.1)"
							: "rgba(99, 102, 241, 0.1)",
					border:
						progressUpdates[progressUpdates.length - 1]?.metadata?.error
							? "1px solid rgba(239, 68, 68, 0.3)"
							: "1px solid rgba(99, 102, 241, 0.3)",
					borderRadius: "12px",
					padding: "0.75rem",
					marginBottom: "1rem",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.75rem",
					}}
				>
					<div
						style={{
							fontSize: "1.5rem",
							animation:
								currentProgress < 100 &&
								!progressUpdates[progressUpdates.length - 1]?.metadata?.error
									? "spin 2s linear infinite"
									: "none",
						}}
					>
						{progressUpdates.length > 0
							? getStageIcon(progressUpdates[progressUpdates.length - 1].stage)
							: "⏳"}
					</div>
					<p
						style={{
							fontSize: "1rem",
							fontWeight: "500",
							color: progressUpdates[progressUpdates.length - 1]?.metadata?.error
								? "rgba(239, 68, 68, 1)"
								: "white",
							margin: 0,
							flex: 1,
						}}
					>
						{currentMessage}
					</p>
				</div>
			</div>

			{/* Parallel Services Progress */}
			<div style={{ marginBottom: "1rem" }}>
				<h4
					style={{
						fontSize: "0.85rem",
						fontWeight: "600",
						color: "rgba(255, 255, 255, 0.9)",
						marginBottom: "0.5rem",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Data Services
				</h4>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
						gap: "0.4rem",
					}}
				>
					{PARALLEL_SERVICES.map((service) => {
						const progress = serviceProgress[service.id];
						const status = progress?.status || "pending";

						// Status colors
						const statusColors = {
							pending: { bg: "rgba(100, 100, 100, 0.2)", border: "rgba(150, 150, 150, 0.3)", text: "rgba(200, 200, 200, 0.6)" },
							in_progress: { bg: "rgba(99, 102, 241, 0.15)", border: "rgba(99, 102, 241, 0.4)", text: "rgba(99, 102, 241, 1)" },
							completed: { bg: "rgba(34, 197, 94, 0.15)", border: "rgba(34, 197, 94, 0.4)", text: "rgba(34, 197, 94, 1)" },
							failed: { bg: "rgba(239, 68, 68, 0.15)", border: "rgba(239, 68, 68, 0.4)", text: "rgba(239, 68, 68, 1)" },
						};

						const colors = statusColors[status];

						// Status icons
						const statusIcons = {
							pending: "⏳",
							in_progress: "🔄",
							completed: "✅",
							failed: "❌",
						};

						return (
							<div
								key={service.id}
								style={{
									background: colors.bg,
									border: `1px solid ${colors.border}`,
									borderRadius: "6px",
									padding: "0.4rem",
									display: "flex",
									flexDirection: "column",
									alignItems: "center",
									gap: "0.2rem",
									transition: "all 0.3s ease",
								}}
							>
								<div style={{ fontSize: "1rem" }}>
									{status === "in_progress" ? (
										<span style={{ display: "inline-block", animation: "spin 2s linear infinite" }}>
											{service.icon}
										</span>
									) : (
										service.icon
									)}
								</div>
								<div
									style={{
										fontSize: "0.7rem",
										fontWeight: "600",
										color: "white",
										textAlign: "center",
									}}
								>
									{service.name}
								</div>
								<div style={{ fontSize: "0.65rem", color: colors.text }}>
									{statusIcons[status]}
								</div>
							</div>
						);
					})}
				</div>
			</div>

			{/* Progress Log */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					minHeight: "400px",
					maxHeight: "500px",
					marginBottom: "1rem",
				}}
			>
				<h4
					style={{
						fontSize: "0.9rem",
						fontWeight: "600",
						color: "rgba(255, 255, 255, 0.9)",
						marginBottom: "0.75rem",
						textTransform: "uppercase",
						letterSpacing: "0.05em",
					}}
				>
					Activity Log
				</h4>
				<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
					{progressUpdates.map((update, index) => (
						<div
							key={index}
							style={{
								background: "rgba(255, 255, 255, 0.05)",
								border: "1px solid rgba(255, 255, 255, 0.1)",
								borderRadius: "8px",
								padding: "0.75rem",
								fontSize: "0.85rem",
								color: "rgba(255, 255, 255, 0.8)",
								display: "flex",
								alignItems: "center",
								gap: "0.5rem",
								animation: "fadeIn 0.3s ease-out",
							}}
						>
							<span style={{ fontSize: "1rem" }}>{getStageIcon(update.stage)}</span>
							<div style={{ flex: 1 }}>
								<div>{update.message}</div>
								{update.duration && (
									<div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.5)" }}>
										Completed in {formatTime(update.duration)}
									</div>
								)}
							</div>
							<span style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.4)" }}>
								{new Date(update.timestamp).toLocaleTimeString()}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Styles */}
			<style jsx>{`
				@keyframes spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}

				@keyframes pulse {
					0%,
					100% {
						opacity: 1;
					}
					50% {
						opacity: 0.5;
					}
				}

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
