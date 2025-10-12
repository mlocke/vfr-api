#!/usr/bin/env npx tsx

/**
 * Splits the combined smart money flow dataset into train/validation/test sets
 */

import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';

const DATA_DIR = path.join(process.cwd(), 'data/training/smart-money-flow');
const INPUT_FILE = path.join(DATA_DIR, 'combined_dataset.csv');
const TRAIN_FILE = path.join(DATA_DIR, 'train.csv');
const VAL_FILE = path.join(DATA_DIR, 'val.csv');
const TEST_FILE = path.join(DATA_DIR, 'test.csv');

// Split ratios (default: 70% train, 15% val, 15% test)
const TRAIN_RATIO = parseFloat(process.env.TRAIN_RATIO || '0.70');
const VAL_RATIO = parseFloat(process.env.VAL_RATIO || '0.15');
const TEST_RATIO = parseFloat(process.env.TEST_RATIO || '0.15');

interface SplitStats {
  totalRows: number;
  trainRows: number;
  valRows: number;
  testRows: number;
  startTime: number;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

async function splitDataset(): Promise<void> {
  console.log('🔄 Starting dataset split process...\n');
  console.log(`📁 Input file: ${INPUT_FILE}`);
  console.log(`📊 Split ratios: Train ${(TRAIN_RATIO * 100).toFixed(0)}%, Val ${(VAL_RATIO * 100).toFixed(0)}%, Test ${(TEST_RATIO * 100).toFixed(0)}%\n`);

  // Validate split ratios
  const totalRatio = TRAIN_RATIO + VAL_RATIO + TEST_RATIO;
  if (Math.abs(totalRatio - 1.0) > 0.001) {
    throw new Error(`Split ratios must sum to 1.0 (current: ${totalRatio})`);
  }

  const stats: SplitStats = {
    totalRows: 0,
    trainRows: 0,
    valRows: 0,
    testRows: 0,
    startTime: Date.now(),
  };

  // Step 1: Read all data into memory
  console.log('📖 Reading dataset into memory...');
  const dataRows: string[] = [];
  let header = '';

  const fileStream = createReadStream(INPUT_FILE);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      header = line;
      isFirstLine = false;
      continue;
    }

    if (line.trim() !== '') {
      dataRows.push(line);
      stats.totalRows++;
    }
  }

  console.log(`   ✓ Read ${stats.totalRows.toLocaleString()} rows\n`);

  // Step 2: Shuffle the data
  console.log('🔀 Shuffling data randomly...');
  const shuffledRows = shuffleArray(dataRows);
  console.log('   ✓ Data shuffled\n');

  // Step 3: Calculate split indices
  const trainEndIdx = Math.floor(stats.totalRows * TRAIN_RATIO);
  const valEndIdx = trainEndIdx + Math.floor(stats.totalRows * VAL_RATIO);

  stats.trainRows = trainEndIdx;
  stats.valRows = valEndIdx - trainEndIdx;
  stats.testRows = stats.totalRows - valEndIdx;

  console.log('✂️  Splitting dataset...');
  console.log(`   Train: ${stats.trainRows.toLocaleString()} rows`);
  console.log(`   Val:   ${stats.valRows.toLocaleString()} rows`);
  console.log(`   Test:  ${stats.testRows.toLocaleString()} rows\n`);

  // Step 4: Write train split
  console.log('💾 Writing train.csv...');
  const trainStream = createWriteStream(TRAIN_FILE);
  trainStream.write(header + '\n');
  for (let i = 0; i < trainEndIdx; i++) {
    trainStream.write(shuffledRows[i] + '\n');
  }
  trainStream.end();
  await new Promise<void>((resolve, reject) => {
    trainStream.on('finish', resolve);
    trainStream.on('error', reject);
  });
  const trainSize = (fs.statSync(TRAIN_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`   ✓ train.csv (${trainSize} MB)\n`);

  // Step 5: Write validation split
  console.log('💾 Writing val.csv...');
  const valStream = createWriteStream(VAL_FILE);
  valStream.write(header + '\n');
  for (let i = trainEndIdx; i < valEndIdx; i++) {
    valStream.write(shuffledRows[i] + '\n');
  }
  valStream.end();
  await new Promise<void>((resolve, reject) => {
    valStream.on('finish', resolve);
    valStream.on('error', reject);
  });
  const valSize = (fs.statSync(VAL_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`   ✓ val.csv (${valSize} MB)\n`);

  // Step 6: Write test split
  console.log('💾 Writing test.csv...');
  const testStream = createWriteStream(TEST_FILE);
  testStream.write(header + '\n');
  for (let i = valEndIdx; i < stats.totalRows; i++) {
    testStream.write(shuffledRows[i] + '\n');
  }
  testStream.end();
  await new Promise<void>((resolve, reject) => {
    testStream.on('finish', resolve);
    testStream.on('error', reject);
  });
  const testSize = (fs.statSync(TEST_FILE).size / (1024 * 1024)).toFixed(2);
  console.log(`   ✓ test.csv (${testSize} MB)\n`);

  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

  console.log('═'.repeat(60));
  console.log('✅ SPLIT COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`📊 Total samples:     ${stats.totalRows.toLocaleString()}`);
  console.log(`📈 Training samples:  ${stats.trainRows.toLocaleString()} (${(TRAIN_RATIO * 100).toFixed(1)}%)`);
  console.log(`📊 Validation samples: ${stats.valRows.toLocaleString()} (${(VAL_RATIO * 100).toFixed(1)}%)`);
  console.log(`🧪 Test samples:      ${stats.testRows.toLocaleString()} (${(TEST_RATIO * 100).toFixed(1)}%)`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log('═'.repeat(60));
  console.log('\n📂 Output files:');
  console.log(`   ${TRAIN_FILE}`);
  console.log(`   ${VAL_FILE}`);
  console.log(`   ${TEST_FILE}`);
  console.log('\n🎯 Next step: Train your model using these datasets!\n');
}

// Run the split
splitDataset().catch(error => {
  console.error('❌ Error splitting dataset:', error);
  process.exit(1);
});
