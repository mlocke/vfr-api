"use client";

import { useState } from "react";
import { AnalysisResponse } from "./AnalysisEngineTest";
import StockRecommendationCard from "../StockRecommendationCard";

interface AnalysisResultsProps {
	results: AnalysisResponse | null;
	error: string | null;
	isRunning: boolean;
}

export default function AnalysisResults({ results, error, isRunning }: AnalysisResultsProps) {
	const [activeTab, setActiveTab] = useState<"summary" | "raw" | "performance" | "inputs">(
		"summary"
	);
	const [copySuccess, setCopySuccess] = useState(false);

	const handleCopyResults = async () => {
		if (!results) return;

		try {
			let textToCopy = "";

			if (activeTab === "summary") {
				if (results.success && results.data) {
					textToCopy = results.data.stocks
						.map(stock => {
							const score = stock.compositeScore
								? Math.round(stock.compositeScore)
								: "N/A";
							const recommendation = stock.recommendation || "N/A";
							const price = stock.price ? `$${stock.price.toFixed(2)}` : "N/A";
							return `${stock.symbol}: ${recommendation} (Score: ${score}/100, Price: ${price})`;
						})
						.join("\n");
				} else {
					textToCopy = `Error: ${results.error || "Unknown error"}`;
				}
			} else if (activeTab === "raw") {
				textToCopy = JSON.stringify(results, null, 2);
			} else if (activeTab === "performance") {
				if (results.success && results.data) {
					const metadata = results.data.metadata;
					textToCopy = `Analysis Performance:
Mode: ${metadata.mode}
Stocks Analyzed: ${metadata.count}
Timestamp: ${new Date(metadata.timestamp).toLocaleString()}
Sources: ${metadata.sources.join(", ")}
Technical Analysis: ${metadata.technicalAnalysisEnabled ? "Enabled" : "Disabled"}
Sentiment Analysis: ${metadata.sentimentAnalysisEnabled ? "Enabled" : "Disabled"}
Macroeconomic Analysis: ${metadata.macroeconomicAnalysisEnabled ? "Enabled" : "Disabled"}
ESG Analysis: ${metadata.esgAnalysisEnabled ? "Enabled" : "Disabled"}`;
				} else {
					textToCopy = "No performance data available";
				}
			} else if (activeTab === "inputs") {
				if (results.success && results.data?.metadata?.analysisInputServices) {
					const services = results.data.metadata.analysisInputServices;
					textToCopy = Object.entries(services)
						.map(([serviceName, service]: [string, any]) => {
							return `${serviceName.toUpperCase()}:
Status: ${service.status}
Description: ${service.description}
Utilization: ${service.utilizationInResults}
Weight: ${service.weightInCompositeScore || service.weightInTechnicalScore || "N/A"}
Components: ${Object.keys(service.components).length} components`;
						})
						.join("\n\n");
				} else {
					textToCopy = "No input services data available";
				}
			}

			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(textToCopy);
			} else {
				const textArea = document.createElement("textarea");
				textArea.value = textToCopy;
				document.body.appendChild(textArea);
				textArea.select();
				document.execCommand("copy");
				document.body.removeChild(textArea);
			}

			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		} catch (err) {
			console.error("Failed to copy to clipboard:", err);
		}
	};

	return (
		<div
			style={{
				background: "rgba(255, 255, 255, 0.05)",
				backdropFilter: "blur(10px)",
				border: "1px solid rgba(255, 255, 255, 0.1)",
				borderRadius: "16px",
				padding: "1.5rem",
				display: "flex",
				flexDirection: "column",
				height: "600px",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					marginBottom: "1.5rem",
				}}
			>
				<h3
					style={{
						fontSize: "1.2rem",
						fontWeight: "600",
						color: "white",
						margin: 0,
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					📊 Analysis Results
				</h3>
				{(results || error) && (
					<button
						onClick={handleCopyResults}
						style={{
							background: copySuccess
								? "rgba(34, 197, 94, 0.2)"
								: "rgba(255, 255, 255, 0.1)",
							border: copySuccess
								? "1px solid rgba(34, 197, 94, 0.4)"
								: "1px solid rgba(255, 255, 255, 0.2)",
							borderRadius: "6px",
							padding: "6px 8px",
							cursor: "pointer",
							transition: "all 0.3s ease",
							display: "flex",
							alignItems: "center",
							gap: "4px",
							fontSize: "12px",
							color: copySuccess
								? "rgba(34, 197, 94, 0.9)"
								: "rgba(255, 255, 255, 0.7)",
						}}
					>
						<svg
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							{copySuccess ? (
								<path d="M20 6L9 17l-5-5" />
							) : (
								<>
									<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
									<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
								</>
							)}
						</svg>
						{copySuccess ? "Copied!" : "Copy"}
					</button>
				)}
			</div>

			{/* Results Tabs */}
			{(results || error) && (
				<div
					style={{
						display: "flex",
						gap: "0.5rem",
						marginBottom: "1rem",
						flexShrink: 0,
					}}
				>
					{(["summary", "raw", "performance", "inputs"] as const).map(tab => (
						<button
							key={tab}
							onClick={() => setActiveTab(tab)}
							style={{
								padding: "0.5rem 1rem",
								background:
									activeTab === tab
										? "rgba(99, 102, 241, 0.3)"
										: "rgba(255, 255, 255, 0.1)",
								border:
									activeTab === tab
										? "1px solid rgba(99, 102, 241, 0.5)"
										: "1px solid rgba(255, 255, 255, 0.2)",
								borderRadius: "6px",
								color:
									activeTab === tab
										? "rgba(99, 102, 241, 0.9)"
										: "rgba(255, 255, 255, 0.7)",
								fontSize: "0.8rem",
								fontWeight: "500",
								cursor: "pointer",
								transition: "all 0.3s ease",
								textTransform: "capitalize",
							}}
						>
							{tab}
						</button>
					))}
				</div>
			)}

			{/* Results Content */}
			<div
				style={{
					flex: 1,
					overflowY: "auto",
					padding: "0.5rem",
				}}
			>
				{isRunning ? (
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							justifyContent: "center",
							height: "100%",
							color: "rgba(255, 255, 255, 0.6)",
							gap: "1rem",
						}}
					>
						<div
							style={{
								fontSize: "2rem",
								animation: "spin 1s linear infinite",
							}}
						>
							🔄
						</div>
						<p>Running comprehensive analysis...</p>
					</div>
				) : error ? (
					<div
						style={{
							background: "rgba(239, 68, 68, 0.1)",
							border: "1px solid rgba(239, 68, 68, 0.3)",
							borderRadius: "8px",
							padding: "1rem",
							color: "rgba(239, 68, 68, 0.9)",
						}}
					>
						<strong>❌ Analysis Failed</strong>
						<p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>{error}</p>
					</div>
				) : results ? (
					<>
						{activeTab === "summary" && results.success && results.data && (
							<div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
								{results.data.stocks.map((stock: any, index: number) => (
									<StockRecommendationCard
										key={stock.symbol}
										stock={{
											symbol: stock.symbol,
											price: stock.price,
											priceChange: stock.priceChange,
											priceChangePercent: stock.priceChangePercent,
											recommendation: stock.recommendation,
											confidence: stock.confidence,
											compositeScore: stock.compositeScore,
											sector: stock.sector,
											marketCap: stock.marketCap,
											technicalScore: stock.technicalScore,
											fundamentalScore: stock.fundamentalScore,
											macroScore: stock.macroeconomicScore,
											sentimentScore: stock.sentimentScore,
											esgScore: stock.esgScore,
											analystScore: stock.analystScore,
											insights: {
												positive:
													stock.insights?.positive || stock.strengths,
												risks: stock.insights?.risks || stock.risks,
											},
											reasoning: stock.reasoning || stock.rationale,
											early_signal: stock.early_signal,
										}}
									/>
								))}
							</div>
						)}

						{activeTab === "raw" && (
							<pre
								style={{
									fontSize: "0.75rem",
									color: "rgba(255, 255, 255, 0.8)",
									background: "rgba(0, 0, 0, 0.3)",
									padding: "1rem",
									borderRadius: "8px",
									overflow: "auto",
									whiteSpace: "pre-wrap",
									lineHeight: "1.4",
								}}
							>
								{JSON.stringify(results, null, 2)}
							</pre>
						)}

						{activeTab === "performance" && results.success && results.data && (
							<div style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "0.9rem" }}>
								<div style={{ marginBottom: "1rem" }}>
									<h5 style={{ color: "white", marginBottom: "0.5rem" }}>
										Analysis Metadata
									</h5>
									<p>Mode: {results.data.metadata.mode}</p>
									<p>Stocks Analyzed: {results.data.metadata.count}</p>
									<p>
										Timestamp:{" "}
										{new Date(results.data.metadata.timestamp).toLocaleString()}
									</p>
									<p>Data Sources: {results.data.metadata.sources.join(", ")}</p>
								</div>
								<div>
									<h5 style={{ color: "white", marginBottom: "0.5rem" }}>
										Enabled Analysis Components
									</h5>
									<p>
										Technical Analysis:{" "}
										{results.data.metadata.technicalAnalysisEnabled
											? "✅"
											: "❌"}
									</p>
									<p>
										Fundamental Data:{" "}
										{results.data.metadata.fundamentalDataEnabled ? "✅" : "❌"}
									</p>
									<p>
										Analyst Data:{" "}
										{results.data.metadata.analystDataEnabled ? "✅" : "❌"}
									</p>
									<p>
										Sentiment Analysis:{" "}
										{results.data.metadata.sentimentAnalysisEnabled
											? "✅"
											: "❌"}
									</p>
									<p>
										Macroeconomic Analysis:{" "}
										{results.data.metadata.macroeconomicAnalysisEnabled
											? "✅"
											: "❌"}
									</p>
									<p>
										ESG Analysis:{" "}
										{results.data.metadata.esgAnalysisEnabled ? "✅" : "❌"}
									</p>
									<p>
										Short Interest Analysis:{" "}
										{results.data.metadata.shortInterestAnalysisEnabled
											? "✅"
											: "❌"}
									</p>
								</div>
							</div>
						)}

						{activeTab === "inputs" &&
							results.success &&
							results.data?.metadata?.analysisInputServices && (
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "1.5rem",
									}}
								>
									<div style={{ marginBottom: "1rem" }}>
										<h4
											style={{
												color: "white",
												margin: "0 0 0.5rem 0",
												fontSize: "1rem",
											}}
										>
											🔬 Analysis Input Services Status
										</h4>
										<p
											style={{
												color: "rgba(255, 255, 255, 0.7)",
												fontSize: "0.85rem",
												margin: 0,
											}}
										>
											Comprehensive overview of all input services and their
											utilization in this analysis
										</p>
									</div>

									{Object.entries(
										results.data.metadata.analysisInputServices
									).map(([serviceName, service]: [string, any]) => (
										<div
											key={serviceName}
											style={{
												background: "rgba(255, 255, 255, 0.05)",
												border: `1px solid ${
													service.status === "active"
														? "rgba(34, 197, 94, 0.3)"
														: service.status === "unavailable"
															? "rgba(239, 68, 68, 0.3)"
															: "rgba(251, 191, 36, 0.3)"
												}`,
												borderRadius: "8px",
												padding: "1rem",
											}}
										>
											{/* Service Header */}
											<div
												style={{
													display: "flex",
													justifyContent: "space-between",
													alignItems: "center",
													marginBottom: "0.75rem",
												}}
											>
												<div>
													<h5
														style={{
															color: "white",
															margin: 0,
															fontSize: "0.95rem",
															fontWeight: "600",
															textTransform: "capitalize",
														}}
													>
														{serviceName
															.replace(/([A-Z])/g, " $1")
															.replace(/^./, str =>
																str.toUpperCase()
															)}
													</h5>
													<p
														style={{
															color: "rgba(255, 255, 255, 0.6)",
															fontSize: "0.8rem",
															margin: "0.25rem 0 0 0",
														}}
													>
														{service.description}
													</p>
												</div>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "0.75rem",
													}}
												>
													<span
														style={{
															background:
																service.status === "active"
																	? "rgba(34, 197, 94, 0.2)"
																	: service.status ===
																		  "unavailable"
																		? "rgba(239, 68, 68, 0.2)"
																		: "rgba(251, 191, 36, 0.2)",
															color:
																service.status === "active"
																	? "rgba(34, 197, 94, 0.9)"
																	: service.status ===
																		  "unavailable"
																		? "rgba(239, 68, 68, 0.9)"
																		: "rgba(251, 191, 36, 0.9)",
															padding: "0.25rem 0.5rem",
															borderRadius: "4px",
															fontSize: "0.75rem",
															fontWeight: "600",
															textTransform: "capitalize",
														}}
													>
														{service.status}
													</span>
													<span
														style={{
															color: "rgba(255, 255, 255, 0.8)",
															fontSize: "0.8rem",
															fontWeight: "500",
														}}
													>
														{service.utilizationInResults} used
													</span>
												</div>
											</div>

											{/* Service Weight */}
											{(service.weightInCompositeScore ||
												service.weightInTechnicalScore) && (
												<div style={{ marginBottom: "0.75rem" }}>
													<span
														style={{
															background: "rgba(99, 102, 241, 0.2)",
															color: "rgba(99, 102, 241, 0.9)",
															padding: "0.2rem 0.5rem",
															borderRadius: "4px",
															fontSize: "0.75rem",
															fontWeight: "500",
														}}
													>
														Weight:{" "}
														{service.weightInCompositeScore ||
															service.weightInTechnicalScore}
													</span>
												</div>
											)}

											{/* Service Components */}
											{Object.keys(service.components).length > 0 && (
												<div>
													<h6
														style={{
															color: "rgba(255, 255, 255, 0.9)",
															fontSize: "0.85rem",
															margin: "0 0 0.5rem 0",
															fontWeight: "500",
														}}
													>
														Components (
														{Object.keys(service.components).length})
													</h6>
													<div
														style={{
															display: "grid",
															gridTemplateColumns:
																"repeat(auto-fit, minmax(200px, 1fr))",
															gap: "0.5rem",
														}}
													>
														{Object.entries(service.components).map(
															([componentName, componentData]: [
																string,
																any,
															]) => (
																<div
																	key={componentName}
																	style={{
																		background:
																			"rgba(0, 0, 0, 0.2)",
																		border: "1px solid rgba(255, 255, 255, 0.1)",
																		borderRadius: "4px",
																		padding: "0.5rem",
																	}}
																>
																	<div
																		style={{
																			fontSize: "0.8rem",
																			fontWeight: "500",
																			color: "rgba(255, 255, 255, 0.9)",
																			marginBottom: "0.25rem",
																			textTransform:
																				"capitalize",
																		}}
																	>
																		{componentName.replace(
																			/([A-Z])/g,
																			" $1"
																		)}
																	</div>
																	<div
																		style={{
																			fontSize: "0.75rem",
																			color: "rgba(255, 255, 255, 0.6)",
																		}}
																	>
																		{typeof componentData ===
																		"object"
																			? Object.entries(
																					componentData
																				).map(
																					([key, value]: [
																						string,
																						any,
																					]) => (
																						<div
																							key={
																								key
																							}
																						>
																							<span
																								style={{
																									color: "rgba(255, 255, 255, 0.4)",
																								}}
																							>
																								{
																									key
																								}
																								:
																							</span>{" "}
																							{String(
																								value
																							)}
																						</div>
																					)
																				)
																			: String(componentData)}
																	</div>
																</div>
															)
														)}
													</div>
												</div>
											)}
										</div>
									))}
								</div>
							)}
					</>
				) : (
					<div
						style={{
							textAlign: "center",
							padding: "2rem 1rem",
							color: "rgba(255, 255, 255, 0.6)",
						}}
					>
						No analysis results yet. Configure your analysis above and click "Run Deep
						Analysis" to see results here.
					</div>
				)}
			</div>

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
