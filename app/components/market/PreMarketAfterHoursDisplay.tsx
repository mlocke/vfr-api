"use client";

import React from "react";

/**
 * Extended hours data interface
 */
interface ExtendedHoursData {
	preMarketPrice?: number;
	preMarketChange?: number;
	preMarketChangePercent?: number;
	afterHoursPrice?: number;
	afterHoursChange?: number;
	afterHoursChangePercent?: number;
	marketStatus?: "pre-market" | "market-hours" | "after-hours" | "closed";
}

/**
 * Component props
 */
interface PreMarketAfterHoursDisplayProps {
	symbol: string;
	regularPrice: number;
	extendedHoursData?: ExtendedHoursData;
	className?: string;
}

/**
 * Extended hours pricing display component with cyberpunk styling
 * Shows pre-market and after-hours price data with directional indicators
 */
export default function PreMarketAfterHoursDisplay({
	symbol,
	regularPrice,
	extendedHoursData,
	className = "",
}: PreMarketAfterHoursDisplayProps) {
	const formatPrice = (price: number) => `$${price.toFixed(2)}`;

	const formatChange = (change: number) => {
		const sign = change >= 0 ? "+" : "";
		return `${sign}${change.toFixed(2)}`;
	};

	const formatChangePercent = (changePercent: number) => {
		const sign = changePercent >= 0 ? "+" : "";
		return `${sign}${changePercent.toFixed(2)}%`;
	};

	const getChangeColor = (change: number) => {
		if (change > 0) return "text-green-400";
		if (change < 0) return "text-red-400";
		return "text-gray-400";
	};

	const getChangeIcon = (change: number) => {
		if (change > 0) return "▲";
		if (change < 0) return "▼";
		return "●";
	};

	// Determine which session data to show prominently
	const isPreMarket = extendedHoursData?.marketStatus === "pre-market";
	const isAfterHours = extendedHoursData?.marketStatus === "after-hours";
	const hasPreMarketData =
		extendedHoursData?.preMarketPrice && extendedHoursData?.preMarketChange !== undefined;
	const hasAfterHoursData =
		extendedHoursData?.afterHoursPrice && extendedHoursData?.afterHoursChange !== undefined;

	if (!hasPreMarketData && !hasAfterHoursData) {
		return null;
	}

	return (
		<div className={`space-y-3 ${className}`}>
			{/* Pre-Market Data */}
			{hasPreMarketData && (
				<div
					className={`
          p-3 rounded-lg border backdrop-blur-sm transition-all duration-300
          ${
				isPreMarket
					? "bg-cyan-900/30 border-cyan-500/50 ring-1 ring-cyan-500/20"
					: "bg-gray-900/20 border-gray-600/30"
			}
          hover:bg-opacity-50
        `}
				>
					<div className="flex items-center justify-between">
						{/* Session Label */}
						<div className="flex items-center gap-2">
							<div
								className={`
                w-2 h-2 rounded-full
                ${isPreMarket ? "bg-cyan-400 animate-pulse" : "bg-cyan-600"}
              `}
							/>
							<span
								className={`
                text-sm font-medium
                ${isPreMarket ? "text-cyan-400" : "text-gray-400"}
              `}
							>
								Pre-Market
							</span>
						</div>

						{/* Session Time */}
						<span className="text-xs text-gray-500">4:00 AM - 9:30 AM ET</span>
					</div>

					{/* Price Data */}
					<div className="mt-2 flex items-center justify-between">
						<div className="flex items-center gap-3">
							{/* Current Pre-Market Price */}
							<span className="text-lg font-bold text-white">
								{formatPrice(extendedHoursData.preMarketPrice!)}
							</span>

							{/* Change Indicator */}
							<div
								className={`
                flex items-center gap-1
                ${getChangeColor(extendedHoursData.preMarketChange!)}
              `}
							>
								<span className="text-xs">
									{getChangeIcon(extendedHoursData.preMarketChange!)}
								</span>
								<span className="text-sm font-medium">
									{formatChange(extendedHoursData.preMarketChange!)}
								</span>
								<span className="text-sm">
									(
									{formatChangePercent(extendedHoursData.preMarketChangePercent!)}
									)
								</span>
							</div>
						</div>

						{/* Volume Indicator (placeholder) */}
						<div className="text-right">
							<div className="text-xs text-gray-500">vs Regular</div>
							<div
								className={`text-sm ${getChangeColor(extendedHoursData.preMarketChange!)}`}
							>
								{formatChangePercent(
									((extendedHoursData.preMarketPrice! - regularPrice) /
										regularPrice) *
										100
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* After-Hours Data */}
			{hasAfterHoursData && (
				<div
					className={`
          p-3 rounded-lg border backdrop-blur-sm transition-all duration-300
          ${
				isAfterHours
					? "bg-orange-900/30 border-orange-500/50 ring-1 ring-orange-500/20"
					: "bg-gray-900/20 border-gray-600/30"
			}
          hover:bg-opacity-50
        `}
				>
					<div className="flex items-center justify-between">
						{/* Session Label */}
						<div className="flex items-center gap-2">
							<div
								className={`
                w-2 h-2 rounded-full
                ${isAfterHours ? "bg-orange-400 animate-pulse" : "bg-orange-600"}
              `}
							/>
							<span
								className={`
                text-sm font-medium
                ${isAfterHours ? "text-orange-400" : "text-gray-400"}
              `}
							>
								After Hours
							</span>
						</div>

						{/* Session Time */}
						<span className="text-xs text-gray-500">4:00 PM - 8:00 PM ET</span>
					</div>

					{/* Price Data */}
					<div className="mt-2 flex items-center justify-between">
						<div className="flex items-center gap-3">
							{/* Current After-Hours Price */}
							<span className="text-lg font-bold text-white">
								{formatPrice(extendedHoursData.afterHoursPrice!)}
							</span>

							{/* Change Indicator */}
							<div
								className={`
                flex items-center gap-1
                ${getChangeColor(extendedHoursData.afterHoursChange!)}
              `}
							>
								<span className="text-xs">
									{getChangeIcon(extendedHoursData.afterHoursChange!)}
								</span>
								<span className="text-sm font-medium">
									{formatChange(extendedHoursData.afterHoursChange!)}
								</span>
								<span className="text-sm">
									(
									{formatChangePercent(
										extendedHoursData.afterHoursChangePercent!
									)}
									)
								</span>
							</div>
						</div>

						{/* Volume Indicator (placeholder) */}
						<div className="text-right">
							<div className="text-xs text-gray-500">vs Regular</div>
							<div
								className={`text-sm ${getChangeColor(extendedHoursData.afterHoursChange!)}`}
							>
								{formatChangePercent(
									((extendedHoursData.afterHoursPrice! - regularPrice) /
										regularPrice) *
										100
								)}
							</div>
						</div>
					</div>
				</div>
			)}

			{/* Extended Hours Volatility Warning */}
			{(hasPreMarketData || hasAfterHoursData) && (
				<div className="mt-2 p-2 bg-yellow-900/20 border border-yellow-600/30 rounded text-xs text-yellow-400">
					<div className="flex items-center gap-1">
						<span>⚠️</span>
						<span>
							Extended hours trading may have higher volatility and lower liquidity
						</span>
					</div>
				</div>
			)}
		</div>
	);
}
