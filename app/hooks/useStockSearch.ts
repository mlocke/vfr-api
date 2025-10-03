/**
 * Stock Search Hook for VFR Financial Analysis Platform
 *
 * Provides fuzzy search functionality for stock symbols with:
 * - Real-time search with debouncing
 * - Client-side fuzzy matching
 * - Symbol and company name search
 * - Performance optimization
 */

import { useState, useEffect, useMemo, useCallback } from "react";

export interface StockSymbol {
	symbol: string;
	name: string;
	exchange: string;
	type: "Stock" | "ETF" | "Index";
	status: "Active" | "Delisted";
	ipoDate?: string;
	delistingDate?: string;
	sector?: string;
	marketCap?: number;
}

export interface SearchResult extends StockSymbol {
	matchScore: number;
	matchType: "symbol" | "name" | "both";
	highlightedSymbol?: string;
	highlightedName?: string;
}

interface UseStockSearchOptions {
	debounceMs?: number;
	maxResults?: number;
	minQueryLength?: number;
	enableFuzzySearch?: boolean;
}

interface UseStockSearchReturn {
	query: string;
	setQuery: (query: string) => void;
	results: SearchResult[];
	isLoading: boolean;
	error: string | null;
	selectedSymbols: string[];
	addSymbol: (symbol: string) => void;
	removeSymbol: (symbol: string) => void;
	clearSelection: () => void;
	totalSymbols: number;
	isSearching: boolean;
}

export function useStockSearch(options: UseStockSearchOptions = {}): UseStockSearchReturn {
	const {
		debounceMs = 300,
		maxResults = 50,
		minQueryLength = 1,
		enableFuzzySearch = true,
	} = options;

	// State management
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [allSymbols, setAllSymbols] = useState<StockSymbol[]>([]);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [selectedSymbols, setSelectedSymbols] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSearching, setIsSearching] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Load symbols on mount - now using dynamic FMP search
	useEffect(() => {
		// Set loading to false immediately since we're using dynamic search
		setIsLoading(false);
		console.log("📊 Using FMP dynamic search - no need to preload symbols");
	}, []);

	// Debounce query
	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query);
		}, debounceMs);

		return () => clearTimeout(timer);
	}, [query, debounceMs]);

	// Fuzzy search implementation
	const searchSymbols = useMemo(() => {
		return (searchQuery: string, symbols: StockSymbol[]): SearchResult[] => {
			if (!searchQuery || searchQuery.length < minQueryLength) {
				return [];
			}

			const queryLower = searchQuery.toLowerCase().trim();
			const queryWords = queryLower.split(/\s+/).filter(word => word.length > 0);
			const results: SearchResult[] = [];

			for (const symbol of symbols) {
				const symbolLower = symbol.symbol.toLowerCase();
				const nameLower = symbol.name.toLowerCase();

				let matchScore = 0;
				let matchType: "symbol" | "name" | "both" = "symbol";
				let symbolMatch = false;
				let nameMatch = false;

				// Exact symbol match (highest priority)
				if (symbolLower === queryLower) {
					matchScore = 100;
					symbolMatch = true;
				}
				// Symbol starts with query
				else if (symbolLower.startsWith(queryLower)) {
					matchScore = 90;
					symbolMatch = true;
				}
				// Symbol contains query
				else if (symbolLower.includes(queryLower)) {
					matchScore = 80;
					symbolMatch = true;
				}

				// Company name matching
				let nameScore = 0;
				if (enableFuzzySearch) {
					// Exact name match
					if (nameLower === queryLower) {
						nameScore = 95;
						nameMatch = true;
					}
					// Name starts with query
					else if (nameLower.startsWith(queryLower)) {
						nameScore = 85;
						nameMatch = true;
					}
					// Name contains query
					else if (nameLower.includes(queryLower)) {
						nameScore = 70;
						nameMatch = true;
					}
					// Multi-word fuzzy matching
					else {
						let wordMatches = 0;
						let totalWordScore = 0;

						for (const word of queryWords) {
							if (nameLower.includes(word)) {
								wordMatches++;
								totalWordScore += word.length;
							}
						}

						if (wordMatches > 0) {
							nameScore = Math.min(
								65,
								(wordMatches / queryWords.length) * 50 +
									(totalWordScore / queryLower.length) * 15
							);
							nameMatch = true;
						}
					}
				}

				// Determine final score and match type
				if (symbolMatch && nameMatch) {
					matchScore = Math.max(matchScore, nameScore);
					matchType = "both";
				} else if (nameMatch && nameScore > matchScore) {
					matchScore = nameScore;
					matchType = "name";
				}

				// Only include results with minimum score
				if (matchScore > 0) {
					// Boost score for common exchanges and stock types
					if (symbol.exchange === "NYSE" || symbol.exchange === "NASDAQ") {
						matchScore += 2;
					}
					if (symbol.type === "Stock") {
						matchScore += 1;
					}

					results.push({
						...symbol,
						matchScore,
						matchType,
						highlightedSymbol: highlightMatch(symbol.symbol, queryLower),
						highlightedName: highlightMatch(symbol.name, queryLower),
					});
				}
			}

			// Sort by match score (descending) and then by symbol length (ascending)
			return results
				.sort((a, b) => {
					if (b.matchScore !== a.matchScore) {
						return b.matchScore - a.matchScore;
					}
					return a.symbol.length - b.symbol.length;
				})
				.slice(0, maxResults);
		};
	}, [minQueryLength, maxResults, enableFuzzySearch]);

	// Highlight matching text
	const highlightMatch = useCallback((text: string, query: string): string => {
		if (!query || !text) return text;

		try {
			const regex = new RegExp(`(${escapeRegExp(query)})`, "gi");
			return text.replace(regex, "<mark>$1</mark>");
		} catch {
			return text;
		}
	}, []);

	// Escape regex special characters
	const escapeRegExp = useCallback((string: string): string => {
		return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	}, []);

	// Perform search when debounced query changes - using FMP API directly
	useEffect(() => {
		if (!debouncedQuery || debouncedQuery.length < minQueryLength) {
			setResults([]);
			setIsSearching(false);
			return;
		}

		let mounted = true;
		setIsSearching(true);

		const performSearch = async () => {
			try {
				// Use FMP search API directly for real-time results
				const response = await fetch(
					`/api/stocks/search?query=${encodeURIComponent(debouncedQuery)}`
				);

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();

				if (!data.success) {
					throw new Error(data.message || "Search failed");
				}

				if (mounted) {
					setResults(data.data.results || []);
					setError(null);
				}
			} catch (error) {
				console.error("❌ Search error:", error);
				if (mounted) {
					setError("Search failed. Please try again.");
					setResults([]);
				}
			} finally {
				if (mounted) {
					setIsSearching(false);
				}
			}
		};

		performSearch();

		return () => {
			mounted = false;
			setIsSearching(false);
		};
	}, [debouncedQuery, minQueryLength]);

	// Symbol selection management
	const addSymbol = useCallback((symbol: string) => {
		setSelectedSymbols(prev => {
			if (!prev.includes(symbol)) {
				const newSelection = [...prev, symbol];
				console.log("📈 Added symbol:", symbol, "Total selected:", newSelection.length);
				return newSelection;
			}
			return prev;
		});
	}, []);

	const removeSymbol = useCallback((symbol: string) => {
		setSelectedSymbols(prev => {
			const newSelection = prev.filter(s => s !== symbol);
			console.log("📉 Removed symbol:", symbol, "Total selected:", newSelection.length);
			return newSelection;
		});
	}, []);

	const clearSelection = useCallback(() => {
		setSelectedSymbols([]);
		console.log("🧹 Cleared all selected symbols");
	}, []);

	return {
		query,
		setQuery,
		results,
		isLoading,
		error,
		selectedSymbols,
		addSymbol,
		removeSymbol,
		clearSelection,
		totalSymbols: allSymbols.length,
		isSearching,
	};
}
