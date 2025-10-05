/**
 * Quick ESD Test - Minimal test of Early Signal Detection
 */

import { EarlySignalService } from "../../app/services/ml/early-signal/EarlySignalService.js";

async function quickTest() {
	console.log("🔬 Quick ESD Test\n");

	const testSymbol = "NVDA";
	const esdService = new EarlySignalService();

	console.log(`Testing ${testSymbol}...`);
	const startTime = Date.now();

	try {
		const prediction = await esdService.predictAnalystChange(testSymbol, "Technology");
		const latency = Date.now() - startTime;

		if (prediction) {
			console.log(`\n✅ SUCCESS (${latency}ms):\n`);
			console.log(`   Upgrade Likely: ${prediction.upgrade_likely}`);
			console.log(`   Downgrade Likely: ${prediction.downgrade_likely}`);
			console.log(`   Confidence: ${(prediction.confidence * 100).toFixed(1)}%`);
			console.log(`   Horizon: ${prediction.horizon}`);
			console.log(`   Model Version: ${prediction.model_version}`);
			console.log(`   Reasoning:`);
			prediction.reasoning.forEach((r, i) => console.log(`     ${i + 1}. ${r}`));
		} else {
			console.log(`\n⚠️ NULL PREDICTION (${latency}ms) - likely low confidence`);
		}

		process.exit(0);
	} catch (error) {
		console.error(`\n❌ FAILED (${Date.now() - startTime}ms):`, error);
		process.exit(1);
	}
}

quickTest();
