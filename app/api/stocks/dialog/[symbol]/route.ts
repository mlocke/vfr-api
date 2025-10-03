/**
 * Stock Analysis Dialog API Endpoint
 * Provides comprehensive stock data specifically formatted for the interactive dialog
 * Integrates with existing StockSelectionService and VFR platform architecture
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Dialog-specific response interface
 */
interface DialogStockData {
	symbol: string;
	score: {
		overall: number;
		technical: number;
		fundamental: number;
		sentiment: number;
		macro: number;
		alternative: number;
	};
	weight: number;
	action: "BUY" | "SELL" | "HOLD";
	confidence: number;
	context: {
		sector: string;
		marketCap: number;
		priceChange24h?: number;
		volumeChange24h?: number;
		beta?: number;
		currentPrice?: number;
		preMarketPrice?: number;
		preMarketChange?: number;
		preMarketChangePercent?: number;
		afterHoursPrice?: number;
		afterHoursChange?: number;
		afterHoursChangePercent?: number;
		marketStatus?: "pre-market" | "market-hours" | "after-hours" | "closed";
	};
	reasoning: {
		primaryFactors: string[];
		warnings?: string[];
		opportunities?: string[];
	};
	dataQuality: {
		overall: {
			overall: number;
			timestamp: number;
			source: string;
			metrics: {
				freshness: number;
				completeness: number;
				accuracy: number;
				sourceReputation: number;
				latency: number;
			};
		};
		lastUpdated: number;
	};
	sentimentBreakdown?: {
		newsScore: number;
		redditScore: number;
		analystScore: number;
		overallSentiment: string;
		confidence: number;
	};
	realtime?: {
		price: number;
		change: number;
		changePercent: number;
		volume: number;
		timestamp: number;
	};
}

interface DialogResponse {
	success: boolean;
	data?: DialogStockData;
	error?: string;
	metadata?: {
		executionTime: number;
		dataSourcesUsed: string[];
		cacheHit: boolean;
		analysisMode: string;
	};
}

/**
 * GET /api/stocks/dialog/[symbol]
 * Fetches comprehensive dialog data for a single stock symbol
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ symbol: string }> }
): Promise<NextResponse<DialogResponse>> {
	const startTime = Date.now();
	let dataSourcesUsed: string[] = [];

	try {
		const { symbol } = await params;

		// Basic symbol validation
		if (!symbol || typeof symbol !== "string" || symbol.length === 0) {
			return NextResponse.json(
				{
					success: false,
					error: "Invalid symbol provided",
				},
				{ status: 400 }
			);
		}

		// For now, return mock data that matches the expected interface
		// This will be replaced with actual service integration later
		const mockDialogData: DialogStockData = {
			symbol: symbol.toUpperCase(),
			score: {
				overall: 0.75,
				technical: 0.8,
				fundamental: 0.7,
				sentiment: 0.6,
				macro: 0.75,
				alternative: 0.65,
			},
			weight: 0.8,
			action: "BUY" as const,
			confidence: 0.75,
			context: {
				sector: "Technology",
				marketCap: 2500000000000,
				priceChange24h: 2.35,
				volumeChange24h: 15.2,
				beta: 1.2,
				currentPrice: 185.3,
				marketStatus: "market-hours" as const,
			},
			reasoning: {
				primaryFactors: [
					"Strong technical momentum with breakout above key resistance",
					"Solid fundamental metrics with improving profit margins",
					"Positive analyst sentiment with recent upgrades",
				],
				warnings: [
					"High valuation multiples suggest caution",
					"Market volatility could impact short-term performance",
				],
				opportunities: [
					"Potential for continued growth in core business segments",
					"Strategic partnerships could drive future expansion",
				],
			},
			dataQuality: {
				overall: {
					overall: 0.85,
					timestamp: Date.now(),
					source: "VFR-Mock",
					metrics: {
						freshness: 0.9,
						completeness: 0.8,
						accuracy: 0.85,
						sourceReputation: 0.9,
						latency: 150,
					},
				},
				lastUpdated: Date.now(),
			},
			sentimentBreakdown: {
				newsScore: 0.65,
				redditScore: 0.55,
				analystScore: 0.75,
				overallSentiment: "positive",
				confidence: 0.7,
			},
			realtime: {
				price: 185.3,
				change: 4.35,
				changePercent: 2.35,
				volume: 45000000,
				timestamp: Date.now(),
			},
		};

		const executionTime = Date.now() - startTime;

		return NextResponse.json(
			{
				success: true,
				data: mockDialogData,
				metadata: {
					executionTime,
					dataSourcesUsed: ["Mock"],
					cacheHit: false,
					analysisMode: "dialog_single_stock",
				},
			},
			{
				status: 200,
				headers: {
					"Cache-Control": "public, max-age=120, stale-while-revalidate=300",
					"Content-Type": "application/json",
				},
			}
		);
	} catch (error) {
		const { symbol } = await params;
		console.error(`Dialog API error for symbol ${symbol}:`, error);
		const executionTime = Date.now() - startTime;

		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error occurred",
				metadata: {
					executionTime,
					dataSourcesUsed,
					cacheHit: false,
					analysisMode: "dialog_single_stock",
				},
			},
			{ status: 500 }
		);
	}
}

/**
 * Handle unsupported HTTP methods
 */
export async function POST(): Promise<NextResponse> {
	return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}

export async function PUT(): Promise<NextResponse> {
	return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
	return NextResponse.json({ success: false, error: "Method not allowed" }, { status: 405 });
}
