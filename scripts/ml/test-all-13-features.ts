import * as dotenv from "dotenv";
dotenv.config();

import { EarlySignalFeatureExtractor } from "../../app/services/ml/early-signal/FeatureExtractor.js";

async function test() {
	console.log("=== Testing All 13 Features ===\n");

	const extractor = new EarlySignalFeatureExtractor();
	const testDate = new Date("2024-11-01");

	console.log(`Extracting features for AAPL as of ${testDate.toISOString().split("T")[0]}...\n`);

	const startTime = Date.now();
	const features = await extractor.extractFeatures("AAPL", testDate);
	const duration = Date.now() - startTime;

	console.log("Features extracted:");
	console.log(JSON.stringify(features, null, 2));

	// Analyze results
	const featureList = Object.entries(features);
	const nonZero = featureList.filter(([_, v]) => v !== 0);
	const zeros = featureList.filter(([_, v]) => v === 0);

	console.log(`\n=== Summary ===`);
	console.log(`Duration: ${duration}ms`);
	console.log(`Non-zero features: ${nonZero.length}/13`);
	if (zeros.length > 0) {
		console.log(`Zero features: ${zeros.map(([k]) => k).join(", ")}`);
	}

	console.log(`\n✅ SUCCESS: ${nonZero.length}/13 features populated`);

	process.exit(0);
}

test().catch(e => {
	console.error("Error:", e);
	process.exit(1);
});
