/**
 * Sector-Specific Valuation Benchmarks
 *
 * Provides industry-specific valuation norms for P/E, P/B, PEG, P/S, and EV/EBITDA ratios
 * to enable sector-relative scoring instead of generic normalization.
 *
 * Benchmarks based on historical sector medians and quartiles (2020-2025 data)
 */

export interface SectorValuationBenchmarks {
	sector: string;
	peRatio: { p25: number; median: number; p75: number; max: number };
	pbRatio: { p25: number; median: number; p75: number; max: number };
	pegRatio: { p25: number; median: number; p75: number };
	psRatio: { p25: number; median: number; p75: number; max: number };
	evEbitda: { p25: number; median: number; p75: number; max: number };
}

/**
 * Sector-specific valuation benchmarks for 11 GICS sectors
 *
 * Scoring philosophy:
 * - p25 (25th percentile) = Undervalued relative to sector (score ~1.0)
 * - median (50th percentile) = Fairly valued for sector (score ~0.75)
 * - p75 (75th percentile) = Moderately expensive but reasonable (score ~0.50)
 * - max = Upper bound of acceptable valuation (score ~0.25)
 * - Above max = Overvalued even for sector (score <0.25)
 */
export const SECTOR_BENCHMARKS: Record<string, SectorValuationBenchmarks> = {
	Technology: {
		sector: "Technology",
		peRatio: { p25: 20, median: 28, p75: 40, max: 60 },
		pbRatio: { p25: 3, median: 6, p75: 12, max: 25 },
		pegRatio: { p25: 1.2, median: 1.8, p75: 2.5 },
		psRatio: { p25: 3, median: 6, p75: 12, max: 20 },
		evEbitda: { p25: 15, median: 22, p75: 35, max: 50 },
	},
	Healthcare: {
		sector: "Healthcare",
		peRatio: { p25: 18, median: 24, p75: 35, max: 50 },
		pbRatio: { p25: 2, median: 4, p75: 8, max: 15 },
		pegRatio: { p25: 1.3, median: 2.0, p75: 3.0 },
		psRatio: { p25: 2, median: 4, p75: 8, max: 15 },
		evEbitda: { p25: 12, median: 18, p75: 28, max: 40 },
	},
	"Financial Services": {
		sector: "Financial Services",
		peRatio: { p25: 8, median: 12, p75: 18, max: 25 },
		pbRatio: { p25: 0.8, median: 1.2, p75: 2.0, max: 3.5 },
		pegRatio: { p25: 0.8, median: 1.2, p75: 1.8 },
		psRatio: { p25: 1.5, median: 3, p75: 5, max: 8 },
		evEbitda: { p25: 8, median: 12, p75: 16, max: 22 },
	},
	"Consumer Cyclical": {
		sector: "Consumer Cyclical",
		peRatio: { p25: 12, median: 18, p75: 28, max: 40 },
		pbRatio: { p25: 1.5, median: 3, p75: 6, max: 12 },
		pegRatio: { p25: 1.0, median: 1.5, p75: 2.2 },
		psRatio: { p25: 0.8, median: 1.5, p75: 3, max: 6 },
		evEbitda: { p25: 8, median: 14, p75: 22, max: 32 },
	},
	"Consumer Defensive": {
		sector: "Consumer Defensive",
		peRatio: { p25: 15, median: 20, p75: 28, max: 38 },
		pbRatio: { p25: 2, median: 4, p75: 7, max: 12 },
		pegRatio: { p25: 1.5, median: 2.2, p75: 3.0 },
		psRatio: { p25: 0.8, median: 1.8, p75: 3.5, max: 6 },
		evEbitda: { p25: 10, median: 15, p75: 22, max: 30 },
	},
	Utilities: {
		sector: "Utilities",
		peRatio: { p25: 10, median: 15, p75: 20, max: 28 },
		pbRatio: { p25: 0.9, median: 1.3, p75: 2.0, max: 3.0 },
		pegRatio: { p25: 2.0, median: 3.0, p75: 4.5 },
		psRatio: { p25: 1.0, median: 1.8, p75: 2.8, max: 4.5 },
		evEbitda: { p25: 8, median: 11, p75: 15, max: 20 },
	},
	Energy: {
		sector: "Energy",
		peRatio: { p25: 8, median: 12, p75: 18, max: 28 },
		pbRatio: { p25: 0.7, median: 1.0, p75: 1.8, max: 3.0 },
		pegRatio: { p25: 0.8, median: 1.3, p75: 2.0 },
		psRatio: { p25: 0.5, median: 1.0, p75: 2.0, max: 4 },
		evEbitda: { p25: 5, median: 8, p75: 12, max: 18 },
	},
	Industrials: {
		sector: "Industrials",
		peRatio: { p25: 14, median: 20, p75: 28, max: 40 },
		pbRatio: { p25: 1.5, median: 2.5, p75: 4.5, max: 8 },
		pegRatio: { p25: 1.2, median: 1.8, p75: 2.5 },
		psRatio: { p25: 0.8, median: 1.5, p75: 2.8, max: 5 },
		evEbitda: { p25: 10, median: 14, p75: 20, max: 28 },
	},
	"Basic Materials": {
		sector: "Basic Materials",
		peRatio: { p25: 10, median: 15, p75: 22, max: 32 },
		pbRatio: { p25: 1.0, median: 1.5, p75: 2.5, max: 4.5 },
		pegRatio: { p25: 1.0, median: 1.5, p75: 2.3 },
		psRatio: { p25: 0.8, median: 1.5, p75: 2.5, max: 4.5 },
		evEbitda: { p25: 6, median: 10, p75: 15, max: 22 },
	},
	"Real Estate": {
		sector: "Real Estate",
		peRatio: { p25: 15, median: 22, p75: 32, max: 45 },
		pbRatio: { p25: 0.8, median: 1.2, p75: 2.0, max: 3.5 },
		pegRatio: { p25: 1.5, median: 2.5, p75: 4.0 },
		psRatio: { p25: 2, median: 4, p75: 7, max: 12 },
		evEbitda: { p25: 12, median: 18, p75: 25, max: 35 },
	},
	"Communication Services": {
		sector: "Communication Services",
		peRatio: { p25: 12, median: 18, p75: 28, max: 42 },
		pbRatio: { p25: 1.5, median: 3, p75: 6, max: 12 },
		pegRatio: { p25: 1.0, median: 1.6, p75: 2.4 },
		psRatio: { p25: 1.5, median: 3, p75: 6, max: 10 },
		evEbitda: { p25: 8, median: 14, p75: 22, max: 32 },
	},
};

/**
 * Fallback benchmarks for unmapped or unknown sectors
 * Uses market-wide median values across all sectors
 */
export const DEFAULT_BENCHMARKS: SectorValuationBenchmarks = {
	sector: "Default",
	peRatio: { p25: 12, median: 18, p75: 25, max: 35 },
	pbRatio: { p25: 1.2, median: 2.5, p75: 5, max: 10 },
	pegRatio: { p25: 1.0, median: 1.5, p75: 2.5 },
	psRatio: { p25: 1.5, median: 3, p75: 6, max: 10 },
	evEbitda: { p25: 10, median: 15, p75: 22, max: 32 },
};

/**
 * Get sector benchmarks with fallback to default
 * Handles sector name variations and case sensitivity
 */
export function getSectorBenchmarks(sector?: string): SectorValuationBenchmarks {
	if (!sector) return DEFAULT_BENCHMARKS;

	// Normalize sector name (handle variations)
	const normalizedSector = normalizeSectorName(sector);

	return SECTOR_BENCHMARKS[normalizedSector] || DEFAULT_BENCHMARKS;
}

/**
 * Normalize sector names to match benchmark keys
 * Handles common variations and aliases
 */
function normalizeSectorName(sector: string): string {
	const normalized = sector.trim();

	// Direct match
	if (SECTOR_BENCHMARKS[normalized]) {
		return normalized;
	}

	// Case-insensitive match
	const lowerSector = normalized.toLowerCase();
	for (const key of Object.keys(SECTOR_BENCHMARKS)) {
		if (key.toLowerCase() === lowerSector) {
			return key;
		}
	}

	// Handle common aliases
	const aliases: Record<string, string> = {
		tech: "Technology",
		"information technology": "Technology",
		it: "Technology",
		"health care": "Healthcare",
		medical: "Healthcare",
		pharma: "Healthcare",
		financials: "Financial Services",
		finance: "Financial Services",
		banking: "Financial Services",
		"consumer discretionary": "Consumer Cyclical",
		"consumer staples": "Consumer Defensive",
		materials: "Basic Materials",
		telecom: "Communication Services",
		telecommunications: "Communication Services",
		media: "Communication Services",
	};

	return aliases[lowerSector] || normalized;
}

/**
 * Calculate percentile-based score for a valuation metric
 *
 * @param value - Actual metric value (e.g., P/E ratio of 35)
 * @param benchmarks - Sector-specific benchmark quartiles
 * @returns Score from 0 to 1 (higher = more attractive valuation)
 */
export function calculatePercentileScore(
	value: number,
	benchmarks: { p25: number; median: number; p75: number; max: number }
): number {
	if (value <= 0) return 0;

	// Score 1.0 = at or below p25 (undervalued)
	if (value <= benchmarks.p25) {
		return 1.0;
	}

	// Linear interpolation between p25 and median (1.0 → 0.75)
	if (value <= benchmarks.median) {
		const range = benchmarks.median - benchmarks.p25;
		const position = (value - benchmarks.p25) / range;
		return 1.0 - position * 0.25;
	}

	// Linear interpolation between median and p75 (0.75 → 0.50)
	if (value <= benchmarks.p75) {
		const range = benchmarks.p75 - benchmarks.median;
		const position = (value - benchmarks.median) / range;
		return 0.75 - position * 0.25;
	}

	// Linear interpolation between p75 and max (0.50 → 0.25)
	if (value <= benchmarks.max) {
		const range = benchmarks.max - benchmarks.p75;
		const position = (value - benchmarks.p75) / range;
		return 0.5 - position * 0.25;
	}

	// Beyond sector max - diminishing penalty
	const excessRatio = (value - benchmarks.max) / benchmarks.max;
	const penalty = Math.min(0.25, excessRatio * 0.15);
	return Math.max(0, 0.25 - penalty);
}
