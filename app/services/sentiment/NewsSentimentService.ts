/**
 * News Sentiment Service
 * ======================
 *
 * Manages a long-lived Python subprocess running FinBERT sentiment analysis.
 * Scores news articles on a scale from -1 (bearish) to +1 (bullish).
 *
 * Features:
 * - Pre-trained FinBERT (no training required)
 * - Persistent subprocess (model loaded once)
 * - Redis caching (15-min TTL)
 * - Batch scoring for efficiency
 * - Health monitoring
 *
 * Usage:
 *   const service = NewsSentimentService.getInstance();
 *   const sentiment = await service.scoreArticle("Apple announces record earnings");
 *   // => { score: 0.742, confidence: 0.856, label: 'positive' }
 */

import { spawn, ChildProcess } from "child_process";
import * as path from "path";
import * as readline from "readline";
import Redis from "ioredis";

export interface NewsSentiment {
	score: number; // -1 (bearish) to +1 (bullish)
	confidence: number; // 0 to 1
	label: "positive" | "negative" | "neutral";
	probabilities: {
		negative: number;
		neutral: number;
		positive: number;
	};
}

export interface NewsArticle {
	title: string;
	description?: string;
	published_utc?: string;
}

interface PythonRequest {
	command: "score" | "score_batch" | "ping" | "shutdown";
	text?: string;
	articles?: NewsArticle[];
}

interface PythonResponse {
	success: boolean;
	error?: string;
	score?: number;
	confidence?: number;
	label?: string;
	probabilities?: {
		negative: number;
		neutral: number;
		positive: number;
	};
	results?: NewsSentiment[];
	message?: string;
}

export class NewsSentimentService {
	private static instance: NewsSentimentService;
	private pythonProcess: ChildProcess | null = null;
	private readline: readline.Interface | null = null;
	private redis: Redis | null = null;
	private isReady: boolean = false;
	private requestQueue: Map<
		number,
		{
			resolve: (value: any) => void;
			reject: (reason: any) => void;
		}
	> = new Map();
	private requestId: number = 0;

	private readonly CACHE_TTL = 900; // 15 minutes
	private readonly PYTHON_SCRIPT = path.join(
		process.cwd(),
		"scripts/ml/sentiment/score-news-sentiment.py"
	);

	private constructor() {
		// Singleton - use getInstance()
	}

	/**
	 * Get singleton instance
	 */
	public static getInstance(): NewsSentimentService {
		if (!NewsSentimentService.instance) {
			NewsSentimentService.instance = new NewsSentimentService();
		}
		return NewsSentimentService.instance;
	}

	/**
	 * Initialize service (start Python subprocess)
	 */
	public async initialize(): Promise<void> {
		if (this.isReady) {
			return;
		}

		console.log("[NewsSentimentService] Initializing...");

		// Connect to Redis
		try {
			this.redis = new Redis({
				host: process.env.REDIS_HOST || "localhost",
				port: parseInt(process.env.REDIS_PORT || "6379"),
				password: process.env.REDIS_PASSWORD,
			});

			this.redis.on("error", (err) => {
				console.error("[NewsSentimentService] Redis error:", err);
			});

			console.log("[NewsSentimentService] Connected to Redis");
		} catch (error) {
			console.warn("[NewsSentimentService] Redis unavailable, caching disabled");
		}

		// Start Python subprocess
		await this.startPythonProcess();

		// Test with ping
		const pingResponse = await this.sendRequest({ command: "ping" });
		if (!pingResponse.success) {
			throw new Error("Python subprocess failed health check");
		}

		this.isReady = true;
		console.log("[NewsSentimentService] Ready");
	}

	/**
	 * Start Python subprocess
	 */
	private async startPythonProcess(): Promise<void> {
		return new Promise((resolve, reject) => {
			console.log("[NewsSentimentService] Starting Python subprocess...");

			this.pythonProcess = spawn("python3", [this.PYTHON_SCRIPT], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			// Setup readline for stdout
			this.readline = readline.createInterface({
				input: this.pythonProcess.stdout!,
			});

			// Handle responses
			this.readline.on("line", (line) => {
				try {
					const response: PythonResponse = JSON.parse(line);
					this.handleResponse(response);
				} catch (error) {
					console.error("[NewsSentimentService] Failed to parse response:", error);
				}
			});

			// Handle stderr (logs)
			this.pythonProcess.stderr!.on("data", (data) => {
				const message = data.toString().trim();
				console.log(`[NewsSentimentService] Python: ${message}`);

				// Check if model loaded successfully
				if (message.includes("Model loaded successfully")) {
					resolve();
				}
			});

			// Handle process exit
			this.pythonProcess.on("exit", (code) => {
				console.log(`[NewsSentimentService] Python process exited with code ${code}`);
				this.isReady = false;

				// Reject all pending requests
				this.requestQueue.forEach(({ reject }) => {
					reject(new Error("Python process terminated"));
				});
				this.requestQueue.clear();
			});

			// Handle errors
			this.pythonProcess.on("error", (error) => {
				console.error("[NewsSentimentService] Python process error:", error);
				reject(error);
			});

			// Timeout
			setTimeout(() => {
				if (!this.isReady) {
					reject(new Error("Python subprocess startup timeout"));
				}
			}, 30000); // 30 second timeout
		});
	}

	/**
	 * Send request to Python subprocess
	 */
	private sendRequest(request: PythonRequest): Promise<PythonResponse> {
		return new Promise((resolve, reject) => {
			if (!this.pythonProcess || !this.pythonProcess.stdin) {
				return reject(new Error("Python process not running"));
			}

			// Generate unique request ID
			const id = this.requestId++;

			// Store promise handlers
			this.requestQueue.set(id, { resolve, reject });

			// Send request
			try {
				const requestWithId = { ...request, id };
				this.pythonProcess.stdin.write(JSON.stringify(requestWithId) + "\n");
			} catch (error) {
				this.requestQueue.delete(id);
				reject(error);
			}

			// Timeout
			setTimeout(() => {
				if (this.requestQueue.has(id)) {
					this.requestQueue.delete(id);
					reject(new Error("Request timeout"));
				}
			}, 10000); // 10 second timeout
		});
	}

	/**
	 * Handle response from Python subprocess
	 */
	private handleResponse(response: PythonResponse & { id?: number }): void {
		const id = response.id;
		if (id === undefined) {
			// Response without ID, just log
			console.log("[NewsSentimentService] Received response without ID:", response);
			return;
		}

		const handlers = this.requestQueue.get(id);
		if (!handlers) {
			console.warn("[NewsSentimentService] Received response for unknown request:", id);
			return;
		}

		this.requestQueue.delete(id);

		if (response.success) {
			handlers.resolve(response);
		} else {
			handlers.reject(new Error(response.error || "Unknown error"));
		}
	}

	/**
	 * Score a single news article
	 */
	public async scoreArticle(text: string): Promise<NewsSentiment> {
		if (!this.isReady) {
			await this.initialize();
		}

		// Check cache
		const cacheKey = `sentiment:${this.hashText(text)}`;
		if (this.redis) {
			const cached = await this.redis.get(cacheKey);
			if (cached) {
				return JSON.parse(cached);
			}
		}

		// Score text
		const response = await this.sendRequest({
			command: "score",
			text,
		});

		if (!response.success || !response.score) {
			throw new Error(response.error || "Scoring failed");
		}

		const sentiment: NewsSentiment = {
			score: response.score,
			confidence: response.confidence!,
			label: response.label as "positive" | "negative" | "neutral",
			probabilities: response.probabilities!,
		};

		// Cache result
		if (this.redis) {
			await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(sentiment));
		}

		return sentiment;
	}

	/**
	 * Score multiple articles (batch)
	 */
	public async scoreArticles(articles: NewsArticle[]): Promise<NewsSentiment[]> {
		if (!this.isReady) {
			await this.initialize();
		}

		if (articles.length === 0) {
			return [];
		}

		// Send batch request
		const response = await this.sendRequest({
			command: "score_batch",
			articles,
		});

		if (!response.success || !response.results) {
			throw new Error(response.error || "Batch scoring failed");
		}

		return response.results;
	}

	/**
	 * Get health status
	 */
	public async getHealth(): Promise<{
		status: "healthy" | "unhealthy";
		pythonProcessRunning: boolean;
		redisConnected: boolean;
	}> {
		const pythonProcessRunning = this.pythonProcess !== null && this.isReady;
		const redisConnected = this.redis !== null;

		let status: "healthy" | "unhealthy" = "unhealthy";
		if (pythonProcessRunning) {
			try {
				const ping = await this.sendRequest({ command: "ping" });
				if (ping.success) {
					status = "healthy";
				}
			} catch (error) {
				console.error("[NewsSentimentService] Health check failed:", error);
			}
		}

		return {
			status,
			pythonProcessRunning,
			redisConnected,
		};
	}

	/**
	 * Shutdown service
	 */
	public async shutdown(): Promise<void> {
		console.log("[NewsSentimentService] Shutting down...");

		// Send shutdown command to Python
		if (this.pythonProcess && this.isReady) {
			try {
				await this.sendRequest({ command: "shutdown" });
			} catch (error) {
				console.warn("[NewsSentimentService] Shutdown command failed:", error);
			}
		}

		// Close Python process
		if (this.pythonProcess) {
			this.pythonProcess.kill();
			this.pythonProcess = null;
		}

		// Close Redis
		if (this.redis) {
			await this.redis.quit();
			this.redis = null;
		}

		this.isReady = false;
		console.log("[NewsSentimentService] Shutdown complete");
	}

	/**
	 * Hash text for cache key
	 */
	private hashText(text: string): string {
		// Simple hash function (for cache keys)
		let hash = 0;
		for (let i = 0; i < text.length; i++) {
			const char = text.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		return Math.abs(hash).toString(36);
	}
}

// Graceful shutdown
process.on("SIGTERM", async () => {
	await NewsSentimentService.getInstance().shutdown();
});

process.on("SIGINT", async () => {
	await NewsSentimentService.getInstance().shutdown();
});
