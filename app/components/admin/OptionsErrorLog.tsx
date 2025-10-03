"use client";

import React, { useState, useMemo } from "react";

/**
 * OptionsErrorLog - Error tracking and troubleshooting display
 * Provides actionable error information and debugging guidance
 */

interface OptionsTestResult {
	testType: string;
	symbol: string;
	provider: string;
	success: boolean;
	duration: number;
	results: {
		totalAnalysisDuration?: number;
		analysisSuccess?: boolean;
		meetsTarget?: boolean;
		performance?: any;
		memoryDeltaMB?: number;
		hitRatio?: number;
		successRate?: number;
		throughput?: number;
	};
	summary: {
		status: "PASS" | "FAIL";
		efficiency: string;
		targetMet: boolean;
		recommendations: string[];
	};
	timestamp: number;
}

interface OptionsError {
	id: string;
	type:
		| "performance"
		| "connectivity"
		| "data_quality"
		| "rate_limit"
		| "security"
		| "configuration";
	severity: "low" | "medium" | "high" | "critical";
	message: string;
	details: string;
	testResult: OptionsTestResult;
	possibleCauses: string[];
	troubleshootingSteps: string[];
	relatedEndpoints: string[];
	estimatedFixTime: string;
	autoResolvable: boolean;
	timestamp: number;
}

interface OptionsErrorLogProps {
	testResults: OptionsTestResult[];
}

export default function OptionsErrorLog({ testResults }: OptionsErrorLogProps) {
	const [selectedError, setSelectedError] = useState<OptionsError | null>(null);
	const [filterSeverity, setFilterSeverity] = useState<string>("all");
	const [filterType, setFilterType] = useState<string>("all");

	// Generate errors from failed test results
	const errors = useMemo(() => {
		const generatedErrors: OptionsError[] = [];

		testResults.forEach((result, index) => {
			if (!result.success || result.summary.status === "FAIL") {
				const error = generateErrorFromResult(result, index);
				if (error) {
					generatedErrors.push(error);
				}
			}

			// Generate performance warnings for slow tests
			if (result.success && result.duration > 800) {
				const perfError = generatePerformanceWarning(result, index);
				if (perfError) {
					generatedErrors.push(perfError);
				}
			}

			// Generate efficiency warnings
			if (result.success && !result.summary.targetMet) {
				const effError = generateEfficiencyWarning(result, index);
				if (effError) {
					generatedErrors.push(effError);
				}
			}
		});

		return generatedErrors.sort((a, b) => b.timestamp - a.timestamp);
	}, [testResults]);

	function generateErrorFromResult(
		result: OptionsTestResult,
		index: number
	): OptionsError | null {
		// Determine error type based on test results and symptoms
		let errorType: OptionsError["type"] = "connectivity";
		let severity: OptionsError["severity"] = "medium";
		let message = "Test execution failed";
		let details = `${result.testType} test failed for ${result.symbol} using ${result.provider}`;
		let possibleCauses: string[] = [];
		let troubleshootingSteps: string[] = [];

		// Analyze failure patterns
		if (result.duration > 5000) {
			errorType = "performance";
			severity = "high";
			message = "Test execution timeout or severe performance degradation";
			details = `Test took ${result.duration.toFixed(0)}ms, significantly exceeding expected timeouts`;
			possibleCauses = [
				"API provider rate limiting",
				"Network connectivity issues",
				"Server resource constraints",
				"Database query performance",
				"Large options chain processing",
			];
			troubleshootingSteps = [
				"Check API provider status page",
				"Verify network connectivity to EODHD servers",
				"Monitor server CPU and memory usage",
				"Review recent configuration changes",
				"Test with simpler symbols (e.g., SPY vs complex earnings plays)",
			];
		} else if (result.provider === "unicornbay" && !result.success) {
			errorType = "data_quality";
			severity = "high";
			message = "UnicornBay enhanced features unavailable";
			details =
				"Enhanced options features failed to load, falling back to standard data may be required";
			possibleCauses = [
				"UnicornBay service temporarily unavailable",
				"API key restrictions or quota exceeded",
				"Symbol not supported by UnicornBay enhanced features",
				"Market hours restrictions",
			];
			troubleshootingSteps = [
				"Verify UnicornBay service status",
				"Check API quota usage in admin dashboard",
				"Test with known supported symbols (AAPL, TSLA, SPY)",
				"Retry during market hours",
				"Fallback to standard options analysis",
			];
		} else if (
			result.testType === "cache" &&
			result.results.hitRatio &&
			result.results.hitRatio < 50
		) {
			errorType = "configuration";
			severity = "medium";
			message = "Cache performance below optimal levels";
			details = `Cache hit ratio of ${result.results.hitRatio}% is below 85% target`;
			possibleCauses = [
				"Redis connection issues",
				"Cache TTL configuration too low",
				"Memory pressure causing cache eviction",
				"Cache warming not functioning properly",
			];
			troubleshootingSteps = [
				"Verify Redis connectivity and memory usage",
				"Review cache TTL settings for options data",
				"Monitor cache eviction rates",
				"Implement cache warming for popular symbols",
			];
		} else if (
			result.testType === "memory" &&
			result.results.memoryDeltaMB &&
			result.results.memoryDeltaMB > 5
		) {
			errorType = "performance";
			severity = "high";
			message = "Memory usage exceeds acceptable limits";
			details = `Memory usage of ${result.results.memoryDeltaMB.toFixed(1)}MB exceeds 2MB target`;
			possibleCauses = [
				"Large options chains not being compressed",
				"Memory leaks in processing algorithms",
				"Insufficient garbage collection",
				"Inefficient data structures",
			];
			troubleshootingSteps = [
				"Enable options chain compression for large datasets",
				"Force garbage collection between tests",
				"Profile memory usage patterns",
				"Optimize data structures and processing algorithms",
			];
		}

		const relatedEndpoints = [
			"/api/admin/options-performance",
			"/api/stocks/analyze",
			"/admin",
		];

		if (result.provider === "unicornbay") {
			relatedEndpoints.push("/api/options/unicornbay/*");
		}

		return {
			id: `error_${result.timestamp}_${index}`,
			type: errorType,
			severity,
			message,
			details,
			testResult: result,
			possibleCauses,
			troubleshootingSteps,
			relatedEndpoints,
			estimatedFixTime: getEstimatedFixTime(errorType, severity),
			autoResolvable: isAutoResolvable(errorType),
			timestamp: result.timestamp,
		};
	}

	function generatePerformanceWarning(
		result: OptionsTestResult,
		index: number
	): OptionsError | null {
		return {
			id: `perf_warning_${result.timestamp}_${index}`,
			type: "performance",
			severity: "low",
			message: "Performance slower than optimal",
			details: `Test completed in ${result.duration.toFixed(0)}ms, which is functional but could be optimized`,
			testResult: result,
			possibleCauses: [
				"Network latency variations",
				"API provider response time fluctuations",
				"Server load during testing",
				"Suboptimal caching patterns",
			],
			troubleshootingSteps: [
				"Monitor trends over multiple tests",
				"Test during different times of day",
				"Review caching configuration",
				"Consider pre-warming frequently accessed data",
			],
			relatedEndpoints: ["/api/admin/options-performance"],
			estimatedFixTime: "5-15 minutes",
			autoResolvable: true,
			timestamp: result.timestamp,
		};
	}

	function generateEfficiencyWarning(
		result: OptionsTestResult,
		index: number
	): OptionsError | null {
		return {
			id: `eff_warning_${result.timestamp}_${index}`,
			type: "performance",
			severity: "medium",
			message: "Target performance metrics not met",
			details: `Test passed but did not meet optimal performance targets (efficiency: ${result.summary.efficiency})`,
			testResult: result,
			possibleCauses: [
				"Performance targets may be too aggressive",
				"System under higher than normal load",
				"Recent configuration changes affecting performance",
				"API provider rate limiting",
			],
			troubleshootingSteps: [
				"Review performance target appropriateness",
				"Monitor system resource usage",
				"Compare with historical performance baselines",
				"Consider adjusting targets based on real-world conditions",
			],
			relatedEndpoints: ["/api/admin/options-performance"],
			estimatedFixTime: "10-30 minutes",
			autoResolvable: false,
			timestamp: result.timestamp,
		};
	}

	function getEstimatedFixTime(
		type: OptionsError["type"],
		severity: OptionsError["severity"]
	): string {
		const timeMatrix = {
			performance: {
				low: "5-15 min",
				medium: "15-30 min",
				high: "30-60 min",
				critical: "60+ min",
			},
			connectivity: {
				low: "2-5 min",
				medium: "5-15 min",
				high: "15-30 min",
				critical: "30+ min",
			},
			data_quality: {
				low: "10-20 min",
				medium: "20-45 min",
				high: "45-90 min",
				critical: "90+ min",
			},
			rate_limit: {
				low: "15-30 min",
				medium: "30-60 min",
				high: "60+ min",
				critical: "120+ min",
			},
			security: {
				low: "5-10 min",
				medium: "10-30 min",
				high: "30-60 min",
				critical: "60+ min",
			},
			configuration: {
				low: "5-15 min",
				medium: "15-45 min",
				high: "45-90 min",
				critical: "90+ min",
			},
		};

		return timeMatrix[type]?.[severity] || "15-30 min";
	}

	function isAutoResolvable(type: OptionsError["type"]): boolean {
		return ["performance", "rate_limit"].includes(type);
	}

	function getSeverityColor(severity: OptionsError["severity"]): string {
		switch (severity) {
			case "low":
				return "rgba(34, 197, 94, 0.8)";
			case "medium":
				return "rgba(251, 191, 36, 0.8)";
			case "high":
				return "rgba(245, 158, 11, 0.8)";
			case "critical":
				return "rgba(239, 68, 68, 0.8)";
			default:
				return "rgba(99, 102, 241, 0.8)";
		}
	}

	function getTypeIcon(type: OptionsError["type"]): string {
		switch (type) {
			case "performance":
				return "⚡";
			case "connectivity":
				return "🌐";
			case "data_quality":
				return "📊";
			case "rate_limit":
				return "🚦";
			case "security":
				return "🔒";
			case "configuration":
				return "⚙️";
			default:
				return "⚠️";
		}
	}

	// Filter errors based on selection
	const filteredErrors = errors.filter(error => {
		if (filterSeverity !== "all" && error.severity !== filterSeverity) return false;
		if (filterType !== "all" && error.type !== filterType) return false;
		return true;
	});

	if (errors.length === 0) {
		return (
			<div>
				<h3
					style={{
						fontSize: "1.2rem",
						fontWeight: "600",
						color: "white",
						marginBottom: "1.5rem",
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					⚠️ Error Log & Troubleshooting
				</h3>

				<div
					style={{
						textAlign: "center",
						padding: "3rem 1rem",
						color: "rgba(255, 255, 255, 0.6)",
						background: "rgba(34, 197, 94, 0.05)",
						borderRadius: "12px",
						border: "1px solid rgba(34, 197, 94, 0.2)",
					}}
				>
					<div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
					<div style={{ fontSize: "1.1rem", marginBottom: "0.5rem" }}>
						No errors or issues detected
					</div>
					<div style={{ fontSize: "0.9rem" }}>All tests are running successfully</div>
				</div>
			</div>
		);
	}

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
				⚠️ Error Log & Troubleshooting
			</h3>

			{/* Error Statistics */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
					gap: "1rem",
					marginBottom: "1.5rem",
				}}
			>
				{(["critical", "high", "medium", "low"] as const).map(severity => {
					const count = errors.filter(e => e.severity === severity).length;
					return (
						<div
							key={severity}
							style={{
								padding: "0.75rem",
								background: `${getSeverityColor(severity)}15`,
								border: `1px solid ${getSeverityColor(severity)}40`,
								borderRadius: "8px",
								textAlign: "center",
							}}
						>
							<div
								style={{
									fontSize: "1.5rem",
									fontWeight: "700",
									color: getSeverityColor(severity),
								}}
							>
								{count}
							</div>
							<div
								style={{
									fontSize: "0.75rem",
									color: "rgba(255, 255, 255, 0.7)",
									textTransform: "uppercase",
								}}
							>
								{severity}
							</div>
						</div>
					);
				})}
			</div>

			{/* Filters */}
			<div
				style={{
					display: "flex",
					gap: "1rem",
					marginBottom: "1.5rem",
					flexWrap: "wrap",
				}}
			>
				<div>
					<label
						style={{
							fontSize: "0.8rem",
							color: "rgba(255, 255, 255, 0.7)",
							marginBottom: "0.25rem",
							display: "block",
						}}
					>
						Filter by Severity
					</label>
					<select
						value={filterSeverity}
						onChange={e => setFilterSeverity(e.target.value)}
						style={{
							padding: "0.5rem",
							background: "rgba(255, 255, 255, 0.1)",
							border: "1px solid rgba(255, 255, 255, 0.2)",
							borderRadius: "6px",
							color: "white",
							fontSize: "0.8rem",
							outline: "none",
							cursor: "pointer",
						}}
					>
						<option value="all" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
							All Severities
						</option>
						<option
							value="critical"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Critical
						</option>
						<option value="high" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
							High
						</option>
						<option
							value="medium"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Medium
						</option>
						<option value="low" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
							Low
						</option>
					</select>
				</div>

				<div>
					<label
						style={{
							fontSize: "0.8rem",
							color: "rgba(255, 255, 255, 0.7)",
							marginBottom: "0.25rem",
							display: "block",
						}}
					>
						Filter by Type
					</label>
					<select
						value={filterType}
						onChange={e => setFilterType(e.target.value)}
						style={{
							padding: "0.5rem",
							background: "rgba(255, 255, 255, 0.1)",
							border: "1px solid rgba(255, 255, 255, 0.2)",
							borderRadius: "6px",
							color: "white",
							fontSize: "0.8rem",
							outline: "none",
							cursor: "pointer",
						}}
					>
						<option value="all" style={{ backgroundColor: "#1a1a1a", color: "white" }}>
							All Types
						</option>
						<option
							value="performance"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Performance
						</option>
						<option
							value="connectivity"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Connectivity
						</option>
						<option
							value="data_quality"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Data Quality
						</option>
						<option
							value="rate_limit"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Rate Limiting
						</option>
						<option
							value="configuration"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Configuration
						</option>
						<option
							value="security"
							style={{ backgroundColor: "#1a1a1a", color: "white" }}
						>
							Security
						</option>
					</select>
				</div>
			</div>

			{/* Error List */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: selectedError ? "1fr 1fr" : "1fr",
					gap: "1.5rem",
				}}
			>
				{/* Error List Panel */}
				<div>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
						{filteredErrors.map(error => (
							<div
								key={error.id}
								onClick={() => setSelectedError(error)}
								style={{
									padding: "1rem",
									background:
										selectedError?.id === error.id
											? "rgba(99, 102, 241, 0.1)"
											: "rgba(255, 255, 255, 0.05)",
									border:
										selectedError?.id === error.id
											? "1px solid rgba(99, 102, 241, 0.4)"
											: "1px solid rgba(255, 255, 255, 0.1)",
									borderRadius: "8px",
									cursor: "pointer",
									transition: "all 0.3s ease",
								}}
								onMouseEnter={e => {
									if (selectedError?.id !== error.id) {
										e.currentTarget.style.background =
											"rgba(255, 255, 255, 0.08)";
									}
								}}
								onMouseLeave={e => {
									if (selectedError?.id !== error.id) {
										e.currentTarget.style.background =
											"rgba(255, 255, 255, 0.05)";
									}
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
										marginBottom: "0.5rem",
									}}
								>
									<div
										style={{
											display: "flex",
											alignItems: "center",
											gap: "0.5rem",
											fontSize: "0.9rem",
											fontWeight: "600",
											color: getSeverityColor(error.severity),
										}}
									>
										{getTypeIcon(error.type)} {error.message}
									</div>
									<div
										style={{
											fontSize: "0.7rem",
											background: `${getSeverityColor(error.severity)}20`,
											color: getSeverityColor(error.severity),
											padding: "0.25rem 0.5rem",
											borderRadius: "12px",
											fontWeight: "600",
											textTransform: "uppercase",
										}}
									>
										{error.severity}
									</div>
								</div>

								<div
									style={{
										fontSize: "0.8rem",
										color: "rgba(255, 255, 255, 0.7)",
										marginBottom: "0.5rem",
									}}
								>
									{error.details}
								</div>

								<div
									style={{
										display: "flex",
										justifyContent: "space-between",
										alignItems: "center",
										fontSize: "0.75rem",
										color: "rgba(255, 255, 255, 0.6)",
									}}
								>
									<span>
										{error.testResult.testType} • {error.testResult.symbol} •{" "}
										{error.testResult.provider}
									</span>
									<span>{new Date(error.timestamp).toLocaleTimeString()}</span>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Error Details Panel */}
				{selectedError && (
					<div
						style={{
							padding: "1.5rem",
							background: "rgba(255, 255, 255, 0.05)",
							borderRadius: "12px",
							border: "1px solid rgba(255, 255, 255, 0.1)",
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
							<h4
								style={{
									fontSize: "1.1rem",
									fontWeight: "600",
									color: "white",
									margin: 0,
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
								}}
							>
								{getTypeIcon(selectedError.type)} Troubleshooting Guide
							</h4>
							<button
								onClick={() => setSelectedError(null)}
								style={{
									background: "rgba(255, 255, 255, 0.1)",
									border: "1px solid rgba(255, 255, 255, 0.2)",
									borderRadius: "6px",
									color: "rgba(255, 255, 255, 0.7)",
									padding: "0.25rem 0.5rem",
									fontSize: "0.8rem",
									cursor: "pointer",
								}}
							>
								✕ Close
							</button>
						</div>

						{/* Error Summary */}
						<div
							style={{
								padding: "1rem",
								background: `${getSeverityColor(selectedError.severity)}10`,
								border: `1px solid ${getSeverityColor(selectedError.severity)}30`,
								borderRadius: "8px",
								marginBottom: "1.5rem",
							}}
						>
							<div
								style={{
									fontSize: "0.9rem",
									fontWeight: "600",
									color: getSeverityColor(selectedError.severity),
									marginBottom: "0.5rem",
								}}
							>
								{selectedError.message}
							</div>
							<div
								style={{
									fontSize: "0.8rem",
									color: "rgba(255, 255, 255, 0.8)",
									marginBottom: "0.75rem",
								}}
							>
								{selectedError.details}
							</div>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
									gap: "0.5rem",
									fontSize: "0.75rem",
									color: "rgba(255, 255, 255, 0.7)",
								}}
							>
								<div>
									<strong>Estimated Fix Time:</strong>{" "}
									{selectedError.estimatedFixTime}
								</div>
								<div>
									<strong>Auto-Resolvable:</strong>{" "}
									{selectedError.autoResolvable ? "✅ Yes" : "❌ No"}
								</div>
							</div>
						</div>

						{/* Possible Causes */}
						<div style={{ marginBottom: "1.5rem" }}>
							<h5
								style={{
									fontSize: "0.9rem",
									fontWeight: "600",
									color: "white",
									marginBottom: "0.75rem",
								}}
							>
								🔍 Possible Causes
							</h5>
							<ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
								{selectedError.possibleCauses.map((cause, index) => (
									<li
										key={index}
										style={{
											fontSize: "0.8rem",
											color: "rgba(255, 255, 255, 0.8)",
											marginBottom: "0.25rem",
										}}
									>
										{cause}
									</li>
								))}
							</ul>
						</div>

						{/* Troubleshooting Steps */}
						<div style={{ marginBottom: "1.5rem" }}>
							<h5
								style={{
									fontSize: "0.9rem",
									fontWeight: "600",
									color: "white",
									marginBottom: "0.75rem",
								}}
							>
								🛠️ Troubleshooting Steps
							</h5>
							<ol style={{ margin: 0, paddingLeft: "1.5rem" }}>
								{selectedError.troubleshootingSteps.map((step, index) => (
									<li
										key={index}
										style={{
											fontSize: "0.8rem",
											color: "rgba(255, 255, 255, 0.8)",
											marginBottom: "0.5rem",
											lineHeight: "1.4",
										}}
									>
										{step}
									</li>
								))}
							</ol>
						</div>

						{/* Related Endpoints */}
						<div>
							<h5
								style={{
									fontSize: "0.9rem",
									fontWeight: "600",
									color: "white",
									marginBottom: "0.75rem",
								}}
							>
								🔗 Related Endpoints
							</h5>
							<div
								style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
							>
								{selectedError.relatedEndpoints.map((endpoint, index) => (
									<code
										key={index}
										style={{
											fontSize: "0.75rem",
											background: "rgba(0, 0, 0, 0.3)",
											padding: "0.25rem 0.5rem",
											borderRadius: "4px",
											color: "rgba(99, 102, 241, 0.8)",
										}}
									>
										{endpoint}
									</code>
								))}
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
