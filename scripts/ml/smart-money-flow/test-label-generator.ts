/**
 * Quick test for Smart Money Flow label generator
 */

import { generateLabel, validateLabelDistribution, calculateLabelStatistics } from "./label-generator";

async function quickTest() {
	console.log('🧪 Quick Test: Smart Money Flow Label Generator\n');

	// Test 1: Single label (AAPL)
	console.log('Test 1: AAPL on 2024-01-15');
	console.log('-'.repeat(60));
	const label1 = await generateLabel('AAPL', '2024-01-15');
	if (label1) {
		console.log(`✅ Label: ${label1.label} (${label1.label === 1 ? 'BULLISH' : 'BEARISH'})`);
		console.log(`   Return: ${(label1.return14d * 100).toFixed(2)}%`);
	}

	console.log();

	// Test 2: Known bullish case (NVDA in early 2024 AI boom)
	console.log('Test 2: NVDA on 2024-01-15 (AI boom period)');
	console.log('-'.repeat(60));
	const label2 = await generateLabel('NVDA', '2024-01-15');
	if (label2) {
		console.log(`✅ Label: ${label2.label} (${label2.label === 1 ? 'BULLISH' : 'BEARISH'})`);
		console.log(`   Return: ${(label2.return14d * 100).toFixed(2)}%`);
	}

	console.log();

	// Test 3: Collect a few samples and validate distribution
	console.log('Test 3: Validation with small sample set');
	console.log('-'.repeat(60));
	const testLabels = [label1, label2].filter(l => l !== null);

	if (testLabels.length > 0) {
		const validation = validateLabelDistribution(testLabels as any);
		console.log(`Total: ${validation.total}`);
		console.log(`Bullish: ${validation.bullishCount} (${validation.bullishPercent.toFixed(1)}%)`);
		console.log(`Bearish: ${validation.bearishCount} (${validation.bearishPercent.toFixed(1)}%)`);
		console.log(validation.message);

		const stats = calculateLabelStatistics(testLabels as any);
		console.log(`\nBullish avg return: ${(stats.bullish.avgReturn * 100).toFixed(2)}%`);
		console.log(`Bearish avg return: ${(stats.bearish.avgReturn * 100).toFixed(2)}%`);
	}

	console.log('\n✅ Tests completed successfully!');

	// Force exit to avoid Redis hanging
	process.exit(0);
}

quickTest().catch(error => {
	console.error('❌ Test failed:', error);
	process.exit(1);
});
