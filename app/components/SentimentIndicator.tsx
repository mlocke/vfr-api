"use client";

import { useState, useEffect } from "react";

interface NewsArticle {
	title: string;
	content: string;
	url: string;
	publishedAt: string;
	source: string;
	sentiment: {
		score: number;
		label: "positive" | "negative" | "neutral";
		confidence: number;
	};
	relevance: number;
	keywords: string[];
}

interface SectorNews {
	sector: string;
	articles: NewsArticle[];
	overallSentiment: {
		score: number;
		label: "positive" | "negative" | "neutral";
		trending: "up" | "down" | "stable";
	};
	marketImpact: "high" | "medium" | "low";
	timestamp: number;
	source?: string;
	cached?: boolean;
}

interface SentimentIndicatorProps {
	sector: string | null;
	realTimeEnabled?: boolean;
}

export default function SentimentIndicator({
	sector,
	realTimeEnabled = false,
}: SentimentIndicatorProps) {
	const [newsData, setNewsData] = useState<SectorNews | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);

	// Fetch news sentiment data
	useEffect(() => {
		if (!sector) {
			setNewsData(null);
			return;
		}

		const fetchSentiment = async () => {
			setLoading(true);
			setError(null);

			try {
				const response = await fetch(`/api/news/sentiment?sector=${sector}`);
				const data = await response.json();

				if (data.success) {
					setNewsData(data);
				} else {
					throw new Error(data.error || "Failed to fetch sentiment");
				}
			} catch (err) {
				console.error("Sentiment fetch error:", err);
				setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				setLoading(false);
			}
		};

		fetchSentiment();

		// Auto-refresh when real-time is enabled
		let interval: NodeJS.Timeout | null = null;
		if (realTimeEnabled) {
			interval = setInterval(fetchSentiment, 5 * 60 * 1000); // Every 5 minutes
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [sector, realTimeEnabled]);

	// Sentiment display helpers
	const getSentimentColor = (sentiment: string) => {
		switch (sentiment) {
			case "positive":
				return "text-green-400";
			case "negative":
				return "text-red-400";
			default:
				return "text-gray-400";
		}
	};

	const getSentimentEmoji = (sentiment: string) => {
		switch (sentiment) {
			case "positive":
				return "📈";
			case "negative":
				return "📉";
			default:
				return "➡️";
		}
	};

	const getTrendingEmoji = (trending: string) => {
		switch (trending) {
			case "up":
				return "⬆️";
			case "down":
				return "⬇️";
			default:
				return "↔️";
		}
	};

	const getImpactColor = (impact: string) => {
		switch (impact) {
			case "high":
				return "text-orange-400";
			case "medium":
				return "text-yellow-400";
			default:
				return "text-blue-400";
		}
	};

	const formatTimeAgo = (timestamp: number) => {
		const minutes = Math.floor((Date.now() - timestamp) / 60000);
		if (minutes < 1) return "just now";
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	};

	if (!sector) {
		return (
			<div className="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-4 text-center">
				<div className="text-gray-400 text-sm">
					📰 Select a sector to view news sentiment
				</div>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-4">
				<div className="flex items-center justify-center space-x-2">
					<div className="animate-spin rounded-full h-4 w-4 border-2 border-cyan-400 border-t-transparent"></div>
					<div className="text-gray-400 text-sm">Analyzing sentiment...</div>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="bg-red-500/10 backdrop-blur border border-red-500/30 rounded-xl p-4">
				<div className="text-red-400 text-sm">⚠️ Failed to load sentiment: {error}</div>
			</div>
		);
	}

	if (!newsData) return null;

	return (
		<div className="bg-gray-800/60 backdrop-blur border border-gray-700/50 rounded-xl p-4 transition-all duration-300">
			{/* Header */}
			<div className="flex items-center justify-between mb-3">
				<div className="flex items-center space-x-2">
					<span className="text-lg">📰</span>
					<h3 className="text-white font-medium text-sm">News Sentiment</h3>
					{realTimeEnabled && (
						<div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
					)}
				</div>
				<button
					onClick={() => setExpanded(!expanded)}
					className="text-gray-400 hover:text-white text-xs transition-colors"
				>
					{expanded ? "⬆️" : "⬇️"}
				</button>
			</div>

			{/* Sentiment Summary */}
			<div className="flex items-center justify-between mb-2">
				<div className="flex items-center space-x-2">
					<span
						className={`text-lg ${getSentimentColor(newsData.overallSentiment.label)}`}
					>
						{getSentimentEmoji(newsData.overallSentiment.label)}
					</span>
					<span
						className={`text-sm font-medium ${getSentimentColor(newsData.overallSentiment.label)}`}
					>
						{newsData.overallSentiment.label.toUpperCase()}
					</span>
					<span className="text-gray-400 text-xs">
						({(newsData.overallSentiment.score * 100).toFixed(0)}%)
					</span>
				</div>

				<div className="flex items-center space-x-3 text-xs">
					{/* Trending */}
					<div className="flex items-center space-x-1">
						<span>{getTrendingEmoji(newsData.overallSentiment.trending)}</span>
						<span className="text-gray-400 capitalize">
							{newsData.overallSentiment.trending}
						</span>
					</div>

					{/* Market Impact */}
					<div
						className={`px-2 py-1 rounded-full ${getImpactColor(newsData.marketImpact)} bg-current/10 text-xs font-medium`}
					>
						{newsData.marketImpact.toUpperCase()}
					</div>
				</div>
			</div>

			{/* Articles Count & Source */}
			<div className="text-xs text-gray-500 mb-3">
				{newsData.articles.length} articles • {newsData.source} •{" "}
				{formatTimeAgo(newsData.timestamp)}
			</div>

			{/* Expanded Content */}
			{expanded && (
				<div className="border-t border-gray-700/50 pt-3 space-y-3">
					{/* Top Articles */}
					<div>
						<h4 className="text-xs font-medium text-gray-300 mb-2">Recent Headlines</h4>
						<div className="space-y-2 max-h-40 overflow-y-auto">
							{newsData.articles.slice(0, 5).map((article, index) => (
								<div
									key={index}
									className="flex items-start space-x-2 p-2 rounded-lg bg-gray-700/30"
								>
									<span
										className={`text-xs ${getSentimentColor(article.sentiment.label)}`}
									>
										{getSentimentEmoji(article.sentiment.label)}
									</span>
									<div className="flex-1 min-w-0">
										<p className="text-xs text-gray-200 font-medium truncate">
											{article.title}
										</p>
										<div className="flex items-center space-x-2 mt-1">
											<span className="text-xs text-gray-500">
												{article.source}
											</span>
											{article.keywords.length > 0 && (
												<div className="flex space-x-1">
													{article.keywords
														.slice(0, 2)
														.map((keyword, idx) => (
															<span
																key={idx}
																className="px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded text-xs"
															>
																{keyword}
															</span>
														))}
												</div>
											)}
										</div>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* Sentiment Distribution */}
					<div>
						<h4 className="text-xs font-medium text-gray-300 mb-2">
							Sentiment Breakdown
						</h4>
						<div className="flex space-x-2">
							{["positive", "neutral", "negative"].map(sentiment => {
								const count = newsData.articles.filter(
									a => a.sentiment.label === sentiment
								).length;
								const percentage = (count / newsData.articles.length) * 100;
								return (
									<div key={sentiment} className="flex-1 text-center">
										<div
											className={`text-xs ${getSentimentColor(sentiment)} font-medium`}
										>
											{percentage.toFixed(0)}%
										</div>
										<div className="text-xs text-gray-500 capitalize">
											{sentiment}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
