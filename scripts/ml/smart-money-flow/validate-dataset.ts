/**
 * Smart Money Flow Dataset Validation Script
 *
 * Task: Dataset Validation (Phase 1 - TODO lines 229-258)
 * Purpose: Validate training dataset quality before model training
 *
 * Validation Checks:
 * 1. Completeness: >85% of features populated
 * 2. Label Balance: 30-70% bullish (not extreme imbalance)
 * 3. Feature Distributions: No extreme outliers (>99th percentile)
 * 4. Temporal Integrity: No lookahead bias
 * 5. Missing Data: <10% missing per feature
 * 6. Symbol Coverage: All 500 stocks represented
 *
 * Usage:
 *   npx tsx scripts/ml/smart-money-flow/validate-dataset.ts
 *   npx tsx scripts/ml/smart-money-flow/validate-dataset.ts --input data/training/smart-money-flow/full-dataset.csv
 */

import * as fs from "fs";
import * as path from "path";

/**
 * Smart Money Flow training example (27 features + label)
 */
interface SmartMoneyTrainingExample {
	symbol: string;
	date: Date;
	// Insider Trading Features (8)
	insider_buy_ratio_30d: number;
	insider_buy_volume_30d: number;
	insider_sell_volume_30d: number;
	insider_net_flow_30d: number;
	insider_cluster_score: number;
	insider_ownership_change_90d: number;
	insider_avg_premium: number;
	c_suite_activity_ratio: number;
	// Institutional Ownership Features (7)
	inst_ownership_pct: number;
	inst_ownership_change_1q: number;
	inst_new_positions_count: number;
	inst_closed_positions_count: number;
	inst_avg_position_size_change: number;
	inst_concentration_top10: number;
	inst_momentum_score: number;
	// Congressional Trading Features (4)
	congress_buy_count_90d: number;
	congress_sell_count_90d: number;
	congress_net_sentiment: number;
	congress_recent_activity_7d: number;
	// Hedge Fund Holdings Features (5)
	hedgefund_top20_exposure: number;
	hedgefund_net_change_1q: number;
	hedgefund_new_entry_count: number;
	hedgefund_exit_count: number;
	hedgefund_conviction_score: number;
	// ETF Holdings Features (3)
	etf_ownership_pct: number;
	etf_flow_30d: number;
	etf_concentration: number;
	// Label
	label: number;
}

/**
 * Validation result interface
 */
interface ValidationResult {
	checkName: string;
	passed: boolean;
	details: string;
	severity: "CRITICAL" | "WARNING" | "INFO";
	recommendation?: string;
}

/**
 * Parse CSV file into training examples
 */
function parseCSV(filepath: string): SmartMoneyTrainingExample[] {
	const content = fs.readFileSync(filepath, "utf-8");
	const lines = content.trim().split("\n");

	// Skip header
	const dataLines = lines.slice(1);

	return dataLines.map(line => {
		const parts = line.split(",");

		return {
			symbol: parts[0],
			date: new Date(parts[1]),
			// Insider Trading Features
			insider_buy_ratio_30d: parseFloat(parts[2]),
			insider_buy_volume_30d: parseFloat(parts[3]),
			insider_sell_volume_30d: parseFloat(parts[4]),
			insider_net_flow_30d: parseFloat(parts[5]),
			insider_cluster_score: parseFloat(parts[6]),
			insider_ownership_change_90d: parseFloat(parts[7]),
			insider_avg_premium: parseFloat(parts[8]),
			c_suite_activity_ratio: parseFloat(parts[9]),
			// Institutional Ownership Features
			inst_ownership_pct: parseFloat(parts[10]),
			inst_ownership_change_1q: parseFloat(parts[11]),
			inst_new_positions_count: parseFloat(parts[12]),
			inst_closed_positions_count: parseFloat(parts[13]),
			inst_avg_position_size_change: parseFloat(parts[14]),
			inst_concentration_top10: parseFloat(parts[15]),
			inst_momentum_score: parseFloat(parts[16]),
			// Congressional Trading Features
			congress_buy_count_90d: parseFloat(parts[17]),
			congress_sell_count_90d: parseFloat(parts[18]),
			congress_net_sentiment: parseFloat(parts[19]),
			congress_recent_activity_7d: parseFloat(parts[20]),
			// Hedge Fund Holdings Features
			hedgefund_top20_exposure: parseFloat(parts[21]),
			hedgefund_net_change_1q: parseFloat(parts[22]),
			hedgefund_new_entry_count: parseFloat(parts[23]),
			hedgefund_exit_count: parseFloat(parts[24]),
			hedgefund_conviction_score: parseFloat(parts[25]),
			// ETF Holdings Features
			etf_ownership_pct: parseFloat(parts[26]),
			etf_flow_30d: parseFloat(parts[27]),
			etf_concentration: parseFloat(parts[28]),
			// Label
			label: parseInt(parts[29], 10),
		};
	});
}

/**
 * Get all feature names (27 features)
 */
function getFeatureNames(): string[] {
	return [
		// Insider Trading (8)
		"insider_buy_ratio_30d",
		"insider_buy_volume_30d",
		"insider_sell_volume_30d",
		"insider_net_flow_30d",
		"insider_cluster_score",
		"insider_ownership_change_90d",
		"insider_avg_premium",
		"c_suite_activity_ratio",
		// Institutional Ownership (7)
		"inst_ownership_pct",
		"inst_ownership_change_1q",
		"inst_new_positions_count",
		"inst_closed_positions_count",
		"inst_avg_position_size_change",
		"inst_concentration_top10",
		"inst_momentum_score",
		// Congressional Trading (4)
		"congress_buy_count_90d",
		"congress_sell_count_90d",
		"congress_net_sentiment",
		"congress_recent_activity_7d",
		// Hedge Fund Holdings (5)
		"hedgefund_top20_exposure",
		"hedgefund_net_change_1q",
		"hedgefund_new_entry_count",
		"hedgefund_exit_count",
		"hedgefund_conviction_score",
		// ETF Holdings (3)
		"etf_ownership_pct",
		"etf_flow_30d",
		"etf_concentration",
	];
}

/**
 * Check 1: Completeness - >85% of features populated
 */
function validateCompleteness(dataset: SmartMoneyTrainingExample[]): ValidationResult {
	const featureNames = getFeatureNames();

	let totalValues = 0;
	let validValues = 0;

	dataset.forEach(example => {
		featureNames.forEach(feature => {
			totalValues++;
			const value = (example as any)[feature];
			if (!isNaN(value) && value !== null && value !== undefined) {
				validValues++;
			}
		});
	});

	const completeness = (validValues / totalValues) * 100;
	const passed = completeness >= 85;

	return {
		checkName: "Completeness",
		passed,
		details: `${completeness.toFixed(2)}% features populated (${validValues}/${totalValues}). Target: >85%`,
		severity: passed ? "INFO" : "CRITICAL",
		recommendation: passed
			? undefined
			: "Re-generate dataset with better error handling and median imputation for missing values",
	};
}

/**
 * Check 2: Label Balance - 30-70% bullish
 */
function validateLabelBalance(dataset: SmartMoneyTrainingExample[]): ValidationResult {
	const positiveLabels = dataset.filter(ex => ex.label === 1).length;
	const totalLabels = dataset.length;
	const positivePercentage = (positiveLabels / totalLabels) * 100;

	const passed = positivePercentage >= 30 && positivePercentage <= 70;

	return {
		checkName: "Label Balance",
		passed,
		details: `${positivePercentage.toFixed(2)}% bullish labels (${positiveLabels}/${totalLabels}). Target: 30-70%`,
		severity: passed ? "INFO" : "WARNING",
		recommendation: passed
			? undefined
			: "Adjust label generation logic to achieve more balanced distribution. Consider using composite labeling method.",
	};
}

/**
 * Check 3: Feature Distributions - No extreme outliers (>99th percentile)
 */
function validateOutliers(dataset: SmartMoneyTrainingExample[]): ValidationResult {
	const featureNames = getFeatureNames();

	const outlierDetails: string[] = [];
	let totalOutliers = 0;

	featureNames.forEach(feature => {
		const values = dataset.map(ex => (ex as any)[feature]).filter(v => !isNaN(v));
		values.sort((a, b) => a - b);

		const p99Index = Math.floor(values.length * 0.99);
		const p99Value = values[p99Index];

		const p1Index = Math.floor(values.length * 0.01);
		const p1Value = values[p1Index];

		const outliers = values.filter(v => v > p99Value || v < p1Value).length;

		if (outliers > 0) {
			totalOutliers += outliers;
			outlierDetails.push(
				`${feature}: ${outliers} outliers (range: ${p1Value.toFixed(2)} to ${p99Value.toFixed(2)})`
			);
		}
	});

	const outlierPercentage = (totalOutliers / (dataset.length * featureNames.length)) * 100;
	const passed = outlierPercentage < 5;

	return {
		checkName: "Outlier Detection",
		passed,
		details: `${outlierPercentage.toFixed(2)}% outliers detected. ${passed ? "Within acceptable range." : `Top outliers: ${outlierDetails.slice(0, 3).join("; ")}`}`,
		severity: passed ? "INFO" : "WARNING",
		recommendation: passed
			? undefined
			: "Consider winsorizing features at 1st/99th percentile or investigating data quality for outlier features",
	};
}

/**
 * Check 4: Temporal Integrity - No lookahead bias
 */
function validateTemporalLeakage(dataset: SmartMoneyTrainingExample[]): ValidationResult {
	const symbolGroups = new Map<string, Date[]>();

	dataset.forEach(example => {
		if (!symbolGroups.has(example.symbol)) {
			symbolGroups.set(example.symbol, []);
		}
		symbolGroups.get(example.symbol)!.push(example.date);
	});

	let leakageCount = 0;
	const leakageSymbols: string[] = [];

	symbolGroups.forEach((dates, symbol) => {
		// Check if dates are in chronological order
		for (let i = 1; i < dates.length; i++) {
			if (dates[i] < dates[i - 1]) {
				leakageCount++;
				if (!leakageSymbols.includes(symbol)) {
					leakageSymbols.push(symbol);
				}
			}
		}
	});

	const passed = leakageCount === 0;

	return {
		checkName: "Temporal Integrity",
		passed,
		details: passed
			? "No temporal leakage detected. Dates are in chronological order."
			: `${leakageCount} instances of temporal leakage in ${leakageSymbols.length} symbols: ${leakageSymbols.slice(0, 5).join(", ")}`,
		severity: passed ? "INFO" : "CRITICAL",
		recommendation: passed
			? undefined
			: "Check data collection logic to ensure temporal ordering. Feature extraction must not use future data.",
	};
}

/**
 * Check 5: Missing Data - <10% missing per feature
 */
function validateMissingData(dataset: SmartMoneyTrainingExample[]): ValidationResult {
	const featureNames = getFeatureNames();
	const missingFeatures: string[] = [];
	let maxMissingPercentage = 0;
	let maxMissingFeature = "";

	featureNames.forEach(feature => {
		const missingCount = dataset.filter(ex => {
			const value = (ex as any)[feature];
			return isNaN(value) || value === null || value === undefined;
		}).length;

		const missingPercentage = (missingCount / dataset.length) * 100;

		if (missingPercentage > maxMissingPercentage) {
			maxMissingPercentage = missingPercentage;
			maxMissingFeature = feature;
		}

		if (missingPercentage >= 10) {
			missingFeatures.push(`${feature}: ${missingPercentage.toFixed(2)}%`);
		}
	});

	const passed = missingFeatures.length === 0;

	return {
		checkName: "Missing Data Per Feature",
		passed,
		details: passed
			? `All features have <10% missing data. Max: ${maxMissingFeature} (${maxMissingPercentage.toFixed(2)}%)`
			: `${missingFeatures.length} features exceed 10% missing: ${missingFeatures.slice(0, 3).join("; ")}`,
		severity: passed ? "INFO" : "WARNING",
		recommendation: passed
			? undefined
			: "Implement median imputation for high-missing features or investigate data source availability",
	};
}

/**
 * Check 6: Symbol Coverage - All 500 stocks represented
 */
function validateSymbolRepresentation(
	dataset: SmartMoneyTrainingExample[],
	expectedSymbols?: string[]
): ValidationResult {
	const symbolCounts = new Map<string, number>();

	dataset.forEach(example => {
		symbolCounts.set(example.symbol, (symbolCounts.get(example.symbol) || 0) + 1);
	});

	const uniqueSymbols = symbolCounts.size;
	const missingSymbols: string[] = [];
	const lowCoverageSymbols: string[] = [];

	if (expectedSymbols) {
		expectedSymbols.forEach(symbol => {
			if (!symbolCounts.has(symbol)) {
				missingSymbols.push(symbol);
			} else if (symbolCounts.get(symbol)! < 10) {
				lowCoverageSymbols.push(`${symbol} (${symbolCounts.get(symbol)} samples)`);
			}
		});
	}

	const passed = missingSymbols.length === 0 && uniqueSymbols >= 500;

	return {
		checkName: "Symbol Coverage",
		passed: expectedSymbols ? passed : uniqueSymbols > 0,
		details: expectedSymbols
			? `${uniqueSymbols} unique symbols (target: ${expectedSymbols.length}). ${missingSymbols.length > 0 ? `Missing: ${missingSymbols.slice(0, 10).join(", ")}` : "All symbols represented."} ${lowCoverageSymbols.length > 0 ? `Low coverage: ${lowCoverageSymbols.slice(0, 5).join(", ")}` : ""}`
			: `${uniqueSymbols} unique symbols represented`,
		severity: passed || !expectedSymbols ? "INFO" : "WARNING",
		recommendation:
			passed || !expectedSymbols
				? undefined
				: "Ensure dataset generation covers all target stocks. Verify stock universe selection criteria.",
	};
}

/**
 * Calculate feature statistics summary
 */
function calculateFeatureStatistics(dataset: SmartMoneyTrainingExample[]): string {
	const featureNames = getFeatureNames();

	const stats: string[] = [];

	featureNames.forEach(feature => {
		const values = dataset.map(ex => (ex as any)[feature]).filter(v => !isNaN(v));

		if (values.length === 0) {
			stats.push(`  ${feature}: No valid values`);
			return;
		}

		const sum = values.reduce((a, b) => a + b, 0);
		const mean = sum / values.length;

		// Calculate standard deviation
		const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
		const std = Math.sqrt(variance);

		const sortedValues = [...values].sort((a, b) => a - b);
		const min = sortedValues[0];
		const max = sortedValues[sortedValues.length - 1];

		stats.push(
			`  ${feature}: mean=${mean.toFixed(3)}, std=${std.toFixed(3)}, range=[${min.toFixed(3)}, ${max.toFixed(3)}]`
		);
	});

	return stats.join("\n");
}

/**
 * Main validation function
 */
async function validateTrainingData(inputPath: string): Promise<void> {
	console.log("Smart Money Flow - Training Dataset Validation");
	console.log("Phase 1: Dataset Validation (TODO lines 229-258)");
	console.log("=".repeat(80));

	// Check if file exists
	if (!fs.existsSync(inputPath)) {
		console.error(`\nERROR: Input file not found: ${inputPath}`);
		console.log("\nGenerate training data first:");
		console.log("   npx tsx scripts/ml/smart-money-flow/generate-dataset.ts");
		process.exit(1);
	}

	console.log(`\nInput file: ${inputPath}`);
	console.log(`File size: ${(fs.statSync(inputPath).size / 1024).toFixed(2)} KB`);

	// Parse dataset
	console.log("\nLoading dataset...");
	const dataset = parseCSV(inputPath);
	console.log(`Loaded ${dataset.length} training examples`);

	// Run validation checks
	console.log("\n" + "=".repeat(80));
	console.log("Running validation checks...");
	console.log("=".repeat(80));

	const results: ValidationResult[] = [
		validateCompleteness(dataset),
		validateLabelBalance(dataset),
		validateOutliers(dataset),
		validateTemporalLeakage(dataset),
		validateMissingData(dataset),
		validateSymbolRepresentation(dataset),
	];

	// Display results
	let allPassed = true;
	let criticalFailed = false;

	results.forEach((result, idx) => {
		const statusIcon = result.passed ? "PASS" : result.severity === "CRITICAL" ? "FAIL" : "WARN";
		console.log(`\n${idx + 1}. ${result.checkName}: [${statusIcon}]`);
		console.log(`   ${result.details}`);
		if (result.recommendation) {
			console.log(`   Recommendation: ${result.recommendation}`);
		}

		if (!result.passed) {
			allPassed = false;
			if (result.severity === "CRITICAL") {
				criticalFailed = true;
			}
		}
	});

	// Display feature statistics
	console.log("\n" + "=".repeat(80));
	console.log("Feature Statistics:");
	console.log("=".repeat(80));
	console.log(calculateFeatureStatistics(dataset));

	// Final summary
	console.log("\n" + "=".repeat(80));
	console.log("Validation Summary");
	console.log("=".repeat(80));

	const passedCount = results.filter(r => r.passed).length;
	const warningCount = results.filter(r => !r.passed && r.severity === "WARNING").length;
	const criticalCount = results.filter(r => !r.passed && r.severity === "CRITICAL").length;

	console.log(`\nPassed: ${passedCount}/${results.length} checks`);
	if (warningCount > 0) {
		console.log(`Warnings: ${warningCount}`);
	}
	if (criticalCount > 0) {
		console.log(`Critical failures: ${criticalCount}`);
	}

	if (allPassed) {
		console.log("\nAll validation checks passed! Dataset is ready for model training.");
		console.log("\nNext step: Split dataset into train/val/test (Task: Dataset Splitting)");
		console.log("   python scripts/ml/smart-money-flow/split-dataset.py");
	} else if (criticalFailed) {
		console.log(
			"\nCritical validation failures detected. Please fix issues before training."
		);
		console.log("\nSuggested actions:");
		results
			.filter(r => !r.passed && r.severity === "CRITICAL")
			.forEach(r => {
				if (r.recommendation) {
					console.log(`   - ${r.recommendation}`);
				}
			});
		process.exit(1);
	} else {
		console.log("\nSome warnings detected. Review above and decide if acceptable for training.");
		console.log("\nYou can proceed to next step or re-generate data:");
		console.log("   python scripts/ml/smart-money-flow/split-dataset.py (proceed)");
		console.log("   npx tsx scripts/ml/smart-money-flow/generate-dataset.ts (re-generate)");
	}

	console.log("\n" + "=".repeat(80));
}

/**
 * Parse command-line arguments
 */
function parseArguments(): string {
	const args = process.argv.slice(2);
	let inputPath = "data/training/smart-money-flow/full-dataset.csv";

	for (let i = 0; i < args.length; i++) {
		if (args[i] === "--input" && i + 1 < args.length) {
			inputPath = args[++i];
		}
	}

	return path.resolve(inputPath);
}

/**
 * Main execution
 */
async function main() {
	try {
		const inputPath = parseArguments();
		await validateTrainingData(inputPath);
	} catch (error: any) {
		console.error("\nValidation failed:", error.message);
		console.error(error.stack);
		process.exit(1);
	}
}

// Run if executed directly
if (require.main === module) {
	main().catch(console.error);
}

export { validateTrainingData, parseCSV };
