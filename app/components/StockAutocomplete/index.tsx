/**
 * Stock Autocomplete Component - KISS Design
 * Simple, fast, and effective stock symbol search with cyberpunk styling
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import { useStockSearch, type SearchResult } from "../../hooks/useStockSearch";
import styles from "./StockAutocomplete.module.css";

interface StockAutocompleteProps {
	onSelectionChange: (symbols: string[]) => void;
	placeholder?: string;
	maxSelections?: number;
	initialValue?: string[];
}

export default function StockAutocomplete({
	onSelectionChange,
	placeholder = "Search stocks (e.g., AAPL, Apple Inc)",
	maxSelections = 10,
	initialValue = [],
}: StockAutocompleteProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const dropdownRef = useRef<HTMLDivElement>(null);

	const {
		query,
		setQuery,
		results,
		isLoading,
		error,
		selectedSymbols,
		addSymbol,
		removeSymbol,
		clearSelection,
		isSearching,
	} = useStockSearch({
		maxResults: 20,
		minQueryLength: 1,
	});

	// Initialize with provided symbols
	useEffect(() => {
		if (initialValue.length > 0) {
			initialValue.forEach(symbol => addSymbol(symbol));
		}
	}, [initialValue, addSymbol]);

	// Notify parent of selection changes
	useEffect(() => {
		onSelectionChange(selectedSymbols);
	}, [selectedSymbols, onSelectionChange]);

	// Handle input focus/blur
	const handleFocus = () => {
		setIsOpen(true);
		setHighlightedIndex(-1);
	};

	const handleBlur = (e: React.FocusEvent) => {
		// Keep dropdown open if clicking inside it
		if (dropdownRef.current?.contains(e.relatedTarget as Node)) {
			return;
		}
		setTimeout(() => setIsOpen(false), 200);
	};

	// Handle keyboard navigation
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (!isOpen) {
			if (e.key === "ArrowDown" || e.key === "Enter") {
				setIsOpen(true);
				e.preventDefault();
			}
			return;
		}

		switch (e.key) {
			case "ArrowDown":
				e.preventDefault();
				setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
				break;

			case "ArrowUp":
				e.preventDefault();
				setHighlightedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
				break;

			case "Enter":
				e.preventDefault();
				if (highlightedIndex >= 0 && results[highlightedIndex]) {
					handleSelectSymbol(results[highlightedIndex].symbol);
				}
				break;

			case "Escape":
				setIsOpen(false);
				setHighlightedIndex(-1);
				inputRef.current?.blur();
				break;

			case "Tab":
				setIsOpen(false);
				break;
		}
	};

	// Handle symbol selection
	const handleSelectSymbol = (symbol: string) => {
		if (selectedSymbols.length >= maxSelections) {
			console.warn(`Maximum ${maxSelections} symbols allowed`);
			return;
		}

		addSymbol(symbol);
		setQuery("");
		setIsOpen(false);
		setHighlightedIndex(-1);
		inputRef.current?.focus();
	};

	// Render highlighted text
	const renderHighlightedText = (text: string, highlighted?: string) => {
		if (!highlighted || highlighted === text) {
			return text;
		}

		return <span dangerouslySetInnerHTML={{ __html: highlighted }} />;
	};

	return (
		<div className={styles.container}>
			{/* Selected symbols pills */}
			{selectedSymbols.length > 0 && (
				<div className={styles.selectedSymbols}>
					{selectedSymbols.map(symbol => (
						<div key={symbol} className={styles.symbolPill}>
							<span>{symbol}</span>
							<button
								type="button"
								className={styles.removeButton}
								onClick={() => removeSymbol(symbol)}
								aria-label={`Remove ${symbol}`}
							>
								×
							</button>
						</div>
					))}
					{selectedSymbols.length > 1 && (
						<button
							type="button"
							className={styles.clearAllButton}
							onClick={clearSelection}
						>
							Clear All
						</button>
					)}
				</div>
			)}

			{/* Search input */}
			<div className={styles.inputWrapper}>
				<input
					ref={inputRef}
					type="text"
					className={styles.input}
					placeholder={placeholder}
					value={query}
					onChange={e => setQuery(e.target.value)}
					onFocus={handleFocus}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					autoComplete="off"
					spellCheck="false"
				/>

				{isLoading ? (
					<div className={styles.loadingSpinner} />
				) : (
					<div className={styles.searchIcon}>🔍</div>
				)}
			</div>

			{/* Dropdown */}
			{isOpen && (query.length > 0 || results.length > 0) && (
				<div
					ref={dropdownRef}
					className={styles.dropdown}
					role="listbox"
					aria-label="Stock search results"
				>
					{error ? (
						<div className={styles.errorMessage}>{error}</div>
					) : (
						<>
							{/* Search stats */}
							{(results.length > 0 || isSearching) && (
								<div className={styles.searchStats}>
									{isSearching ? (
										<div className={styles.searchingIndicator}>
											<div className={styles.searchingSpinner} />
											<span>Searching...</span>
										</div>
									) : (
										<span>{results.length} results</span>
									)}
								</div>
							)}

							{/* Results */}
							<div className={styles.dropdownContent}>
								{results.length === 0 && !isSearching && query.length > 0 ? (
									<div className={styles.noResults}>
										<div className={styles.noResultsIcon}>📈</div>
										<div>No stocks found for "{query}"</div>
										<div
											style={{
												fontSize: "0.8rem",
												marginTop: "0.5rem",
												opacity: 0.8,
											}}
										>
											Try searching by symbol (AAPL) or company name (Apple)
										</div>
									</div>
								) : (
									results.map((result, index) => (
										<div
											key={result.symbol}
											className={`${styles.resultItem} ${
												index === highlightedIndex ? styles.highlighted : ""
											}`}
											onClick={() => handleSelectSymbol(result.symbol)}
											role="option"
											aria-selected={index === highlightedIndex}
										>
											<div className={styles.resultContent}>
												<div className={styles.resultSymbol}>
													{renderHighlightedText(
														result.symbol,
														result.highlightedSymbol
													)}
												</div>
												<div className={styles.resultName}>
													{renderHighlightedText(
														result.name,
														result.highlightedName
													)}
												</div>
											</div>
											<div className={styles.resultMeta}>
												<div className={styles.resultExchange}>
													{result.exchange}
												</div>
												<div
													className={`${styles.resultType} ${styles[`type${result.type}`]}`}
												>
													{result.type}
												</div>
											</div>
										</div>
									))
								)}
							</div>
						</>
					)}
				</div>
			)}
		</div>
	);
}
