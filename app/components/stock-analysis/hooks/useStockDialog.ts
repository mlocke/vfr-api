/**
 * useStockDialog - Custom React hook for stock dialog state management
 * Provides comprehensive state management for the interactive stock dialog
 * Integrates with Next.js 15 and React 19 patterns
 */

"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { DialogStockData, DialogState, DialogAPIResponse } from "../types";

/**
 * Configuration options for the dialog hook
 */
interface UseStockDialogOptions {
	autoRefreshInterval?: number; // Auto refresh every N milliseconds
	cacheTimeout?: number; // Cache data for N milliseconds
	maxRetries?: number; // Maximum retry attempts on failure
	enableAnalytics?: boolean; // Track dialog usage
}

/**
 * Return type for the useStockDialog hook
 */
interface UseStockDialogReturn {
	// State
	isOpen: boolean;
	isLoading: boolean;
	error: string | null;
	stockData: DialogStockData | null;
	expandedInsights: Set<string>;
	expandedRisksOpportunities: boolean;
	lastUpdated: number;

	// Actions
	openDialog: (symbol: string) => Promise<void>;
	closeDialog: () => void;
	refreshDialog: () => Promise<void>;
	toggleInsight: (insightId: string) => void;
	toggleRisksOpportunities: () => void;
	clearError: () => void;

	// Computed values
	isStale: boolean;
	hasData: boolean;
	canRefresh: boolean;
}

/**
 * Cache for dialog data to avoid repeated API calls
 */
const dialogCache = new Map<
	string,
	{
		data: DialogStockData;
		timestamp: number;
		ttl: number;
	}
>();

/**
 * Default options for the dialog hook
 */
const DEFAULT_OPTIONS: UseStockDialogOptions = {
	autoRefreshInterval: 0, // Disabled by default
	cacheTimeout: 2 * 60 * 1000, // 2 minutes
	maxRetries: 3,
	enableAnalytics: true,
};

/**
 * Custom hook for managing stock dialog state
 */
export const useStockDialog = (
	initialSymbol?: string,
	options: UseStockDialogOptions = {}
): UseStockDialogReturn => {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Core state
	const [isOpen, setIsOpen] = useState(false);
	const [currentSymbol, setCurrentSymbol] = useState<string | null>(initialSymbol || null);
	const [state, setState] = useState<DialogState>({
		stockData: null,
		loading: false,
		error: null,
		expandedInsights: new Set(),
		expandedRisksOpportunities: false,
		lastUpdated: 0,
		refreshing: false,
	});

	// Refs for managing side effects
	const abortControllerRef = useRef<AbortController | null>(null);
	const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
	const retryCountRef = useRef(0);

	/**
	 * Check if cached data is still valid
	 */
	const getCachedData = useCallback((symbol: string): DialogStockData | null => {
		const cached = dialogCache.get(symbol);
		if (cached && Date.now() - cached.timestamp < cached.ttl) {
			return cached.data;
		}
		return null;
	}, []);

	/**
	 * Cache dialog data
	 */
	const setCachedData = useCallback(
		(symbol: string, data: DialogStockData) => {
			dialogCache.set(symbol, {
				data,
				timestamp: Date.now(),
				ttl: opts.cacheTimeout!,
			});
		},
		[opts.cacheTimeout]
	);

	/**
	 * Fetch dialog data from API
	 */
	const fetchDialogData = useCallback(
		async (symbol: string): Promise<DialogStockData> => {
			// Cancel any existing request
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}

			// Create new abort controller
			abortControllerRef.current = new AbortController();

			try {
				const response = await fetch(`/api/stocks/dialog/${symbol}`, {
					signal: abortControllerRef.current.signal,
					headers: {
						"Content-Type": "application/json",
					},
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						errorData.error || `HTTP ${response.status}: ${response.statusText}`
					);
				}

				const result: DialogAPIResponse = await response.json();

				if (!result.success || !result.data) {
					throw new Error(result.error || "Failed to fetch dialog data");
				}

				// Cache the successful result
				setCachedData(symbol, result.data);

				return result.data;
			} catch (error) {
				if (error instanceof Error && error.name === "AbortError") {
					// Request was cancelled, don't throw
					throw new Error("Request cancelled");
				}

				throw error;
			}
		},
		[setCachedData]
	);

	/**
	 * Open dialog and load data for symbol
	 */
	const openDialog = useCallback(
		async (symbol: string) => {
			setCurrentSymbol(symbol);
			setIsOpen(true);

			// Check cache first
			const cachedData = getCachedData(symbol);
			if (cachedData) {
				setState(prev => ({
					...prev,
					stockData: cachedData,
					loading: false,
					error: null,
					lastUpdated: Date.now(),
				}));

				// Track analytics
				if (opts.enableAnalytics) {
					console.log(`Dialog opened for ${symbol} (cached)`);
				}

				return;
			}

			// Load fresh data
			setState(prev => ({
				...prev,
				loading: true,
				error: null,
				stockData: null,
			}));

			try {
				retryCountRef.current = 0;
				const data = await fetchDialogData(symbol);

				setState(prev => ({
					...prev,
					stockData: data,
					loading: false,
					error: null,
					lastUpdated: Date.now(),
				}));

				// Track analytics
				if (opts.enableAnalytics) {
					console.log(`Dialog opened for ${symbol} (fresh data)`);
				}

				// Set up auto-refresh if enabled
				if (opts.autoRefreshInterval && opts.autoRefreshInterval > 0) {
					refreshTimerRef.current = setInterval(() => {
						refreshDialog();
					}, opts.autoRefreshInterval);
				}
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : "Unknown error occurred";

				setState(prev => ({
					...prev,
					loading: false,
					error: errorMessage,
				}));

				// Track error analytics
				if (opts.enableAnalytics) {
					console.error(`Dialog error for ${symbol}:`, errorMessage);
				}
			}
		},
		[getCachedData, fetchDialogData, opts.enableAnalytics, opts.autoRefreshInterval]
	);

	/**
	 * Close dialog and clean up
	 */
	const closeDialog = useCallback(() => {
		setIsOpen(false);
		setCurrentSymbol(null);

		// Clear auto-refresh timer
		if (refreshTimerRef.current) {
			clearInterval(refreshTimerRef.current);
			refreshTimerRef.current = null;
		}

		// Cancel any pending requests
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}

		// Reset expanded state
		setState(prev => ({
			...prev,
			expandedInsights: new Set(),
			expandedRisksOpportunities: false,
			refreshing: false,
		}));

		// Track analytics
		if (opts.enableAnalytics && currentSymbol) {
			console.log(`Dialog closed for ${currentSymbol}`);
		}
	}, [currentSymbol, opts.enableAnalytics]);

	/**
	 * Refresh current dialog data
	 */
	const refreshDialog = useCallback(async () => {
		if (!currentSymbol || state.loading) return;

		setState(prev => ({ ...prev, refreshing: true, error: null }));

		try {
			const data = await fetchDialogData(currentSymbol);

			setState(prev => ({
				...prev,
				stockData: data,
				refreshing: false,
				error: null,
				lastUpdated: Date.now(),
			}));

			retryCountRef.current = 0;

			// Track analytics
			if (opts.enableAnalytics) {
				console.log(`Dialog refreshed for ${currentSymbol}`);
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Failed to refresh data";

			// Implement retry logic
			if (retryCountRef.current < opts.maxRetries!) {
				retryCountRef.current++;
				console.warn(
					`Retry ${retryCountRef.current}/${opts.maxRetries} for ${currentSymbol}`
				);

				// Exponential backoff
				setTimeout(
					() => {
						refreshDialog();
					},
					Math.pow(2, retryCountRef.current) * 1000
				);

				return;
			}

			setState(prev => ({
				...prev,
				refreshing: false,
				error: errorMessage,
			}));

			// Track error analytics
			if (opts.enableAnalytics) {
				console.error(`Dialog refresh failed for ${currentSymbol}:`, errorMessage);
			}
		}
	}, [currentSymbol, state.loading, fetchDialogData, opts.enableAnalytics, opts.maxRetries]);

	/**
	 * Toggle insight expansion state
	 */
	const toggleInsight = useCallback(
		(insightId: string) => {
			setState(prev => {
				const newExpanded = new Set(prev.expandedInsights);
				if (newExpanded.has(insightId)) {
					newExpanded.delete(insightId);
				} else {
					newExpanded.add(insightId);
				}
				return {
					...prev,
					expandedInsights: newExpanded,
				};
			});

			// Track analytics
			if (opts.enableAnalytics) {
				console.log(`Insight ${insightId} toggled for ${currentSymbol}`);
			}
		},
		[currentSymbol, opts.enableAnalytics]
	);

	/**
	 * Toggle risks & opportunities section
	 */
	const toggleRisksOpportunities = useCallback(() => {
		setState(prev => ({
			...prev,
			expandedRisksOpportunities: !prev.expandedRisksOpportunities,
		}));

		// Track analytics
		if (opts.enableAnalytics) {
			console.log(`Risks & opportunities toggled for ${currentSymbol}`);
		}
	}, [currentSymbol, opts.enableAnalytics]);

	/**
	 * Clear error state
	 */
	const clearError = useCallback(() => {
		setState(prev => ({ ...prev, error: null }));
	}, []);

	/**
	 * Cleanup on unmount
	 */
	useEffect(() => {
		return () => {
			if (refreshTimerRef.current) {
				clearInterval(refreshTimerRef.current);
			}
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
		};
	}, []);

	/**
	 * Computed values
	 */
	const isStale = state.lastUpdated > 0 && Date.now() - state.lastUpdated > opts.cacheTimeout!;
	const hasData = state.stockData !== null;
	const canRefresh = !state.loading && !state.refreshing && currentSymbol !== null;

	return {
		// State
		isOpen,
		isLoading: state.loading || state.refreshing,
		error: state.error,
		stockData: state.stockData,
		expandedInsights: state.expandedInsights,
		expandedRisksOpportunities: state.expandedRisksOpportunities,
		lastUpdated: state.lastUpdated,

		// Actions
		openDialog,
		closeDialog,
		refreshDialog,
		toggleInsight,
		toggleRisksOpportunities,
		clearError,

		// Computed values
		isStale,
		hasData,
		canRefresh,
	};
};
