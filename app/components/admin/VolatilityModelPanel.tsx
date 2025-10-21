"use client";

import { useState, useEffect } from "react";

// Volatility prediction interfaces
interface VolatilityPrediction {
	symbol: string;
	predicted_volatility: number;
	confidence_level: "low" | "medium" | "high";
	risk_category: "very_low" | "low" | "moderate" | "high" | "extreme";
	prediction_horizon_days: number;
	timestamp: string;
	feature_completeness: number;
	reasoning: string;
}

interface VolatilityTestResult {
	symbol: string;
	success: boolean;
	prediction?: VolatilityPrediction;
	responseTime: number;
	error?: string;
	timestamp: number;
}

interface VolatilityModelStats {
	modelName: string;
	version: string;
	status: "active" | "deployed" | "inactive";
	performance: {
		r2_score: number;
		mae: number;
		rmse: number;
		training_samples: number;
	};
	featureCount: number;
	lastTrained?: string;
	predictionHorizon: string;
}

export default function VolatilityModelPanel() {
	// State management
	const [modelStats, setModelStats] = useState<VolatilityModelStats | null>(null);
	const [testResults, setTestResults] = useState<VolatilityTestResult[]>([]);
	const [isRunningTests, setIsRunningTests] = useState(false);
	const [selectedSymbols, setSelectedSymbols] = useState<string[]>(["AAPL", "TSLA", "NVDA"]);
	const [customSymbol, setCustomSymbol] = useState("");
	const [activeTab, setActiveTab] = useState<"overview" | "testing" | "predictions">("overview");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [autoRefresh, setAutoRefresh] = useState(false);

	// Predefined test symbols
	const testSymbols = [
		"AAPL",
		"MSFT",
		"GOOGL",
		"AMZN",
		"TSLA",
		"NVDA",
		"META",
		"NFLX",
		"AMD",
		"INTC",
	];

	// Load model statistics
	useEffect(() => {
		loadModelStats();
		if (autoRefresh) {
			const interval = setInterval(loadModelStats, 30000); // Refresh every 30 seconds
			return () => clearInterval(interval);
		}
	}, [autoRefresh]);

	const loadModelStats = async () => {
		try {
			// For now, use hardcoded stats from the integration guide
			// TODO: Create API endpoint /api/admin/ml-models/volatility-prediction
			setModelStats({
				modelName: "Volatility Prediction",
				version: "1.0.0",
				status: "deployed",
				performance: {
					r2_score: 0.7228,
					mae: 10.65,
					rmse: 18.13,
					training_samples: 3152776,
				},
				featureCount: 28,
				lastTrained: "2025-10-19",
				predictionHorizon: "21 days",
			});
			setError(null);
		} catch (error) {
			console.error("Failed to load model stats:", error);
			setError(error instanceof Error ? error.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	// Run prediction tests
	const handleRunTests = async () => {
		if (selectedSymbols.length === 0) return;

		setIsRunningTests(true);
		setTestResults([]);

		try {
			const results: VolatilityTestResult[] = [];

			// Test each symbol sequentially to avoid rate limiting
			for (const symbol of selectedSymbols) {
				const startTime = Date.now();

				try {
					const response = await fetch(`/api/ml/volatility-predict?symbol=${symbol}`, {
						method: "GET",
					});

					const responseTime = Date.now() - startTime;

					if (response.ok) {
						const prediction = await response.json();
						results.push({
							symbol,
							success: true,
							prediction,
							responseTime,
							timestamp: Date.now(),
						});
					} else {
						const errorData = await response.json();
						results.push({
							symbol,
							success: false,
							error: errorData.error || `HTTP ${response.status}`,
							responseTime,
							timestamp: Date.now(),
						});
					}
				} catch (error) {
					results.push({
						symbol,
						success: false,
						error: error instanceof Error ? error.message : "Request failed",
						responseTime: Date.now() - startTime,
						timestamp: Date.now(),
					});
				}

				// Update results progressively
				setTestResults([...results]);

				// Small delay to avoid overwhelming the API
				await new Promise(resolve => setTimeout(resolve, 300));
			}
		} catch (error) {
			console.error("Test execution failed:", error);
			setError(error instanceof Error ? error.message : "Test execution failed");
		} finally {
			setIsRunningTests(false);
		}
	};

	// Handle symbol selection
	const handleSymbolToggle = (symbol: string) => {
		setSelectedSymbols(prev =>
			prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]
		);
	};

	// Add custom symbol
	const handleAddCustomSymbol = () => {
		const normalized = customSymbol.trim().toUpperCase();
		if (normalized && /^[A-Z]{1,5}$/.test(normalized) && !selectedSymbols.includes(normalized)) {
			setSelectedSymbols(prev => [...prev, normalized]);
			setCustomSymbol("");
		}
	};

	// Helper functions
	const getRiskColor = (category: string) => {
		switch (category) {
			case "very_low":
				return "rgba(34, 197, 94, 0.8)"; // green
			case "low":
				return "rgba(132, 204, 22, 0.8)"; // lime
			case "moderate":
				return "rgba(251, 191, 36, 0.8)"; // yellow
			case "high":
				return "rgba(249, 115, 22, 0.8)"; // orange
			case "extreme":
				return "rgba(239, 68, 68, 0.8)"; // red
			default:
				return "rgba(156, 163, 175, 0.8)"; // gray
		}
	};

	const getConfidenceBadge = (level: string) => {
		switch (level) {
			case "high":
				return { color: "rgba(34, 197, 94, 0.9)", text: "High Confidence" };
			case "medium":
				return { color: "rgba(251, 191, 36, 0.9)", text: "Medium Confidence" };
			case "low":
				return { color: "rgba(239, 68, 68, 0.9)", text: "Low Confidence" };
			default:
				return { color: "rgba(156, 163, 175, 0.9)", text: "Unknown" };
		}
	};

	const formatDate = (timestamp: string | number) => {
		const date = typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
		return date.toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	if (loading) {
		return (
			<div
				style={{
					padding: "2rem",
					textAlign: "center",
					background: "rgba(255, 255, 255, 0.05)",
					borderRadius: "20px",
					margin: "2rem 0",
				}}
			>
				<div style={{ fontSize: "2rem", marginBottom: "1rem" }}>📊</div>
				<div style={{ color: "rgba(255, 255, 255, 0.8)" }}>
					Loading volatility model information...
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				background: "rgba(255, 255, 255, 0.08)",
				backdropFilter: "blur(10px)",
				border: "1px solid rgba(255, 255, 255, 0.15)",
				borderRadius: "20px",
				padding: "2rem",
				margin: "2rem 0",
				boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
			}}
		>
			{/* Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "2rem",
				}}
			>
				<h2
					style={{
						fontSize: "1.8rem",
						fontWeight: "700",
						color: "white",
						margin: 0,
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					📊 Volatility Prediction Model
				</h2>

				<div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							padding: "0.5rem 1rem",
							background:
								modelStats?.status === "deployed"
									? "rgba(34, 197, 94, 0.2)"
									: "rgba(156, 163, 175, 0.2)",
							border:
								modelStats?.status === "deployed"
									? "1px solid rgba(34, 197, 94, 0.4)"
									: "1px solid rgba(156, 163, 175, 0.4)",
							borderRadius: "8px",
							fontSize: "0.9rem",
							fontWeight: "600",
							color: modelStats?.status === "deployed" ? "rgba(34, 197, 94, 0.9)" : "white",
						}}
					>
						<span>{modelStats?.status === "deployed" ? "🟢" : "⚪"}</span>
						{modelStats?.status === "deployed" ? "Deployed" : "Inactive"}
					</div>
					<button
						onClick={() => setAutoRefresh(!autoRefresh)}
						style={{
							padding: "0.5rem 1rem",
							background: autoRefresh
								? "rgba(99, 102, 241, 0.3)"
								: "rgba(99, 102, 241, 0.2)",
							border: autoRefresh
								? "1px solid rgba(99, 102, 241, 0.5)"
								: "1px solid rgba(99, 102, 241, 0.4)",
							borderRadius: "8px",
							color: "rgba(99, 102, 241, 0.9)",
							fontSize: "0.9rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
						}}
					>
						{autoRefresh ? "🔄 Auto-refresh ON" : "⏸️ Auto-refresh OFF"}
					</button>
				</div>
			</div>

			{/* Error Display */}
			{error && (
				<div
					style={{
						background: "rgba(239, 68, 68, 0.1)",
						border: "1px solid rgba(239, 68, 68, 0.3)",
						borderRadius: "8px",
						padding: "1rem",
						marginBottom: "1rem",
						color: "rgba(239, 68, 68, 0.9)",
					}}
				>
					❌ {error}
				</div>
			)}

			{/* Tabs */}
			<div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
				{(["overview", "testing", "predictions"] as const).map(tab => (
					<button
						key={tab}
						onClick={() => setActiveTab(tab)}
						style={{
							padding: "0.75rem 1.5rem",
							background:
								activeTab === tab
									? "rgba(99, 102, 241, 0.3)"
									: "rgba(255, 255, 255, 0.1)",
							border:
								activeTab === tab
									? "1px solid rgba(99, 102, 241, 0.5)"
									: "1px solid rgba(255, 255, 255, 0.2)",
							borderRadius: "8px",
							color:
								activeTab === tab
									? "rgba(255, 255, 255, 0.95)"
									: "rgba(255, 255, 255, 0.7)",
							fontSize: "0.9rem",
							fontWeight: "600",
							cursor: "pointer",
							transition: "all 0.3s ease",
							textTransform: "capitalize",
						}}
					>
						{tab}
					</button>
				))}
			</div>

			{/* Overview Tab */}
			{activeTab === "overview" && modelStats && (
				<div>
					{/* Model Information Grid */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
							gap: "1.5rem",
							marginBottom: "2rem",
						}}
					>
						{/* Model Version */}
						<div
							style={{
								background: "rgba(99, 102, 241, 0.1)",
								border: "1px solid rgba(99, 102, 241, 0.3)",
								borderRadius: "12px",
								padding: "1.5rem",
							}}
						>
							<div
								style={{
									fontSize: "0.85rem",
									color: "rgba(255, 255, 255, 0.6)",
									marginBottom: "0.5rem",
								}}
							>
								Model Version
							</div>
							<div style={{ fontSize: "1.5rem", fontWeight: "700", color: "white" }}>
								v{modelStats.version}
							</div>
							<div
								style={{
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.7)",
									marginTop: "0.5rem",
								}}
							>
								{modelStats.featureCount} features
							</div>
						</div>

						{/* R² Score */}
						<div
							style={{
								background: "rgba(34, 197, 94, 0.1)",
								border: "1px solid rgba(34, 197, 94, 0.3)",
								borderRadius: "12px",
								padding: "1.5rem",
							}}
						>
							<div
								style={{
									fontSize: "0.85rem",
									color: "rgba(255, 255, 255, 0.6)",
									marginBottom: "0.5rem",
								}}
							>
								R² Score
							</div>
							<div
								style={{
									fontSize: "1.5rem",
									fontWeight: "700",
									color: "rgba(34, 197, 94, 0.9)",
								}}
							>
								{(modelStats.performance.r2_score * 100).toFixed(1)}%
							</div>
							<div
								style={{
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.7)",
									marginTop: "0.5rem",
								}}
							>
								Target: {">"}65% ✅
							</div>
						</div>

						{/* MAE */}
						<div
							style={{
								background: "rgba(251, 191, 36, 0.1)",
								border: "1px solid rgba(251, 191, 36, 0.3)",
								borderRadius: "12px",
								padding: "1.5rem",
							}}
						>
							<div
								style={{
									fontSize: "0.85rem",
									color: "rgba(255, 255, 255, 0.6)",
									marginBottom: "0.5rem",
								}}
							>
								Mean Absolute Error
							</div>
							<div
								style={{
									fontSize: "1.5rem",
									fontWeight: "700",
									color: "rgba(251, 191, 36, 0.9)",
								}}
							>
								{modelStats.performance.mae.toFixed(2)}%
							</div>
							<div
								style={{
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.7)",
									marginTop: "0.5rem",
								}}
							>
								Target: {"<"}5% (MVP acceptable)
							</div>
						</div>

						{/* Training Samples */}
						<div
							style={{
								background: "rgba(168, 85, 247, 0.1)",
								border: "1px solid rgba(168, 85, 247, 0.3)",
								borderRadius: "12px",
								padding: "1.5rem",
							}}
						>
							<div
								style={{
									fontSize: "0.85rem",
									color: "rgba(255, 255, 255, 0.6)",
									marginBottom: "0.5rem",
								}}
							>
								Training Samples
							</div>
							<div
								style={{
									fontSize: "1.5rem",
									fontWeight: "700",
									color: "rgba(168, 85, 247, 0.9)",
								}}
							>
								{(modelStats.performance.training_samples / 1000000).toFixed(2)}M
							</div>
							<div
								style={{
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.7)",
									marginTop: "0.5rem",
								}}
							>
								Horizon: {modelStats.predictionHorizon}
							</div>
						</div>
					</div>

					{/* Model Details */}
					<div
						style={{
							background: "rgba(255, 255, 255, 0.05)",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "12px",
							padding: "1.5rem",
						}}
					>
						<h3
							style={{
								fontSize: "1.2rem",
								fontWeight: "600",
								color: "white",
								marginBottom: "1rem",
							}}
						>
							📋 Model Details
						</h3>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "200px 1fr",
								gap: "1rem",
								fontSize: "0.9rem",
								color: "rgba(255, 255, 255, 0.8)",
							}}
						>
							<div style={{ fontWeight: "600" }}>Model Type:</div>
							<div>LightGBM Regression</div>

							<div style={{ fontWeight: "600" }}>Feature Count:</div>
							<div>{modelStats.featureCount} (Volatility, Price, Volume, Smart Money, Macro)</div>

							<div style={{ fontWeight: "600" }}>Prediction Horizon:</div>
							<div>{modelStats.predictionHorizon} forward volatility</div>

							<div style={{ fontWeight: "600" }}>RMSE:</div>
							<div>{modelStats.performance.rmse.toFixed(2)}%</div>

							<div style={{ fontWeight: "600" }}>Last Trained:</div>
							<div>{modelStats.lastTrained || "Unknown"}</div>

							<div style={{ fontWeight: "600" }}>Status:</div>
							<div style={{ textTransform: "capitalize", fontWeight: "600" }}>
								{modelStats.status}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Testing Tab */}
			{activeTab === "testing" && (
				<div>
					{/* Symbol Selection */}
					<div
						style={{
							background: "rgba(255, 255, 255, 0.05)",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "12px",
							padding: "1.5rem",
							marginBottom: "2rem",
						}}
					>
						<h3
							style={{
								fontSize: "1.2rem",
								fontWeight: "600",
								color: "white",
								marginBottom: "1rem",
							}}
						>
							🎯 Select Test Symbols
						</h3>

						{/* Predefined Symbols */}
						<div
							style={{
								display: "flex",
								flexWrap: "wrap",
								gap: "0.5rem",
								marginBottom: "1rem",
							}}
						>
							{testSymbols.map(symbol => (
								<button
									key={symbol}
									onClick={() => handleSymbolToggle(symbol)}
									style={{
										padding: "0.5rem 1rem",
										background: selectedSymbols.includes(symbol)
											? "rgba(99, 102, 241, 0.3)"
											: "rgba(255, 255, 255, 0.1)",
										border: selectedSymbols.includes(symbol)
											? "1px solid rgba(99, 102, 241, 0.5)"
											: "1px solid rgba(255, 255, 255, 0.2)",
										borderRadius: "6px",
										color: "white",
										fontSize: "0.9rem",
										fontWeight: "500",
										cursor: "pointer",
										transition: "all 0.3s ease",
									}}
								>
									{symbol}
								</button>
							))}
						</div>

						{/* Custom Symbol Input */}
						<div style={{ display: "flex", gap: "0.5rem" }}>
							<input
								type="text"
								value={customSymbol}
								onChange={e => setCustomSymbol(e.target.value)}
								onKeyPress={e => e.key === "Enter" && handleAddCustomSymbol()}
								placeholder="Add custom symbol (e.g., AAPL)"
								style={{
									flex: 1,
									padding: "0.75rem",
									background: "rgba(255, 255, 255, 0.1)",
									border: "1px solid rgba(255, 255, 255, 0.2)",
									borderRadius: "8px",
									color: "white",
									fontSize: "0.9rem",
									outline: "none",
								}}
							/>
							<button
								onClick={handleAddCustomSymbol}
								style={{
									padding: "0.75rem 1.5rem",
									background: "rgba(99, 102, 241, 0.2)",
									border: "1px solid rgba(99, 102, 241, 0.4)",
									borderRadius: "8px",
									color: "rgba(99, 102, 241, 0.9)",
									fontSize: "0.9rem",
									fontWeight: "600",
									cursor: "pointer",
								}}
							>
								Add
							</button>
						</div>

						{/* Selected Count */}
						<div
							style={{
								marginTop: "1rem",
								fontSize: "0.9rem",
								color: "rgba(255, 255, 255, 0.7)",
							}}
						>
							{selectedSymbols.length} symbol{selectedSymbols.length !== 1 ? "s" : ""} selected
						</div>
					</div>

					{/* Run Tests Button */}
					<button
						onClick={handleRunTests}
						disabled={selectedSymbols.length === 0 || isRunningTests}
						style={{
							width: "100%",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							gap: "0.75rem",
							background:
								selectedSymbols.length > 0 && !isRunningTests
									? "linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(59, 130, 246, 0.9))"
									: "rgba(100, 100, 100, 0.3)",
							color: "white",
							padding: "1rem 2rem",
							border: "none",
							borderRadius: "12px",
							fontSize: "1.1rem",
							fontWeight: "600",
							cursor: selectedSymbols.length > 0 && !isRunningTests ? "pointer" : "not-allowed",
							transition: "all 0.3s ease",
							boxShadow:
								selectedSymbols.length > 0 && !isRunningTests
									? "0 8px 25px rgba(99, 102, 241, 0.4)"
									: "0 4px 15px rgba(0, 0, 0, 0.2)",
							marginBottom: "2rem",
						}}
					>
						{isRunningTests ? (
							<>
								<span style={{ animation: "spin 1s linear infinite", fontSize: "1.2rem" }}>
									🔄
								</span>
								Testing {selectedSymbols.length} symbols...
							</>
						) : (
							<>
								<span style={{ fontSize: "1.2rem" }}>🚀</span>
								Run Volatility Tests ({selectedSymbols.length} symbols)
							</>
						)}
					</button>

					{/* Test Results */}
					{testResults.length > 0 && (
						<div
							style={{
								background: "rgba(255, 255, 255, 0.05)",
								border: "1px solid rgba(255, 255, 255, 0.1)",
								borderRadius: "12px",
								padding: "1.5rem",
							}}
						>
							<h3
								style={{
									fontSize: "1.2rem",
									fontWeight: "600",
									color: "white",
									marginBottom: "1rem",
								}}
							>
								📊 Test Results
							</h3>

							<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								{testResults.map(result => (
									<div
										key={result.symbol}
										style={{
											background: result.success
												? "rgba(34, 197, 94, 0.05)"
												: "rgba(239, 68, 68, 0.05)",
											border: result.success
												? "1px solid rgba(34, 197, 94, 0.3)"
												: "1px solid rgba(239, 68, 68, 0.3)",
											borderRadius: "8px",
											padding: "1rem",
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
											<div
												style={{
													fontSize: "1.1rem",
													fontWeight: "600",
													color: "white",
												}}
											>
												{result.symbol}
											</div>
											<div
												style={{
													fontSize: "0.85rem",
													color: "rgba(255, 255, 255, 0.6)",
												}}
											>
												{result.responseTime}ms
											</div>
										</div>

										{result.success && result.prediction ? (
											<div
												style={{
													display: "grid",
													gridTemplateColumns: "1fr 1fr",
													gap: "0.75rem",
													fontSize: "0.85rem",
												}}
											>
												<div>
													<div
														style={{
															color: "rgba(255, 255, 255, 0.5)",
															marginBottom: "0.25rem",
														}}
													>
														Predicted Volatility
													</div>
													<div
														style={{
															fontSize: "1.2rem",
															fontWeight: "700",
															color: getRiskColor(result.prediction.risk_category),
														}}
													>
														{result.prediction.predicted_volatility.toFixed(1)}%
													</div>
												</div>

												<div>
													<div
														style={{
															color: "rgba(255, 255, 255, 0.5)",
															marginBottom: "0.25rem",
														}}
													>
														Risk Category
													</div>
													<div
														style={{
															fontSize: "0.9rem",
															fontWeight: "600",
															color: getRiskColor(result.prediction.risk_category),
															textTransform: "capitalize",
														}}
													>
														{result.prediction.risk_category.replace("_", " ")}
													</div>
												</div>

												<div>
													<div
														style={{
															color: "rgba(255, 255, 255, 0.5)",
															marginBottom: "0.25rem",
														}}
													>
														Confidence
													</div>
													<div
														style={{
															fontSize: "0.9rem",
															fontWeight: "600",
															color: getConfidenceBadge(result.prediction.confidence_level)
																.color,
														}}
													>
														{getConfidenceBadge(result.prediction.confidence_level).text}
													</div>
												</div>

												<div>
													<div
														style={{
															color: "rgba(255, 255, 255, 0.5)",
															marginBottom: "0.25rem",
														}}
													>
														Feature Completeness
													</div>
													<div
														style={{
															fontSize: "0.9rem",
															fontWeight: "600",
															color: "rgba(255, 255, 255, 0.8)",
														}}
													>
														{(result.prediction.feature_completeness * 100).toFixed(0)}%
													</div>
												</div>

												<div style={{ gridColumn: "1 / -1" }}>
													<div
														style={{
															color: "rgba(255, 255, 255, 0.5)",
															marginBottom: "0.25rem",
														}}
													>
														Reasoning
													</div>
													<div
														style={{
															fontSize: "0.85rem",
															color: "rgba(255, 255, 255, 0.8)",
															lineHeight: "1.4",
														}}
													>
														{result.prediction.reasoning}
													</div>
												</div>
											</div>
										) : (
											<div
												style={{
													color: "rgba(239, 68, 68, 0.9)",
													fontSize: "0.9rem",
												}}
											>
												❌ {result.error || "Prediction failed"}
											</div>
										)}
									</div>
								))}
							</div>

							{/* Summary */}
							<div
								style={{
									marginTop: "1.5rem",
									padding: "1rem",
									background: "rgba(0, 0, 0, 0.2)",
									borderRadius: "8px",
									display: "grid",
									gridTemplateColumns: "1fr 1fr 1fr",
									gap: "1rem",
									fontSize: "0.9rem",
									color: "rgba(255, 255, 255, 0.8)",
								}}
							>
								<div>
									✅ Success: {testResults.filter(r => r.success).length}
								</div>
								<div>❌ Failed: {testResults.filter(r => !r.success).length}</div>
								<div>
									⚡ Avg Time:{" "}
									{Math.round(
										testResults.reduce((sum, r) => sum + r.responseTime, 0) /
											testResults.length
									)}
									ms
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* Predictions Tab */}
			{activeTab === "predictions" && (
				<div
					style={{
						textAlign: "center",
						padding: "3rem",
						color: "rgba(255, 255, 255, 0.6)",
					}}
				>
					<div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📈</div>
					<div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
						Live Predictions Dashboard
					</div>
					<div style={{ fontSize: "0.9rem" }}>
						This feature will display real-time volatility predictions and historical trends.
					</div>
					<div style={{ fontSize: "0.85rem", marginTop: "1rem", fontStyle: "italic" }}>
						Coming soon in Phase 2...
					</div>
				</div>
			)}

			{/* CSS for animations */}
			<style jsx>{`
				@keyframes spin {
					from {
						transform: rotate(0deg);
					}
					to {
						transform: rotate(360deg);
					}
				}
			`}</style>
		</div>
	);
}
