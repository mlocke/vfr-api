/**
 * Debug script to trace exactly what happens to one row
 */
import * as fs from 'fs';

const INPUT_CSV = '/Users/michaellocke/WebstormProjects/Home/public/vfr-api/data/training/early-signal-combined-1051-v2.csv';

const csvContent = fs.readFileSync(INPUT_CSV, 'utf-8');
const lines = csvContent.trim().split('\n');
const header = lines[0];

// Find the AAPL 2022-04-28 row
const targetRow = lines.find(line => line.startsWith('AAPL,2022-04-28'));
if (!targetRow) {
	console.error('Target row not found');
	process.exit(1);
}

console.log('Original row:');
console.log(targetRow);
console.log('');

// Parse it the same way the script does
const values = targetRow.split(',');
console.log(`Total values after split: ${values.length}`);
console.log('');

const symbol = values[0];
const date = values[1];
const featureValues = values.slice(2, -1); // All features (exclude symbol, date, label)
const label = values[values.length - 1];

console.log(`Symbol: ${symbol}`);
console.log(`Date: ${date}`);
console.log(`Feature values length: ${featureValues.length}`);
console.log(`Label: ${label}`);
console.log('');

console.log('Feature values at indices 18-26:');
for (let i = 18; i < 27 && i < featureValues.length; i++) {
	console.log(`  featureValues[${i}] = ${featureValues[i]}`);
}
console.log('');

// Now update indices 20-24
const updatedValues = [...featureValues];
updatedValues[20] = 'FED_RATE';
updatedValues[21] = 'UNEMPLOYMENT';
updatedValues[22] = 'CPI';
updatedValues[23] = 'GDP';
updatedValues[24] = 'TREASURY';

console.log('After update:');
for (let i = 18; i < 27 && i < updatedValues.length; i++) {
	console.log(`  updatedValues[${i}] = ${updatedValues[i]}`);
}
console.log('');

// Reconstruct row
const reconstructed = `${symbol},${date},${updatedValues.join(',')},${label}`;

console.log('Reconstructed row:');
console.log(reconstructed);
console.log('');

// Check positions in reconstructed row
const reconstructedValues = reconstructed.split(',');
console.log(`Reconstructed total values: ${reconstructedValues.length}`);
console.log('');

console.log('Values at CSV positions 20-28:');
for (let i = 20; i < 29 && i < reconstructedValues.length; i++) {
	console.log(`  CSV position ${i} = ${reconstructedValues[i]}`);
}
