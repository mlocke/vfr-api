/**
 * Simplified Stock Selection Service
 * Direct API implementation replacing complex MCP-based architecture
 * Focuses on KISS principles and rapid development
 */

import { financialDataService, StockData } from "../financial-data";

export interface SimpleSelectionRequest {
	mode: "single" | "sector" | "multiple";
	symbols?: string[];
	sector?: string;
	limit?: number;
	preferredProvider?: string;
}

export interface SimpleSelectionResponse {
	success: boolean;
	data?: {
		stocks: StockData[];
		metadata: {
			mode: string;
			count: number;
			timestamp: number;
			sources: string[];
			executionTime: number;
		};
	};
	error?: string;
}

export class SimpleStockSelectionService {
	/**
	 * Main selection method with simplified logic
	 */
	async selectStocks(request: SimpleSelectionRequest): Promise<SimpleSelectionResponse> {
		const startTime = Date.now();

		try {
			const { mode, symbols, sector, limit = 20, preferredProvider } = request;
			let stocks: StockData[] = [];
			const sources = new Set<string>();

			switch (mode) {
				case "single":
					if (!symbols || symbols.length === 0) {
						return this.errorResponse("Symbol required for single mode");
					}

					const stockData = await financialDataService.getStockPrice(symbols[0]);
					if (stockData) {
						stocks = [stockData];
						sources.add(stockData.source);
					}
					break;

				case "sector":
					if (!sector) {
						return this.errorResponse("Sector required for sector mode");
					}

					stocks = await financialDataService.getStocksBySector(sector, limit);
					stocks.forEach(stock => sources.add(stock.source));
					break;

				case "multiple":
					if (!symbols || symbols.length === 0) {
						return this.errorResponse("Symbols required for multiple mode");
					}

					stocks = await financialDataService.getMultipleStocks(symbols.slice(0));
					stocks.forEach(stock => sources.add(stock.source));
					break;

				default:
					return this.errorResponse("Invalid selection mode");
			}

			const executionTime = Date.now() - startTime;

			return {
				success: true,
				data: {
					stocks,
					metadata: {
						mode,
						count: stocks.length,
						timestamp: Date.now(),
						sources: Array.from(sources),
						executionTime,
					},
				},
			};
		} catch (error) {
			console.error("Stock selection error:", error);
			return this.errorResponse(
				error instanceof Error ? error.message : "Internal server error"
			);
		}
	}

	/**
	 * Health check for the service
	 */
	async healthCheck(): Promise<{ status: "healthy" | "unhealthy"; providers: any[] }> {
		try {
			const providerHealth = await financialDataService.getProviderHealth();
			const allHealthy = providerHealth.every(provider => provider.healthy);

			return {
				status: allHealthy ? "healthy" : "unhealthy",
				providers: providerHealth,
			};
		} catch (error) {
			return {
				status: "unhealthy",
				providers: [],
			};
		}
	}

	/**
	 * Get available providers
	 */
	getAvailableProviders(): string[] {
		return financialDataService.getProviderNames();
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		financialDataService.clearCache();
	}

	/**
	 * Create error response
	 */
	private errorResponse(message: string): SimpleSelectionResponse {
		return {
			success: false,
			error: message,
		};
	}
}

// Singleton instance
export const simpleStockSelectionService = new SimpleStockSelectionService();
