/**
 * Reddit API Provider for WSB Sentiment Analysis
 * Integrates with Reddit API for r/wallstreetbets sentiment data
 */

import { FinancialDataProvider, ApiResponse } from "../types.js";
import {
	RedditPost,
	RedditComment,
	RedditSentimentData,
	RedditAPIResponse,
	SentimentAnalysisConfig,
} from "../types/sentiment-types";
import { SecurityValidator } from "../../security/SecurityValidator";

export class RedditAPI implements FinancialDataProvider {
	name = "RedditAPI";
	private baseUrl = "https://oauth.reddit.com";
	private authUrl = "https://www.reddit.com/api/v1/access_token";
	private clientId: string;
	private clientSecret: string;
	private userAgent: string;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;
	private timeout: number;
	private throwErrors: boolean;
	private securityValidator: SecurityValidator;

	constructor(
		clientId?: string,
		clientSecret?: string,
		userAgent?: string,
		timeout = 15000,
		throwErrors = false
	) {
		this.clientId = clientId || process.env.REDDIT_CLIENT_ID || "";
		this.clientSecret = clientSecret || process.env.REDDIT_CLIENT_SECRET || "";
		this.userAgent = userAgent || process.env.REDDIT_USER_AGENT || "VFR-API/1.0";
		this.timeout = timeout;
		this.throwErrors = throwErrors;
		this.securityValidator = SecurityValidator.getInstance();

		if (!this.clientId || !this.clientSecret) {
			console.warn(
				"Reddit API credentials missing. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET."
			);
			if (this.throwErrors) {
				throw new Error("Reddit API credentials are required.");
			}
		}
	}

	/**
	 * Get OAuth2 access token for Reddit API
	 */
	private async getAccessToken(): Promise<string> {
		// Return cached token if still valid
		if (this.accessToken && Date.now() < this.tokenExpiry) {
			return this.accessToken;
		}

		try {
			const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");

			const response = await fetch(this.authUrl, {
				method: "POST",
				headers: {
					Authorization: `Basic ${auth}`,
					"Content-Type": "application/x-www-form-urlencoded",
					"User-Agent": this.userAgent,
				},
				body: "grant_type=client_credentials",
				signal: AbortSignal.timeout(this.timeout),
			});

			if (!response.ok) {
				throw new Error(`Reddit OAuth failed: ${response.status}`);
			}

			const data = await response.json();
			this.accessToken = data.access_token;
			this.tokenExpiry = Date.now() + data.expires_in * 1000 - 60000; // 1 min buffer

			return this.accessToken!;
		} catch (error) {
			console.error("Reddit OAuth error:", error);
			throw new Error("Failed to authenticate with Reddit API");
		}
	}

	/**
	 * Make authenticated request to Reddit API
	 */
	private async makeRequest(endpoint: string): Promise<any> {
		const token = await this.getAccessToken();

		const response = await fetch(`${this.baseUrl}${endpoint}`, {
			headers: {
				Authorization: `Bearer ${token}`,
				"User-Agent": this.userAgent,
			},
			signal: AbortSignal.timeout(this.timeout),
		});

		if (!response.ok) {
			throw new Error(`Reddit API error: ${response.status}`);
		}

		return response.json();
	}

	/**
	 * Get hot posts from r/wallstreetbets
	 */
	async getWSBHotPosts(limit = 25): Promise<ApiResponse<RedditPost[]>> {
		try {
			const data = await this.makeRequest(`/r/wallstreetbets/hot?limit=${limit}`);

			const posts: RedditPost[] = data.data.children.map((child: any) => ({
				id: child.data.id,
				title: child.data.title,
				selftext: child.data.selftext,
				score: child.data.score,
				upvote_ratio: child.data.upvote_ratio,
				num_comments: child.data.num_comments,
				created_utc: child.data.created_utc,
				author: child.data.author,
				url: child.data.url,
				permalink: child.data.permalink,
				flair_text: child.data.link_flair_text,
			}));

			return {
				success: true,
				data: posts,
				source: this.name,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Reddit WSB posts error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: this.name,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Get new posts from r/wallstreetbets
	 */
	async getWSBNewPosts(limit = 25): Promise<ApiResponse<RedditPost[]>> {
		try {
			const data = await this.makeRequest(`/r/wallstreetbets/new?limit=${limit}`);

			const posts: RedditPost[] = data.data.children.map((child: any) => ({
				id: child.data.id,
				title: child.data.title,
				selftext: child.data.selftext,
				score: child.data.score,
				upvote_ratio: child.data.upvote_ratio,
				num_comments: child.data.num_comments,
				created_utc: child.data.created_utc,
				author: child.data.author,
				url: child.data.url,
				permalink: child.data.permalink,
				flair_text: child.data.link_flair_text,
			}));

			return {
				success: true,
				data: posts,
				source: this.name,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Reddit WSB new posts error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: this.name,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Search posts in r/wallstreetbets for a specific symbol
	 */
	async searchWSBPosts(symbol: string, limit = 10): Promise<ApiResponse<RedditPost[]>> {
		try {
			const query = encodeURIComponent(`${symbol} subreddit:wallstreetbets`);
			const data = await this.makeRequest(
				`/search?q=${query}&limit=${limit}&sort=relevance&t=week`
			);

			const posts: RedditPost[] = data.data.children
				.filter((child: any) => child.data.subreddit === "wallstreetbets")
				.map((child: any) => ({
					id: child.data.id,
					title: child.data.title,
					selftext: child.data.selftext,
					score: child.data.score,
					upvote_ratio: child.data.upvote_ratio,
					num_comments: child.data.num_comments,
					created_utc: child.data.created_utc,
					author: child.data.author,
					url: child.data.url,
					permalink: child.data.permalink,
					flair_text: child.data.link_flair_text,
				}));

			return {
				success: true,
				data: posts,
				source: this.name,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Reddit WSB search error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: this.name,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Analyze sentiment from WSB posts for a specific symbol
	 */
	async getWSBSentiment(symbol: string): Promise<ApiResponse<RedditSentimentData>> {
		try {
			// Validate symbol to prevent injection attacks
			const validation = this.securityValidator.validateSymbol(symbol);
			if (!validation.isValid) {
				return {
					success: false,
					error: `Invalid symbol: ${validation.errors.join(", ")}`,
					source: this.name,
					timestamp: Date.now(),
				};
			}

			// Use sanitized symbol for search
			const sanitizedSymbol = validation.sanitized || symbol;
			const posts = await this.searchWSBPosts(sanitizedSymbol, 20);

			if (!posts.success || !posts.data) {
				throw new Error("Failed to fetch WSB posts");
			}

			// Basic sentiment analysis based on Reddit metrics
			const totalPosts = posts.data.length;

			// Handle case where no posts are found to prevent NaN values
			if (totalPosts === 0) {
				const sentimentData: RedditSentimentData = {
					symbol,
					sentiment: 0.5, // Neutral sentiment when no data available
					confidence: 0, // Zero confidence with no posts
					postCount: 0,
					avgScore: 0,
					avgUpvoteRatio: 0.5, // Neutral upvote ratio
					totalComments: 0,
					timeframe: "7d",
					lastUpdated: Date.now(),
					topPosts: [],
				};

				return {
					success: true,
					data: sentimentData,
					source: this.name,
					timestamp: Date.now(),
				};
			}

			const avgScore = posts.data.reduce((sum, post) => sum + post.score, 0) / totalPosts;
			const avgUpvoteRatio =
				posts.data.reduce((sum, post) => sum + post.upvote_ratio, 0) / totalPosts;
			const totalComments = posts.data.reduce((sum, post) => sum + post.num_comments, 0);

			// Calculate sentiment score (0-1 scale)
			const scoreNormalized = Math.min(Math.max(avgScore / 100, 0), 1); // Normalize score to 0-1
			const upvoteWeight = avgUpvoteRatio; // Already 0-1
			const engagementWeight = Math.min(totalComments / 1000, 1); // Normalize comments

			const sentimentScore =
				scoreNormalized * 0.4 + upvoteWeight * 0.4 + engagementWeight * 0.2;

			const sentimentData: RedditSentimentData = {
				symbol,
				sentiment: sentimentScore,
				confidence: Math.min(totalPosts / 10, 1), // More posts = higher confidence
				postCount: totalPosts,
				avgScore,
				avgUpvoteRatio,
				totalComments,
				timeframe: "7d",
				lastUpdated: Date.now(),
				topPosts: posts.data.slice(0, 5).map(post => ({
					title: post.title,
					score: post.score,
					comments: post.num_comments,
					url: `https://reddit.com${post.permalink}`,
				})),
			};

			return {
				success: true,
				data: sentimentData,
				source: this.name,
				timestamp: Date.now(),
			};
		} catch (error) {
			console.error("Reddit WSB sentiment error:", error);
			return {
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				source: this.name,
				timestamp: Date.now(),
			};
		}
	}

	/**
	 * Health check for Reddit API
	 */
	async healthCheck(): Promise<boolean> {
		try {
			await this.getAccessToken();
			return true;
		} catch (error) {
			return false;
		}
	}

	// Required by FinancialDataProvider interface (not used for Reddit)
	async getStockPrice(): Promise<null> {
		return null;
	}

	async getHistoricalOHLC(): Promise<never[]> {
		return [];
	}

	async getCompanyInfo(): Promise<null> {
		return null;
	}

	async getStocksBySector(): Promise<never[]> {
		return [];
	}

	async getFundamentalRatios(): Promise<null> {
		return null;
	}

	async getAnalystRatings(): Promise<null> {
		return null;
	}

	async getPriceTargets(): Promise<null> {
		return null;
	}

	async getMarketData(): Promise<null> {
		return null;
	}
}

export default RedditAPI;
