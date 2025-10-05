/**
 * Fix normalizer.json format
 *
 * Problem: normalizer.json has arrays but code expects object with feature names
 * Solution: Convert arrays to object format using featureNames from metadata.json
 */

import fs from 'fs';
import path from 'path';

const modelDir = path.join(process.cwd(), 'models/early-signal/v1.0.0');
const normalizerPath = path.join(modelDir, 'normalizer.json');
const metadataPath = path.join(modelDir, 'metadata.json');
const outputPath = path.join(modelDir, 'normalizer.json');

console.log('🔧 Fixing normalizer.json format...\n');

// Read current normalizer (array format)
const normalizerData = JSON.parse(fs.readFileSync(normalizerPath, 'utf-8'));
console.log('✓ Read normalizer.json (array format)');
console.log(`  - Mean values: ${normalizerData.mean.length}`);
console.log(`  - Std values: ${normalizerData.std.length}`);

// Read metadata to get feature names
const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
console.log(`\n✓ Read metadata.json`);
console.log(`  - Feature names: ${metadata.featureNames.length}`);

// Validate lengths match
if (normalizerData.mean.length !== metadata.featureNames.length) {
	throw new Error(`Length mismatch: ${normalizerData.mean.length} values vs ${metadata.featureNames.length} features`);
}

if (normalizerData.std.length !== metadata.featureNames.length) {
	throw new Error(`Length mismatch: ${normalizerData.std.length} std values vs ${metadata.featureNames.length} features`);
}

// Convert to expected format
const params: Record<string, { mean: number; stdDev: number }> = {};

for (let i = 0; i < metadata.featureNames.length; i++) {
	const featureName = metadata.featureNames[i];
	params[featureName] = {
		mean: normalizerData.mean[i],
		stdDev: normalizerData.std[i]
	};
}

// Create new normalizer in correct format
const newNormalizer = {
	params
};

// Backup old normalizer
fs.writeFileSync(
	path.join(modelDir, 'normalizer.json.backup'),
	JSON.stringify(normalizerData, null, 2)
);
console.log('\n✓ Backed up old normalizer.json');

// Write new normalizer
fs.writeFileSync(outputPath, JSON.stringify(newNormalizer, null, 2));
console.log('✓ Wrote new normalizer.json (object format)');

// Verify the fix
const verifyData = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
console.log('\n✅ Verification:');
console.log(`  - Has 'params' property: ${!!verifyData.params}`);
console.log(`  - Number of features: ${Object.keys(verifyData.params).length}`);
console.log(`  - Sample feature (price_change_5d):`);
console.log(`    - mean: ${verifyData.params.price_change_5d?.mean}`);
console.log(`    - stdDev: ${verifyData.params.price_change_5d?.stdDev}`);

console.log('\n✅ normalizer.json format fixed successfully!');
console.log('   Old format backed up to normalizer.json.backup\n');
