#!/usr/bin/env npx tsx

/**
 * Merges multiple smart money flow CSV datasets into a single combined dataset
 */

import fs from 'fs';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { createInterface } from 'readline';

const DATA_DIR = path.join(process.cwd(), 'data/training/smart-money-flow');
const OUTPUT_FILE = path.join(DATA_DIR, 'combined_dataset.csv');

interface MergeStats {
  filesProcessed: number;
  totalRows: number;
  startTime: number;
}

async function mergeCSVFiles(): Promise<void> {
  const stats: MergeStats = {
    filesProcessed: 0,
    totalRows: 0,
    startTime: Date.now(),
  };

  console.log('🔄 Starting CSV merge process...\n');
  console.log(`📁 Reading from: ${DATA_DIR}`);
  console.log(`📝 Output file: ${OUTPUT_FILE}\n`);

  // Get all CSV files except the combined one
  const files = fs.readdirSync(DATA_DIR)
    .filter(f => f.endsWith('.csv') && f !== 'combined_dataset.csv')
    .sort(); // Sort for consistent ordering

  if (files.length === 0) {
    console.log('❌ No CSV files found to merge!');
    return;
  }

  console.log(`📊 Found ${files.length} CSV files to merge:`);
  files.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
  console.log('');

  const writeStream = createWriteStream(OUTPUT_FILE);
  let headerWritten = false;

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    console.log(`📖 Processing: ${file}`);

    let rowCount = 0;
    let isFirstLine = true;

    const fileStream = createReadStream(filePath);
    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        // Write header only once
        if (!headerWritten) {
          writeStream.write(line + '\n');
          headerWritten = true;
        }
        continue;
      }

      // Skip empty lines
      if (line.trim() === '') {
        continue;
      }

      writeStream.write(line + '\n');
      rowCount++;
      stats.totalRows++;
    }

    stats.filesProcessed++;
    console.log(`   ✓ Added ${rowCount.toLocaleString()} rows\n`);
  }

  writeStream.end();

  // Wait for write stream to finish
  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(2);

  console.log('═'.repeat(60));
  console.log('✅ MERGE COMPLETE!');
  console.log('═'.repeat(60));
  console.log(`📁 Files merged: ${stats.filesProcessed}`);
  console.log(`📊 Total rows: ${stats.totalRows.toLocaleString()}`);
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`💾 Output: ${OUTPUT_FILE}`);
  console.log('═'.repeat(60));

  // Show file size
  const fileStats = fs.statSync(OUTPUT_FILE);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
  console.log(`📦 File size: ${fileSizeMB} MB\n`);
}

// Run the merge
mergeCSVFiles().catch(error => {
  console.error('❌ Error merging datasets:', error);
  process.exit(1);
});
