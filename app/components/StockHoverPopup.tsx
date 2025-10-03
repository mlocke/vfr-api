"use client";

import { useEffect, useState } from "react";

interface StockHoverPopupProps {
	symbol: string;
	exchange: string;
	name: string;
	x: number;
	y: number;
	onClose?: () => void;
}

interface StockData {
	currentPrice: number;
	change: number;
	changePercent: number;
	performance: {
		"1D": number;
		"5D": number;
		"1M": number;
		"6M": number;
		YTD: number;
		"1Y": number;
		"5Y": number;
		ALL: number;
	};
	news: {
		headline: string;
		summary: string;
	};
}

export default function StockHoverPopup({
	symbol,
	exchange,
	name,
	x,
	y,
	onClose,
}: StockHoverPopupProps) {
	const [isLoaded, setIsLoaded] = useState(false);
	const [activeTimePeriod, setActiveTimePeriod] = useState("1M");
	const [stockData, setStockData] = useState<StockData | null>(null);

	// Mock data - in production this would come from your API
	const getMockStockData = (symbol: string): StockData => {
		const mockData: { [key: string]: StockData } = {
			AAPL: {
				currentPrice: 238.24,
				change: 2.4,
				changePercent: 1.02,
				performance: {
					"1D": 1.02,
					"5D": 3.1,
					"1M": 6.82,
					"6M": -20.28,
					YTD: -7.35,
					"1Y": 36.67,
					"5Y": 64.14,
					ALL: 195.47,
				},
				news: {
					headline: "Apple Invests in AI Infrastructure",
					summary:
						"Apple invested $69 billion in the last three months for data centers and AI infrastructure, reflecting a strong capital expenditure trend despite falling construction job gains.",
				},
			},
			AMZN: {
				currentPrice: 238.24,
				change: 2.4,
				changePercent: 1.02,
				performance: {
					"1D": 1.02,
					"5D": 3.1,
					"1M": 6.82,
					"6M": -20.28,
					YTD: -7.35,
					"1Y": 36.67,
					"5Y": 64.14,
					ALL: 195.47,
				},
				news: {
					headline: "Amazon Expands Cloud Services",
					summary:
						"Amazon invested $69 billion in the last three months for data centers and AI infrastructure, reflecting a strong capital expenditure trend despite falling construction job gains.",
				},
			},
			MSFT: {
				currentPrice: 415.85,
				change: 5.2,
				changePercent: 1.27,
				performance: {
					"1D": 1.27,
					"5D": 2.45,
					"1M": 8.15,
					"6M": -15.42,
					YTD: 12.35,
					"1Y": 25.87,
					"5Y": 89.23,
					ALL: 285.67,
				},
				news: {
					headline: "Microsoft AI Integration Success",
					summary:
						"Microsoft continues to lead in AI integration across its product suite, showing strong growth in cloud computing and enterprise solutions.",
				},
			},
			TSLA: {
				currentPrice: 271.99,
				change: -8.45,
				changePercent: -3.01,
				performance: {
					"1D": -3.01,
					"5D": -1.23,
					"1M": 4.67,
					"6M": -18.92,
					YTD: 15.43,
					"1Y": -12.34,
					"5Y": 156.78,
					ALL: 1847.92,
				},
				news: {
					headline: "Tesla Production Updates",
					summary:
						"Tesla announces production milestone achievements and expansion plans for electric vehicle manufacturing capabilities.",
				},
			},
		};

		return mockData[symbol] || mockData["AAPL"]; // Default to Apple data
	};

	useEffect(() => {
		if (symbol) {
			setIsLoaded(false);

			// Simulate data loading
			setTimeout(() => {
				setStockData(getMockStockData(symbol));
				setIsLoaded(true);
			}, 300);

			// Load TradingView mini chart widget
			const widgetContainer = document.getElementById(`chart-${symbol}`);
			if (widgetContainer) {
				widgetContainer.innerHTML = ""; // Clear previous

				const script = document.createElement("script");
				script.type = "text/javascript";
				script.src =
					"https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js";
				script.async = true;
				script.innerHTML = JSON.stringify({
					symbol: `${exchange}:${symbol}`,
					width: "100%",
					height: "220",
					locale: "en",
					dateRange: activeTimePeriod.toLowerCase(),
					colorTheme: "dark",
					trendLineColor: "rgba(41, 98, 255, 1)",
					underLineColor: "rgba(41, 98, 255, 0.3)",
					underLineBottomColor: "rgba(41, 98, 255, 0)",
					isTransparent: true,
					autosize: false,
					largeChartUrl: "",
				});

				widgetContainer.appendChild(script);
			}
		}
	}, [symbol, exchange, activeTimePeriod]);

	if (!stockData) return null;

	const adjustedX = Math.min(x, window.innerWidth - 520);
	const adjustedY = Math.max(y, 100);

	const timePeriods = [
		{ label: "1 day", key: "1D" },
		{ label: "5 days", key: "5D" },
		{ label: "1 month", key: "1M" },
		{ label: "6 months", key: "6M" },
		{ label: "Year to date", key: "YTD" },
		{ label: "1 year", key: "1Y" },
		{ label: "5 years", key: "5Y" },
		{ label: "All time", key: "ALL" },
	];

	const formatPerformance = (value: number) => {
		const sign = value >= 0 ? "+" : "";
		return `${sign}${value.toFixed(2)}%`;
	};

	const getPerformanceColor = (value: number) => {
		return value >= 0 ? "#00c851" : "#ff4444";
	};

	return (
		<div
			className="stock-hover-popup enhanced"
			style={{
				left: adjustedX,
				top: adjustedY,
				opacity: isLoaded ? 1 : 0.8,
			}}
		>
			{/* Header with stock info */}
			<div className="popup-header enhanced">
				<div className="stock-info">
					<div className="stock-symbol-section">
						<span className="stock-symbol">{symbol}</span>
						<span className="stock-price">${stockData.currentPrice.toFixed(2)}</span>
					</div>
					<div className="stock-change">
						<span
							className="change-value"
							style={{ color: getPerformanceColor(stockData.change) }}
						>
							{formatPerformance(stockData.changePercent)}
						</span>
					</div>
				</div>
			</div>

			{/* Chart container */}
			<div className="popup-chart-section">
				<div id={`chart-${symbol}`} className="tradingview-chart"></div>
			</div>

			{/* Time period buttons */}
			<div className="time-periods">
				{timePeriods.map(period => (
					<button
						key={period.key}
						className={`time-period-btn ${activeTimePeriod === period.key ? "active" : ""}`}
						onClick={() => setActiveTimePeriod(period.key)}
					>
						<div className="period-label">{period.label}</div>
						<div
							className="period-performance"
							style={{
								color: getPerformanceColor(
									stockData.performance[
										period.key as keyof typeof stockData.performance
									]
								),
							}}
						>
							{formatPerformance(
								stockData.performance[
									period.key as keyof typeof stockData.performance
								]
							)}
						</div>
					</button>
				))}
			</div>

			{/* News section */}
			<div className="popup-news">
				<div className="news-header">Key facts today</div>
				<div className="news-content">
					<div className="news-headline">{stockData.news.headline}</div>
					<div className="news-summary">{stockData.news.summary}</div>
				</div>
			</div>
		</div>
	);
}
