/**
 * Verify Phase 3 Cache Statistics
 * Purpose: Check that getCacheStats() returns correct counts after training data generation
 */

import { AnalystRatingsCache } from "./AnalystRatingsCache.js";
import { SECFilingsCache } from "./SECFilingsCache.js";
import { OptionsDataCache } from "./OptionsDataCache.js";

console.log("=".repeat(80));
console.log("📊 Phase 3 Cache Statistics Verification");
console.log("=".repeat(80));

const analystCache = new AnalystRatingsCache();
const secCache = new SECFilingsCache();
const optionsCache = new OptionsDataCache();

const analystStats = analystCache.getCacheStats();
const secStats = secCache.getCacheStats();
const optionsStats = optionsCache.getCacheStats();

console.log("\n1. Analyst Ratings Cache:");
console.log(`   Total Entries: ${analystStats.totalEntries}`);
console.log(`   Historical: ${analystStats.historicalEntries}`);
console.log(`   Recent: ${analystStats.recentEntries}`);

console.log("\n2. SEC Filings Cache:");
console.log(`   Total Entries: ${secStats.totalEntries}`);
console.log(`   Historical: ${secStats.historicalEntries}`);
console.log(`   Recent: ${secStats.recentEntries}`);

console.log("\n3. Options Data Cache:");
console.log(`   Total Entries: ${optionsStats.totalEntries}`);
console.log(`   Historical: ${optionsStats.historicalEntries}`);
console.log(`   Recent: ${optionsStats.recentEntries}`);

console.log("\n" + "=".repeat(80));
console.log("Summary:");
console.log(`  Total cached items across all 3 Phase 3 caches: ${analystStats.totalEntries + secStats.totalEntries + optionsStats.totalEntries}`);
console.log("=".repeat(80));
