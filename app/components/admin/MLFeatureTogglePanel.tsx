"use client";

import { useState, useEffect } from "react";

// Feature toggle interfaces
interface MLFeatureStatus {
	featureId: string;
	featureName: string;
	enabled: boolean;
	enabledAt?: number;
	enabledBy?: string;
	lastModified: number;
	description: string;
}

interface ToggleAuditLog {
	timestamp: number;
	featureId: string;
	action: "enabled" | "disabled";
	previousState: boolean;
	newState: boolean;
	userId?: string;
	reason?: string;
}

export default function MLFeatureTogglePanel() {
	// State management
	const [features, setFeatures] = useState<MLFeatureStatus[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [toggling, setToggling] = useState<string | null>(null);
	const [showAuditLog, setShowAuditLog] = useState(false);
	const [auditLogs, setAuditLogs] = useState<ToggleAuditLog[]>([]);

	// Load feature toggles
	useEffect(() => {
		loadFeatures();
		const interval = setInterval(loadFeatures, 15000); // Refresh every 15 seconds
		return () => clearInterval(interval);
	}, []);

	const loadFeatures = async () => {
		try {
			const response = await fetch("/api/admin/ml-feature-toggles", {
				headers: {
					Authorization: "Bearer dev-admin-token",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				setFeatures(data.features || []);
				setError(null);
			} else {
				throw new Error(data.error || "Failed to load feature toggles");
			}
		} catch (error) {
			console.error("Failed to load feature toggles:", error);
			setError(error instanceof Error ? error.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	// Toggle feature on/off
	const handleToggleFeature = async (featureId: string, currentState: boolean) => {
		setToggling(featureId);
		try {
			const response = await fetch(`/api/admin/ml-feature-toggles/${featureId}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: "Bearer dev-admin-token",
				},
				body: JSON.stringify({
					enabled: !currentState,
					userId: "admin",
					reason: `Manual toggle from admin dashboard`,
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				// Refresh features
				await loadFeatures();
			} else {
				throw new Error(data.message || "Toggle failed");
			}
		} catch (error) {
			console.error(`Failed to toggle feature ${featureId}:`, error);
			setError(error instanceof Error ? error.message : "Toggle failed");
		} finally {
			setToggling(null);
		}
	};

	// Load audit logs
	const loadAuditLogs = async () => {
		try {
			const response = await fetch("/api/admin/ml-feature-toggles/audit-logs", {
				headers: {
					Authorization: "Bearer dev-admin-token",
				},
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				setAuditLogs(data.logs || []);
			} else {
				throw new Error(data.error || "Failed to load audit logs");
			}
		} catch (error) {
			console.error("Failed to load audit logs:", error);
		}
	};

	// Show audit logs
	const handleShowAuditLogs = async () => {
		if (!showAuditLog) {
			await loadAuditLogs();
		}
		setShowAuditLog(!showAuditLog);
	};

	// Helper functions
	const formatDate = (timestamp: number) => {
		return new Date(timestamp).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getFeatureIcon = (featureId: string) => {
		switch (featureId) {
			case "early_signal_detection":
				return "🔔";
			case "price_prediction":
				return "📈";
			default:
				return "🤖";
		}
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
				<div style={{ fontSize: "2rem", marginBottom: "1rem" }}>🔄</div>
				<div style={{ color: "rgba(255, 255, 255, 0.8)" }}>Loading ML feature toggles...</div>
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
					🎛️ ML Feature Toggles
				</h2>

				<div
					style={{
						display: "flex",
						gap: "1rem",
						alignItems: "center",
					}}
				>
					<div
						style={{
							fontSize: "0.9rem",
							color: "rgba(255, 255, 255, 0.7)",
						}}
					>
						{features.filter(f => f.enabled).length}/{features.length} Enabled
					</div>
					<button
						onClick={loadFeatures}
						style={{
							padding: "0.5rem 1rem",
							background: "rgba(99, 102, 241, 0.2)",
							border: "1px solid rgba(99, 102, 241, 0.4)",
							borderRadius: "8px",
							color: "rgba(99, 102, 241, 0.9)",
							fontSize: "0.9rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
						}}
					>
						🔄 Refresh
					</button>
					<button
						onClick={handleShowAuditLogs}
						style={{
							padding: "0.5rem 1rem",
							background: "rgba(168, 85, 247, 0.2)",
							border: "1px solid rgba(168, 85, 247, 0.4)",
							borderRadius: "8px",
							color: "rgba(168, 85, 247, 0.9)",
							fontSize: "0.9rem",
							cursor: "pointer",
							transition: "all 0.3s ease",
						}}
					>
						📋 {showAuditLog ? "Hide" : "Show"} Audit Log
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

			{/* Feature Toggles Grid */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
					gap: "1.5rem",
					marginBottom: showAuditLog ? "2rem" : "0",
				}}
			>
				{features.map(feature => (
					<div
						key={feature.featureId}
						style={{
							background: feature.enabled
								? "rgba(34, 197, 94, 0.05)"
								: "rgba(255, 255, 255, 0.05)",
							border: feature.enabled
								? "1px solid rgba(34, 197, 94, 0.3)"
								: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: "12px",
							padding: "1.5rem",
							transition: "all 0.3s ease",
						}}
					>
						<div
							style={{
								display: "flex",
								alignItems: "flex-start",
								justifyContent: "space-between",
								marginBottom: "1rem",
							}}
						>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.75rem",
									flex: 1,
								}}
							>
								<span style={{ fontSize: "1.5rem" }}>{getFeatureIcon(feature.featureId)}</span>
								<div>
									<h3
										style={{
											fontSize: "1.2rem",
											fontWeight: "600",
											color: "white",
											margin: "0 0 0.25rem 0",
										}}
									>
										{feature.featureName}
									</h3>
									<div
										style={{
											fontSize: "0.85rem",
											color: "rgba(255, 255, 255, 0.6)",
										}}
									>
										{feature.description}
									</div>
								</div>
							</div>

							{/* Toggle Switch */}
							<button
								onClick={() => handleToggleFeature(feature.featureId, feature.enabled)}
								disabled={toggling === feature.featureId}
								style={{
									padding: "0.5rem 1rem",
									background: feature.enabled
										? "rgba(34, 197, 94, 0.3)"
										: "rgba(239, 68, 68, 0.3)",
									border: feature.enabled
										? "2px solid rgba(34, 197, 94, 0.6)"
										: "2px solid rgba(239, 68, 68, 0.6)",
									borderRadius: "8px",
									color: feature.enabled
										? "rgba(34, 197, 94, 0.95)"
										: "rgba(239, 68, 68, 0.95)",
									fontSize: "0.9rem",
									fontWeight: "600",
									cursor: toggling === feature.featureId ? "wait" : "pointer",
									transition: "all 0.3s ease",
									minWidth: "100px",
									opacity: toggling === feature.featureId ? 0.6 : 1,
								}}
							>
								{toggling === feature.featureId ? (
									<span style={{ animation: "spin 1s linear infinite" }}>🔄</span>
								) : feature.enabled ? (
									"✅ Enabled"
								) : (
									"❌ Disabled"
								)}
							</button>
						</div>

						{/* Metadata */}
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 1fr",
								gap: "0.75rem",
								padding: "1rem",
								background: "rgba(0, 0, 0, 0.2)",
								borderRadius: "8px",
								fontSize: "0.85rem",
								color: "rgba(255, 255, 255, 0.8)",
							}}
						>
							<div>
								<div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>
									Last Modified
								</div>
								<div style={{ fontWeight: "500" }}>{formatDate(feature.lastModified)}</div>
							</div>
							{feature.enabledAt && (
								<div>
									<div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>
										Enabled At
									</div>
									<div style={{ fontWeight: "500" }}>{formatDate(feature.enabledAt)}</div>
								</div>
							)}
							{feature.enabledBy && (
								<div>
									<div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>
										Enabled By
									</div>
									<div style={{ fontWeight: "500" }}>{feature.enabledBy}</div>
								</div>
							)}
							<div>
								<div style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: "0.75rem" }}>
									Feature ID
								</div>
								<div style={{ fontWeight: "500", fontFamily: "monospace", fontSize: "0.75rem" }}>
									{feature.featureId}
								</div>
							</div>
						</div>
					</div>
				))}
			</div>

			{/* Audit Log Section */}
			{showAuditLog && (
				<div
					style={{
						marginTop: "2rem",
						padding: "1.5rem",
						background: "rgba(255, 255, 255, 0.05)",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						borderRadius: "12px",
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
						📋 Audit Log
					</h3>

					{auditLogs.length === 0 ? (
						<div
							style={{
								textAlign: "center",
								padding: "2rem",
								color: "rgba(255, 255, 255, 0.6)",
							}}
						>
							No audit logs available
						</div>
					) : (
						<div
							style={{
								maxHeight: "400px",
								overflowY: "auto",
							}}
						>
							{auditLogs.map((log, index) => (
								<div
									key={`${log.featureId}-${log.timestamp}`}
									style={{
										padding: "1rem",
										marginBottom: "0.75rem",
										background: "rgba(0, 0, 0, 0.2)",
										borderRadius: "8px",
										borderLeft:
											log.action === "enabled"
												? "4px solid rgba(34, 197, 94, 0.6)"
												: "4px solid rgba(239, 68, 68, 0.6)",
									}}
								>
									<div
										style={{
											display: "flex",
											justifyContent: "space-between",
											alignItems: "center",
											marginBottom: "0.5rem",
										}}
									>
										<div
											style={{
												fontSize: "0.9rem",
												fontWeight: "600",
												color: "white",
											}}
										>
											{log.action === "enabled" ? "✅ Enabled" : "❌ Disabled"}:{" "}
											{features.find(f => f.featureId === log.featureId)?.featureName ||
												log.featureId}
										</div>
										<div
											style={{
												fontSize: "0.75rem",
												color: "rgba(255, 255, 255, 0.6)",
											}}
										>
											{formatDate(log.timestamp)}
										</div>
									</div>

									<div
										style={{
											fontSize: "0.8rem",
											color: "rgba(255, 255, 255, 0.7)",
											display: "grid",
											gridTemplateColumns: "1fr 1fr",
											gap: "0.5rem",
										}}
									>
										<div>
											Previous: {log.previousState ? "Enabled" : "Disabled"}
										</div>
										<div>New: {log.newState ? "Enabled" : "Disabled"}</div>
										{log.userId && <div>User: {log.userId}</div>}
										{log.reason && <div>Reason: {log.reason}</div>}
									</div>
								</div>
							))}
						</div>
					)}
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
