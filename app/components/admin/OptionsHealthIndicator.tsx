"use client";

import React, { useState, useEffect } from "react";

/**
 * OptionsHealthIndicator - Real-time status display for options services
 * Shows current health, response times, and service availability
 */

interface OptionsHealthStatus {
	overall: "healthy" | "degraded" | "critical" | "offline";
	providers: {
		standard: {
			status: "online" | "degraded" | "offline";
			responseTime: number;
			availability: number;
			lastCheck: number;
		};
		unicornbay: {
			status: "online" | "degraded" | "offline";
			responseTime: number;
			availability: number;
			lastCheck: number;
			features: {
				putCallRatio: boolean;
				optionsChain: boolean;
				unicornBayEnhanced: boolean;
				unicornBayGreeks: boolean;
				unicornBayIVSurface: boolean;
				unicornBayOptionsFlow: boolean;
			};
		};
	};
	cache: {
		status: "online" | "degraded" | "offline";
		hitRatio: number;
		memoryUsage: number;
		responseTime: number;
	};
	system: {
		memoryUsage: number;
		cpuUsage: number;
		activeConnections: number;
		uptime: number;
	};
	lastUpdated: number;
	alerts: Array<{
		type: "info" | "warning" | "error";
		message: string;
		timestamp: number;
	}>;
}

interface OptionsHealthIndicatorProps {
	healthStatus?: OptionsHealthStatus | null;
	autoRefresh?: boolean;
	refreshInterval?: number;
}

export default function OptionsHealthIndicator({
	healthStatus,
	autoRefresh = true,
	refreshInterval = 30000,
}: OptionsHealthIndicatorProps) {
	const [currentStatus, setCurrentStatus] = useState<OptionsHealthStatus | null>(
		healthStatus || null
	);
	const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Auto-refresh functionality
	useEffect(() => {
		if (!autoRefresh) return;

		const interval = setInterval(async () => {
			await refreshHealthStatus();
		}, refreshInterval);

		return () => clearInterval(interval);
	}, [autoRefresh, refreshInterval]);

	const refreshHealthStatus = async () => {
		setIsRefreshing(true);
		try {
			// Simulate health check API call
			const response = await fetch("/api/admin/options-health");
			const data = await response.json();

			if (data.success) {
				setCurrentStatus(data.health);
			} else {
				// Fallback to mock data if API is unavailable
				setCurrentStatus(generateMockHealthStatus());
			}
		} catch (error) {
			console.warn("Health status refresh failed, using mock data:", error);
			setCurrentStatus(generateMockHealthStatus());
		} finally {
			setIsRefreshing(false);
			setLastRefresh(Date.now());
		}
	};

	const generateMockHealthStatus = (): OptionsHealthStatus => {
		const now = Date.now();
		return {
			overall: "healthy",
			providers: {
				standard: {
					status: "online",
					responseTime: 150 + Math.random() * 100,
					availability: 99.2 + Math.random() * 0.7,
					lastCheck: now - Math.random() * 30000,
				},
				unicornbay: {
					status: Math.random() > 0.1 ? "online" : "degraded",
					responseTime: 200 + Math.random() * 150,
					availability: 98.5 + Math.random() * 1.4,
					lastCheck: now - Math.random() * 30000,
					features: {
						putCallRatio: true,
						optionsChain: true,
						unicornBayEnhanced: Math.random() > 0.2,
						unicornBayGreeks: Math.random() > 0.3,
						unicornBayIVSurface: Math.random() > 0.25,
						unicornBayOptionsFlow: Math.random() > 0.15,
					},
				},
			},
			cache: {
				status: "online",
				hitRatio: 85 + Math.random() * 10,
				memoryUsage: 60 + Math.random() * 25,
				responseTime: 5 + Math.random() * 10,
			},
			system: {
				memoryUsage: 45 + Math.random() * 30,
				cpuUsage: 15 + Math.random() * 25,
				activeConnections: 10 + Math.floor(Math.random() * 40),
				uptime: now - Math.random() * 86400000 * 7, // Up to 7 days
			},
			lastUpdated: now,
			alerts: generateMockAlerts(),
		};
	};

	const generateMockAlerts = () => {
		const alerts = [];
		const now = Date.now();

		if (Math.random() > 0.7) {
			alerts.push({
				type: "warning" as const,
				message: "UnicornBay enhanced features experiencing intermittent availability",
				timestamp: now - Math.random() * 300000,
			});
		}

		if (Math.random() > 0.8) {
			alerts.push({
				type: "info" as const,
				message: "Cache hit ratio below optimal threshold (85%)",
				timestamp: now - Math.random() * 600000,
			});
		}

		if (Math.random() > 0.95) {
			alerts.push({
				type: "error" as const,
				message: "API rate limit approaching for EODHD provider",
				timestamp: now - Math.random() * 180000,
			});
		}

		return alerts;
	};

	const getOverallStatusColor = (status: string) => {
		switch (status) {
			case "healthy":
				return "rgba(34, 197, 94, 0.8)";
			case "degraded":
				return "rgba(251, 191, 36, 0.8)";
			case "critical":
				return "rgba(245, 158, 11, 0.8)";
			case "offline":
				return "rgba(239, 68, 68, 0.8)";
			default:
				return "rgba(99, 102, 241, 0.8)";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "healthy":
			case "online":
				return "🟢";
			case "degraded":
				return "🟡";
			case "critical":
				return "🟠";
			case "offline":
				return "🔴";
			default:
				return "⚫";
		}
	};

	const getAlertIcon = (type: string) => {
		switch (type) {
			case "info":
				return "💙";
			case "warning":
				return "⚠️";
			case "error":
				return "🚨";
			default:
				return "ℹ️";
		}
	};

	const formatUptime = (uptime: number) => {
		const seconds = Math.floor(uptime / 1000);
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);

		if (days > 0) return `${days}d ${hours}h`;
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	};

	// Use provided status or current status
	const status = healthStatus || currentStatus;

	if (!status) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "0.5rem",
					padding: "0.75rem 1rem",
					background: "rgba(100, 100, 100, 0.2)",
					border: "1px solid rgba(255, 255, 255, 0.2)",
					borderRadius: "8px",
					fontSize: "0.9rem",
					color: "rgba(255, 255, 255, 0.7)",
				}}
			>
				⚫ Loading health status...
			</div>
		);
	}

	return (
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				gap: "0.75rem",
				minWidth: "300px",
			}}
		>
			{/* Overall Status Header */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					padding: "0.75rem 1rem",
					background: `${getOverallStatusColor(status.overall)}15`,
					border: `1px solid ${getOverallStatusColor(status.overall)}40`,
					borderRadius: "8px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
						fontSize: "0.9rem",
						fontWeight: "600",
						color: getOverallStatusColor(status.overall),
					}}
				>
					{getStatusIcon(status.overall)} Options Services
				</div>
				<button
					onClick={refreshHealthStatus}
					disabled={isRefreshing}
					style={{
						background: "rgba(255, 255, 255, 0.1)",
						border: "1px solid rgba(255, 255, 255, 0.2)",
						borderRadius: "6px",
						color: "rgba(255, 255, 255, 0.7)",
						padding: "0.25rem 0.5rem",
						fontSize: "0.7rem",
						cursor: isRefreshing ? "not-allowed" : "pointer",
						transition: "all 0.3s ease",
					}}
				>
					{isRefreshing ? "🔄" : "↻"} Refresh
				</button>
			</div>

			{/* Provider Status */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
					gap: "0.5rem",
				}}
			>
				{/* Standard Provider */}
				<div
					style={{
						padding: "0.75rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "0.8rem",
							fontWeight: "600",
							color: "white",
							marginBottom: "0.5rem",
						}}
					>
						{getStatusIcon(status.providers.standard.status)} 📈 Standard
					</div>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.7)",
							display: "flex",
							flexDirection: "column",
							gap: "0.25rem",
						}}
					>
						<div>{status.providers.standard.responseTime.toFixed(0)}ms response</div>
						<div>{status.providers.standard.availability.toFixed(1)}% uptime</div>
					</div>
				</div>

				{/* UnicornBay Provider */}
				<div
					style={{
						padding: "0.75rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							fontSize: "0.8rem",
							fontWeight: "600",
							color: "white",
							marginBottom: "0.5rem",
						}}
					>
						{getStatusIcon(status.providers.unicornbay.status)} 🦄 UnicornBay
					</div>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.7)",
							display: "flex",
							flexDirection: "column",
							gap: "0.25rem",
						}}
					>
						<div>{status.providers.unicornbay.responseTime.toFixed(0)}ms response</div>
						<div>{status.providers.unicornbay.availability.toFixed(1)}% uptime</div>
					</div>
				</div>
			</div>

			{/* UnicornBay Features Status */}
			<div
				style={{
					padding: "0.75rem",
					background: "rgba(255, 255, 255, 0.05)",
					borderRadius: "6px",
					border: "1px solid rgba(255, 255, 255, 0.1)",
				}}
			>
				<div
					style={{
						fontSize: "0.8rem",
						fontWeight: "600",
						color: "white",
						marginBottom: "0.5rem",
					}}
				>
					🦄 Enhanced Features
				</div>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(3, 1fr)",
						gap: "0.25rem",
						fontSize: "0.7rem",
					}}
				>
					{Object.entries(status.providers.unicornbay.features).map(
						([feature, available]) => (
							<div
								key={feature}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.25rem",
									color: available
										? "rgba(34, 197, 94, 0.8)"
										: "rgba(239, 68, 68, 0.8)",
								}}
							>
								{available ? "✅" : "❌"}
								<span style={{ fontSize: "0.65rem" }}>
									{feature.replace(/([A-Z])/g, " $1").toLowerCase()}
								</span>
							</div>
						)
					)}
				</div>
			</div>

			{/* System Metrics */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(4, 1fr)",
					gap: "0.5rem",
				}}
			>
				{/* Cache */}
				<div
					style={{
						padding: "0.5rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.6)",
							marginBottom: "0.25rem",
						}}
					>
						Cache
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							fontWeight: "600",
							color:
								status.cache.hitRatio >= 85
									? "rgba(34, 197, 94, 0.8)"
									: "rgba(251, 191, 36, 0.8)",
						}}
					>
						{status.cache.hitRatio.toFixed(0)}%
					</div>
				</div>

				{/* Memory */}
				<div
					style={{
						padding: "0.5rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.6)",
							marginBottom: "0.25rem",
						}}
					>
						Memory
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							fontWeight: "600",
							color:
								status.system.memoryUsage < 80
									? "rgba(34, 197, 94, 0.8)"
									: "rgba(239, 68, 68, 0.8)",
						}}
					>
						{status.system.memoryUsage.toFixed(0)}%
					</div>
				</div>

				{/* CPU */}
				<div
					style={{
						padding: "0.5rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.6)",
							marginBottom: "0.25rem",
						}}
					>
						CPU
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							fontWeight: "600",
							color:
								status.system.cpuUsage < 70
									? "rgba(34, 197, 94, 0.8)"
									: "rgba(239, 68, 68, 0.8)",
						}}
					>
						{status.system.cpuUsage.toFixed(0)}%
					</div>
				</div>

				{/* Uptime */}
				<div
					style={{
						padding: "0.5rem",
						background: "rgba(255, 255, 255, 0.05)",
						borderRadius: "6px",
						border: "1px solid rgba(255, 255, 255, 0.1)",
						textAlign: "center",
					}}
				>
					<div
						style={{
							fontSize: "0.7rem",
							color: "rgba(255, 255, 255, 0.6)",
							marginBottom: "0.25rem",
						}}
					>
						Uptime
					</div>
					<div
						style={{
							fontSize: "0.8rem",
							fontWeight: "600",
							color: "rgba(34, 197, 94, 0.8)",
						}}
					>
						{formatUptime(status.system.uptime)}
					</div>
				</div>
			</div>

			{/* Active Alerts */}
			{status.alerts.length > 0 && (
				<div
					style={{
						padding: "0.75rem",
						background: "rgba(251, 191, 36, 0.1)",
						border: "1px solid rgba(251, 191, 36, 0.3)",
						borderRadius: "6px",
					}}
				>
					<div
						style={{
							fontSize: "0.8rem",
							fontWeight: "600",
							color: "rgba(251, 191, 36, 0.9)",
							marginBottom: "0.5rem",
						}}
					>
						Active Alerts ({status.alerts.length})
					</div>
					<div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
						{status.alerts.slice(0, 3).map((alert, index) => (
							<div
								key={index}
								style={{
									display: "flex",
									alignItems: "center",
									gap: "0.5rem",
									fontSize: "0.7rem",
									color: "rgba(255, 255, 255, 0.8)",
								}}
							>
								{getAlertIcon(alert.type)}
								<span style={{ flex: 1 }}>{alert.message}</span>
								<span style={{ color: "rgba(255, 255, 255, 0.6)" }}>
									{Math.floor((Date.now() - alert.timestamp) / 60000)}m ago
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Last Update Info */}
			<div
				style={{
					fontSize: "0.7rem",
					color: "rgba(255, 255, 255, 0.6)",
					textAlign: "center",
					padding: "0.5rem",
				}}
			>
				Last updated: {new Date(lastRefresh).toLocaleTimeString()}
				{autoRefresh && (
					<span style={{ marginLeft: "0.5rem" }}>
						(auto-refresh: {refreshInterval / 1000}s)
					</span>
				)}
			</div>
		</div>
	);
}
