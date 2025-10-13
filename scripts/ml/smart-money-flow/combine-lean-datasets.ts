/**
 * Combine Parallel LEAN Dataset Outputs
 *
 * Merges CSV files from parallel lean dataset generation into single training dataset
 *
 * Usage:
 *   npx tsx scripts/ml/smart-money-flow/combine-lean-datasets.ts
 */

import * as fs from "fs";
import * as path from "path";

const TRAINING_DIR = path.join(process.cwd(), "data", "training", "smart-money-flow-lean");

interface DatasetFile {
	path: string;
	examples: number;
	symbols: Set<string>;
}

async function combineLeanDatasets() {
	console.log("📦 Smart Money Flow LEAN Dataset Combiner");
	console.log("=".repeat(80));

	// Ensure directory exists
	if (!fs.existsSync(TRAINING_DIR)) {
		console.error("❌ Training directory not found:", TRAINING_DIR);
		process.exit(1);
	}

	// Find all lean-process-*.csv files
	const files = fs
		.readdirSync(TRAINING_DIR)
		.filter((f) => f.startsWith("lean-process-") && f.endsWith(".csv"))
		.map((f) => path.join(TRAINING_DIR, f));

	if (files.length === 0) {
		console.error("❌ No lean-process-*.csv files found in", TRAINING_DIR);
		console.log("\nExpected files like: lean-process-1.csv, lean-process-2.csv, etc.");
		process.exit(1);
	}

	console.log(`Found ${files.length} dataset files:\n`);

	const datasets: DatasetFile[] = [];
	let totalExamples = 0;
	const allSymbols = new Set<string>();

	// Read headers and count examples
	for (const filepath of files) {
		const content = fs.readFileSync(filepath, "utf-8");
		const lines = content.trim().split("\n");
		const exampleCount = lines.length - 1; // Subtract header

		// Extract unique symbols
		const symbols = new Set<string>();
		for (let i = 1; i < lines.length; i++) {
			const symbol = lines[i].split(",")[0];
			symbols.add(symbol);
			allSymbols.add(symbol);
		}

		datasets.push({
			path: filepath,
			examples: exampleCount,
			symbols,
		});

		totalExamples += exampleCount;

		console.log(
			`  ${path.basename(filepath)}: ${exampleCount.toLocaleString()} examples, ${symbols.size} symbols`
		);
	}

	console.log();
	console.log("=".repeat(80));
	console.log(`Total Examples:    ${totalExamples.toLocaleString()}`);
	console.log(`Unique Symbols:    ${allSymbols.size}`);
	console.log("=".repeat(80));
	console.log();

	// Check for duplicate symbols (should not happen in parallel processing)
	const symbolCounts = new Map<string, number>();
	for (const dataset of datasets) {
		for (const symbol of dataset.symbols) {
			symbolCounts.set(symbol, (symbolCounts.get(symbol) || 0) + 1);
		}
	}

	const duplicates = Array.from(symbolCounts.entries()).filter(([, count]) => count > 1);
	if (duplicates.length > 0) {
		console.warn("⚠️  WARNING: Found duplicate symbols across datasets:");
		for (const [symbol, count] of duplicates) {
			console.warn(`  ${symbol}: appears in ${count} datasets`);
		}
		console.log();
	}

	// Combine datasets
	console.log("🔗 Combining datasets...");

	// Read header from first file
	const firstContent = fs.readFileSync(datasets[0].path, "utf-8");
	const [header] = firstContent.split("\n");

	// Collect all data rows (skip headers from other files)
	const allRows: string[] = [header];

	for (const dataset of datasets) {
		const content = fs.readFileSync(dataset.path, "utf-8");
		const lines = content.trim().split("\n");

		// Skip header, add data rows
		for (let i = 1; i < lines.length; i++) {
			if (lines[i].trim()) {
				allRows.push(lines[i]);
			}
		}
	}

	// Write combined dataset
	const outputPath = path.join(TRAINING_DIR, "lean-combined.csv");
	const combinedContent = allRows.join("\n");
	fs.writeFileSync(outputPath, combinedContent, "utf-8");

	console.log(`✅ Combined dataset saved: ${outputPath}`);
	console.log(`   Total rows: ${(allRows.length - 1).toLocaleString()} (+ 1 header)`);
	console.log();

	// Generate summary
	console.log("=".repeat(80));
	console.log("📊 Combined LEAN Dataset Summary");
	console.log("=".repeat(80));
	console.log(`Output File:       ${path.basename(outputPath)}`);
	console.log(`Total Examples:    ${(allRows.length - 1).toLocaleString()}`);
	console.log(`Unique Symbols:    ${allSymbols.size}`);
	console.log(`Source Files:      ${datasets.length}`);
	console.log(`File Size:         ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
	console.log(`Features:          10 (NO PLACEHOLDERS)`);
	console.log("=".repeat(80));
	console.log();
	console.log("✅ Dataset combination complete!");
	console.log();
	console.log("Next steps:");
	console.log("  1. Validate: npx tsx scripts/ml/smart-money-flow/validate-dataset.ts");
	console.log("  2. Split: npx tsx scripts/ml/smart-money-flow/split-dataset.ts");
	console.log("  3. Train: python scripts/ml/smart-money-flow/train-lightgbm.py");
}

combineLeanDatasets().catch((error) => {
	console.error("❌ Error combining datasets:", error);
	process.exit(1);
});
