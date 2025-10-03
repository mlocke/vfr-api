"use client";

import React, { useState, useEffect } from "react";

/**
 * Market session status type
 */
type MarketStatus = "pre-market" | "market-hours" | "after-hours" | "closed";

/**
 * Component props
 */
interface ExtendedHoursIndicatorProps {
	marketStatus?: MarketStatus;
	className?: string;
}

/**
 * Real-time market session status indicator with cyberpunk styling
 * Shows current market session (Pre-Market, Market Hours, After-Hours, Closed)
 * with animated visual indicators and session timing
 */
export default function ExtendedHoursIndicator({
	marketStatus = "closed",
	className = "",
}: ExtendedHoursIndicatorProps) {
	const [currentTime, setCurrentTime] = useState(new Date());
	const [nextSessionInfo, setNextSessionInfo] = useState<{
		session: string;
		timeUntil: string;
	} | null>(null);

	// Update current time every minute
	useEffect(() => {
		const timer = setInterval(() => {
			setCurrentTime(new Date());
			updateNextSessionInfo();
		}, 60000);

		updateNextSessionInfo();
		return () => clearInterval(timer);
	}, [marketStatus]);

	const updateNextSessionInfo = () => {
		const now = new Date();
		const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
		const hours = easternTime.getHours();
		const minutes = easternTime.getMinutes();
		const dayOfWeek = easternTime.getDay();

		// Weekend handling
		if (dayOfWeek === 0 || dayOfWeek === 6) {
			const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
			setNextSessionInfo({
				session: "Pre-Market",
				timeUntil: `${daysUntilMonday} day${daysUntilMonday > 1 ? "s" : ""}`,
			});
			return;
		}

		const currentTimeMinutes = hours * 60 + minutes;
		const preMarketStart = 4 * 60; // 4:00 AM
		const marketOpen = 9 * 60 + 30; // 9:30 AM
		const marketClose = 16 * 60; // 4:00 PM
		const afterHoursEnd = 20 * 60; // 8:00 PM

		let nextSession = "";
		let timeUntilMinutes = 0;

		if (currentTimeMinutes < preMarketStart) {
			nextSession = "Pre-Market";
			timeUntilMinutes = preMarketStart - currentTimeMinutes;
		} else if (currentTimeMinutes < marketOpen) {
			nextSession = "Market Open";
			timeUntilMinutes = marketOpen - currentTimeMinutes;
		} else if (currentTimeMinutes < marketClose) {
			nextSession = "After Hours";
			timeUntilMinutes = marketClose - currentTimeMinutes;
		} else if (currentTimeMinutes < afterHoursEnd) {
			nextSession = "Market Closed";
			timeUntilMinutes = afterHoursEnd - currentTimeMinutes;
		} else {
			// Next day pre-market
			nextSession = "Pre-Market";
			timeUntilMinutes = 24 * 60 + preMarketStart - currentTimeMinutes;
		}

		const timeHours = Math.floor(timeUntilMinutes / 60);
		const mins = timeUntilMinutes % 60;
		const timeUntil = timeHours > 0 ? `${timeHours}h ${mins}m` : `${mins}m`;

		setNextSessionInfo({ session: nextSession, timeUntil });
	};

	const getStatusConfig = (status: MarketStatus) => {
		switch (status) {
			case "pre-market":
				return {
					label: "Pre-Market",
					color: "text-cyan-400",
					bgColor: "bg-cyan-900/30",
					borderColor: "border-cyan-500/50",
					dotColor: "bg-cyan-400",
					description: "4:00 AM - 9:30 AM ET",
				};
			case "market-hours":
				return {
					label: "Market Open",
					color: "text-green-400",
					bgColor: "bg-green-900/30",
					borderColor: "border-green-500/50",
					dotColor: "bg-green-400",
					description: "9:30 AM - 4:00 PM ET",
				};
			case "after-hours":
				return {
					label: "After Hours",
					color: "text-orange-400",
					bgColor: "bg-orange-900/30",
					borderColor: "border-orange-500/50",
					dotColor: "bg-orange-400",
					description: "4:00 PM - 8:00 PM ET",
				};
			case "closed":
			default:
				return {
					label: "Market Closed",
					color: "text-gray-400",
					bgColor: "bg-gray-900/30",
					borderColor: "border-gray-500/50",
					dotColor: "bg-gray-400",
					description: "Trading Hours Ended",
				};
		}
	};

	const config = getStatusConfig(marketStatus);

	return (
		<div className={`relative ${className}`}>
			{/* Main Status Indicator */}
			<div
				className={`
        flex items-center gap-3 px-4 py-2 rounded-lg
        ${config.bgColor} ${config.borderColor} border backdrop-blur-sm
        transition-all duration-300 hover:bg-opacity-50
      `}
			>
				{/* Animated Status Dot */}
				<div className="relative flex items-center">
					<div
						className={`
            w-2 h-2 ${config.dotColor} rounded-full
            ${marketStatus === "market-hours" ? "animate-pulse" : ""}
          `}
					/>
					{marketStatus === "market-hours" && (
						<div
							className={`
              absolute w-2 h-2 ${config.dotColor} rounded-full
              animate-ping opacity-75
            `}
						/>
					)}
				</div>

				{/* Status Text */}
				<div className="flex flex-col">
					<span className={`font-semibold text-sm ${config.color}`}>{config.label}</span>
					<span className="text-xs text-gray-400">{config.description}</span>
				</div>

				{/* Next Session Timer */}
				{nextSessionInfo && (
					<div className="ml-auto text-right">
						<div className="text-xs text-gray-400">Next:</div>
						<div className="text-xs font-medium text-gray-300">
							{nextSessionInfo.session}
						</div>
						<div className="text-xs text-cyan-400">in {nextSessionInfo.timeUntil}</div>
					</div>
				)}
			</div>

			{/* Session Timeline */}
			<div className="mt-3 px-2">
				<div className="flex items-center justify-between text-xs text-gray-500 mb-1">
					<span>4AM</span>
					<span>9:30AM</span>
					<span>4PM</span>
					<span>8PM</span>
				</div>

				{/* Timeline Bar */}
				<div className="relative h-1 bg-gray-800 rounded-full overflow-hidden">
					{/* Progress Indicator */}
					<div className="absolute inset-0">
						{/* Pre-market segment */}
						<div
							className={`
              absolute h-full bg-cyan-600/50 rounded-full
              left-0 w-[23%]
              ${marketStatus === "pre-market" ? "bg-cyan-400" : ""}
            `}
						/>

						{/* Market hours segment */}
						<div
							className={`
              absolute h-full bg-green-600/50 rounded-full
              left-[23%] w-[46%]
              ${marketStatus === "market-hours" ? "bg-green-400" : ""}
            `}
						/>

						{/* After hours segment */}
						<div
							className={`
              absolute h-full bg-orange-600/50 rounded-full
              left-[69%] w-[31%]
              ${marketStatus === "after-hours" ? "bg-orange-400" : ""}
            `}
						/>
					</div>

					{/* Current Time Marker */}
					<div
						className="absolute top-0 w-0.5 h-full bg-white shadow-lg transform -translate-x-0.5"
						style={{ left: getCurrentTimePosition() }}
					/>
				</div>
			</div>
		</div>
	);
}

/**
 * Calculate current time position on timeline (0-100%)
 */
function getCurrentTimePosition(): string {
	const now = new Date();
	const easternTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
	const hours = easternTime.getHours();
	const minutes = easternTime.getMinutes();
	const currentTimeMinutes = hours * 60 + minutes;

	const startTime = 4 * 60; // 4:00 AM
	const endTime = 20 * 60; // 8:00 PM
	const totalMinutes = endTime - startTime;

	if (currentTimeMinutes < startTime) {
		return "0%";
	} else if (currentTimeMinutes > endTime) {
		return "100%";
	} else {
		const position = ((currentTimeMinutes - startTime) / totalMinutes) * 100;
		return `${Math.min(100, Math.max(0, position))}%`;
	}
}
