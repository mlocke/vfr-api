#!/usr/bin/env ts-node
/**
 * Build comprehensive options dataset from EODHD Options API
 *
 * With 100,000 calls/day, you can systematically download options data
 * for all 6,000+ tickers and save to Parquet files
 *
 * Usage: npx ts-node build-eodhd-options-dataset.ts
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { config } from 'dotenv';

config();

const EODHD_API_KEY = process.env.EODHD_API_KEY;
const BASE_URL = 'https://eodhd.com/api';
const OUTPUT_DIR = './data/eodhd_options';
const RATE_LIMIT = 100000; // Daily limit
const BATCH_SIZE = 100; // Process 100 tickers at a time
const DELAY_MS = 100; // Delay between requests to avoid rate limiting

interface OptionsData {
  code: string;
  exchange: string;
  lastTradeDate: string;
  lastTradePrice: number;
  expirationDate: string;
  strike: number;
  type: string; // 'call' or 'put'
  bid: number;
  ask: number;
  change: number;
  changePercent: number;
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
  [key: string]: any;
}

class EODHDOptionsDatasetBuilder {
  private apiCallCount = 0;
  private startTime = Date.now();

  constructor() {
    // Create output directory
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  /**
   * Get list of all available tickers with options data
   */
  async getTickersList(): Promise<string[]> {
    // You can either:
    // 1. Use a predefined list of S&P 500 or major stocks
    // 2. Query EODHD for available options tickers
    // 3. Use the S&P 500 list we downloaded earlier from Kaggle

    // For now, let's use common high-volume tickers
    // You should expand this based on your needs
    const majorTickers = [
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'AMD',
      'NFLX', 'DIS', 'BABA', 'V', 'MA', 'JPM', 'BAC', 'WFC', 'GS',
      'SPY', 'QQQ', 'IWM', 'XLF', 'XLE', 'XLK', 'XLV', 'XLI', 'XLU',
      // Add more tickers from your S&P 500 dataset
    ];

    console.log(`📋 Processing ${majorTickers.length} tickers`);
    return majorTickers;
  }

  /**
   * Get options data for a specific ticker
   */
  async getOptionsData(ticker: string): Promise<OptionsData[] | null> {
    try {
      const url = `${BASE_URL}/options/${ticker}.US?api_token=${EODHD_API_KEY}&fmt=json`;

      const response = await axios.get(url, { timeout: 10000 });
      this.apiCallCount++;

      if (response.data && response.data.data) {
        console.log(`  ✅ ${ticker}: ${response.data.data.length} options contracts`);
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log(`  ⚠️  ${ticker}: No options data available`);
      } else if (error.response?.status === 429) {
        console.log(`  🚫 Rate limit reached. Used ${this.apiCallCount} calls today.`);
        throw new Error('Rate limit exceeded');
      } else {
        console.log(`  ❌ ${ticker}: Error - ${error.message}`);
      }
      return null;
    }
  }

  /**
   * Save options data to JSON file
   */
  saveToJSON(ticker: string, data: OptionsData[], date: string) {
    const filename = path.join(OUTPUT_DIR, `${ticker}_${date}.json`);
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
  }

  /**
   * Save options data to CSV format
   */
  saveToCSV(ticker: string, data: OptionsData[], date: string) {
    if (!data || data.length === 0) return;

    const filename = path.join(OUTPUT_DIR, `${ticker}_${date}.csv`);

    // Get all unique keys from data
    const keys = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));

    // Create CSV header
    const header = keys.join(',');

    // Create CSV rows
    const rows = data.map(option =>
      keys.map(key => {
        const value = option[key];
        // Handle values that might contain commas
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value ?? '';
      }).join(',')
    );

    const csv = [header, ...rows].join('\n');
    fs.writeFileSync(filename, csv);
  }

  /**
   * Build comprehensive dataset
   */
  async buildDataset(format: 'json' | 'csv' | 'both' = 'both') {
    console.log('═'.repeat(80));
    console.log('EODHD OPTIONS DATASET BUILDER');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`📊 Output directory: ${OUTPUT_DIR}`);
    console.log(`📁 Format: ${format}`);
    console.log(`⚡ Daily limit: ${RATE_LIMIT.toLocaleString()} API calls`);
    console.log('');

    const tickers = await this.getTickersList();
    const today = new Date().toISOString().split('T')[0];

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < tickers.length; i++) {
      const ticker = tickers[i];

      console.log(`\n[${i + 1}/${tickers.length}] Processing ${ticker}...`);

      // Check if we're approaching rate limit
      if (this.apiCallCount >= RATE_LIMIT * 0.95) {
        console.log('\n⚠️  Approaching daily rate limit. Stopping...');
        break;
      }

      const data = await this.getOptionsData(ticker);

      if (data && data.length > 0) {
        if (format === 'json' || format === 'both') {
          this.saveToJSON(ticker, data, today);
        }
        if (format === 'csv' || format === 'both') {
          this.saveToCSV(ticker, data, today);
        }
        successCount++;
      } else {
        errorCount++;
      }

      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    // Summary
    const duration = ((Date.now() - this.startTime) / 1000 / 60).toFixed(2);
    console.log('\n' + '═'.repeat(80));
    console.log('✨ DATASET BUILD COMPLETE');
    console.log('═'.repeat(80));
    console.log(`✅ Success: ${successCount} tickers`);
    console.log(`❌ Errors: ${errorCount} tickers`);
    console.log(`📞 API calls used: ${this.apiCallCount.toLocaleString()} / ${RATE_LIMIT.toLocaleString()}`);
    console.log(`⏱️  Duration: ${duration} minutes`);
    console.log(`📁 Files saved to: ${OUTPUT_DIR}`);
    console.log('');
    console.log('💡 Next steps:');
    console.log('  1. Convert CSV to Parquet for efficient storage');
    console.log('  2. Import to PostgreSQL database');
    console.log('  3. Combine with Kaggle options datasets');
    console.log('  4. Build ML features from options data');
  }

  /**
   * Get historical options data for a ticker
   */
  async getHistoricalOptions(ticker: string, date: string): Promise<OptionsData[] | null> {
    try {
      const url = `${BASE_URL}/options/${ticker}.US?api_token=${EODHD_API_KEY}&date=${date}&fmt=json`;

      const response = await axios.get(url, { timeout: 10000 });
      this.apiCallCount++;

      if (response.data && response.data.data) {
        return response.data.data;
      }

      return null;
    } catch (error: any) {
      console.log(`  ❌ ${ticker} (${date}): Error - ${error.message}`);
      return null;
    }
  }

  /**
   * Build historical dataset for a ticker across multiple dates
   */
  async buildHistoricalDataset(ticker: string, startDate: string, endDate: string) {
    console.log(`📅 Building historical dataset for ${ticker}`);
    console.log(`   From: ${startDate}`);
    console.log(`   To: ${endDate}`);

    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];

    // Generate weekly dates (to avoid using all 100k calls on one ticker)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    console.log(`   ${dates.length} weeks to process`);

    for (const date of dates) {
      if (this.apiCallCount >= RATE_LIMIT * 0.95) {
        console.log('\n⚠️  Approaching daily rate limit. Stopping...');
        break;
      }

      console.log(`  📆 ${date}...`);
      const data = await this.getHistoricalOptions(ticker, date);

      if (data && data.length > 0) {
        this.saveToJSON(ticker, data, date);
        this.saveToCSV(ticker, data, date);
        console.log(`     ✅ ${data.length} contracts saved`);
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }

    console.log(`✅ Historical dataset complete for ${ticker}`);
    console.log(`   API calls used: ${this.apiCallCount.toLocaleString()}`);
  }
}

// Main execution
async function main() {
  const builder = new EODHDOptionsDatasetBuilder();

  // Choose what to build:

  // Option 1: Build current options data for all tickers
  await builder.buildDataset('both');

  // Option 2: Build historical dataset for specific tickers
  // await builder.buildHistoricalDataset('AAPL', '2024-01-01', '2024-12-31');
  // await builder.buildHistoricalDataset('TSLA', '2024-01-01', '2024-12-31');
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { EODHDOptionsDatasetBuilder };
