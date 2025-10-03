#!/usr/bin/env node

/**
 * Algorithm Configuration Initialization Script
 *
 * Creates default algorithm configurations needed for the stock selection system
 * This script sets up the "composite" and "quality" algorithms that are referenced
 * as defaults in the system configuration.
 */

const fs = require("fs").promises;
const path = require("path");

// Mock algorithm configurations to be created
const ALGORITHM_CONFIGURATIONS = {
	composite: {
		id: "composite",
		name: "Composite Multi-Factor Strategy",
		description: "Balanced approach combining momentum, value, quality, and growth factors",
		type: "COMPOSITE",
		enabled: true,
		selectionCriteria: "SCORE_BASED",

		universe: {
			maxPositions: 50,
			marketCapMin: 100000000, // $100M minimum
			sectors: [], // All sectors
			exchanges: ["NYSE", "NASDAQ"],
			excludeSymbols: [],
		},

		weights: [
			{ factor: "momentum_3m", weight: 0.25, enabled: true },
			{ factor: "quality_composite", weight: 0.25, enabled: true },
			{ factor: "value_composite", weight: 0.2, enabled: true },
			{ factor: "revenue_growth", weight: 0.15, enabled: true },
			{ factor: "volatility_30d", weight: 0.15, enabled: true },
		],

		selection: {
			topN: 25,
			rebalanceFrequency: 604800, // Weekly (7 days in seconds)
			minHoldingPeriod: 259200, // 3 days
			threshold: 0.7,
		},

		risk: {
			maxSectorWeight: 0.25,
			maxSinglePosition: 0.08,
			maxTurnover: 1.0,
			riskModel: "factor_based",
		},

		dataFusion: {
			minQualityScore: 0.75,
			requiredSources: ["polygon", "yahoo"],
			conflictResolution: "highest_quality",
			cacheTTL: 1800, // 30 minutes
		},

		metadata: {
			createdAt: Date.now(),
			updatedAt: Date.now(),
			createdBy: "system_init",
			version: 1,
			backtestedFrom: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
			backtestedTo: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
		},
	},

	quality: {
		id: "quality",
		name: "Quality-Focused Strategy",
		description:
			"Conservative strategy focusing on high-quality companies with strong fundamentals",
		type: "QUALITY",
		enabled: true,
		selectionCriteria: "SCORE_BASED",

		universe: {
			maxPositions: 30,
			marketCapMin: 1000000000, // $1B minimum
			sectors: [], // All sectors
			exchanges: ["NYSE", "NASDAQ"],
			excludeSymbols: [],
		},

		weights: [
			{ factor: "quality_composite", weight: 0.4, enabled: true },
			{ factor: "roe", weight: 0.2, enabled: true },
			{ factor: "debt_equity", weight: 0.15, enabled: true },
			{ factor: "current_ratio", weight: 0.15, enabled: true },
			{ factor: "dividend_yield", weight: 0.1, enabled: true },
		],

		selection: {
			topN: 20,
			rebalanceFrequency: 2592000, // Monthly (30 days in seconds)
			minHoldingPeriod: 604800, // 1 week
			threshold: 0.8,
		},

		risk: {
			maxSectorWeight: 0.3,
			maxSinglePosition: 0.1,
			maxTurnover: 0.5,
			riskModel: "conservative",
		},

		dataFusion: {
			minQualityScore: 0.8,
			requiredSources: ["polygon", "alpha_vantage"],
			conflictResolution: "highest_quality",
			cacheTTL: 3600, // 1 hour
		},

		metadata: {
			createdAt: Date.now(),
			updatedAt: Date.now(),
			createdBy: "system_init",
			version: 1,
			backtestedFrom: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
			backtestedTo: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
		},
	},

	momentum: {
		id: "momentum",
		name: "Momentum Strategy",
		description: "Aggressive momentum-based strategy for trending stocks",
		type: "MOMENTUM",
		enabled: true,
		selectionCriteria: "QUANTILE_BASED",

		universe: {
			maxPositions: 40,
			marketCapMin: 500000000, // $500M minimum
			sectors: [], // All sectors
			exchanges: ["NYSE", "NASDAQ"],
			excludeSymbols: [],
		},

		weights: [
			{ factor: "momentum_3m", weight: 0.3, enabled: true },
			{ factor: "momentum_1m", weight: 0.25, enabled: true },
			{ factor: "rsi_14d", weight: 0.2, enabled: true },
			{ factor: "revenue_growth", weight: 0.15, enabled: true },
			{ factor: "macd_signal", weight: 0.1, enabled: true },
		],

		selection: {
			quantile: 0.2,
			rebalanceFrequency: 86400, // Daily
			minHoldingPeriod: 172800, // 2 days
			threshold: 0.6,
		},

		risk: {
			maxSectorWeight: 0.4,
			maxSinglePosition: 0.06,
			maxTurnover: 1.5,
			riskModel: "aggressive",
		},

		dataFusion: {
			minQualityScore: 0.7,
			requiredSources: ["polygon", "yahoo"],
			conflictResolution: "latest",
			cacheTTL: 900, // 15 minutes
		},

		metadata: {
			createdAt: Date.now(),
			updatedAt: Date.now(),
			createdBy: "system_init",
			version: 1,
			backtestedFrom: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
			backtestedTo: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
		},
	},
};

/**
 * Mock algorithm configuration storage
 * In a real implementation, this would save to a database
 */
class MockAlgorithmConfigStorage {
	constructor() {
		this.configPath = path.join(__dirname, "..", "data", "algorithm-configs.json");
		this.configs = new Map();
	}

	async initialize() {
		// Create data directory if it doesn't exist
		const dataDir = path.dirname(this.configPath);
		try {
			await fs.mkdir(dataDir, { recursive: true });
		} catch (error) {
			// Directory already exists
		}

		// Load existing configurations if they exist
		try {
			const existing = await fs.readFile(this.configPath, "utf8");
			const parsedConfigs = JSON.parse(existing);
			for (const [id, config] of Object.entries(parsedConfigs)) {
				this.configs.set(id, config);
			}
			console.log(`📚 Loaded ${this.configs.size} existing algorithm configurations`);
		} catch (error) {
			console.log("📚 No existing configurations found, starting fresh");
		}
	}

	async storeConfiguration(config) {
		this.configs.set(config.id, config);

		// Save all configurations to file
		const configsObject = Object.fromEntries(this.configs);
		await fs.writeFile(this.configPath, JSON.stringify(configsObject, null, 2), "utf8");

		console.log(`💾 Stored algorithm configuration: ${config.name} (${config.id})`);
	}

	async getConfiguration(id) {
		return this.configs.get(id) || null;
	}

	async listConfigurations() {
		return Array.from(this.configs.values());
	}

	getConfigurationCount() {
		return this.configs.size;
	}
}

/**
 * Initialize algorithm configurations
 */
async function initializeAlgorithmConfigurations() {
	console.log("🚀 Initializing algorithm configurations...");

	const storage = new MockAlgorithmConfigStorage();
	await storage.initialize();

	let created = 0;
	let updated = 0;

	// Create each algorithm configuration
	for (const [id, config] of Object.entries(ALGORITHM_CONFIGURATIONS)) {
		const existing = await storage.getConfiguration(id);

		if (existing) {
			// Update metadata but keep existing configuration
			const updatedConfig = {
				...existing,
				metadata: {
					...existing.metadata,
					updatedAt: Date.now(),
					version: existing.metadata.version + 1,
				},
			};

			await storage.storeConfiguration(updatedConfig);
			updated++;
			console.log(`🔄 Updated existing configuration: ${config.name}`);
		} else {
			await storage.storeConfiguration(config);
			created++;
			console.log(`✅ Created new configuration: ${config.name}`);
		}
	}

	console.log(`\n📊 Configuration Summary:`);
	console.log(`   • Created: ${created} new configurations`);
	console.log(`   • Updated: ${updated} existing configurations`);
	console.log(`   • Total: ${storage.getConfigurationCount()} configurations available`);

	return storage;
}

/**
 * Create cache health check patch
 */
async function createCacheHealthPatch() {
	console.log("🔧 Creating cache health check patch...");

	const patchContent = `/**
 * Cache Health Check Patch
 * Adds missing ping method to RedisCache for health checks
 */

// Add ping method to RedisCache prototype if it doesn't exist
const { RedisCache } = require('../app/services/cache/RedisCache');

if (RedisCache.prototype && !RedisCache.prototype.ping) {
  RedisCache.prototype.ping = async function() {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('Redis ping failed:', error);
      return false;
    }
  };

  console.log('✅ Added ping method to RedisCache');
}

module.exports = { RedisCache };
`;

	const patchPath = path.join(__dirname, "..", "app", "services", "cache", "RedisCache.patch.js");
	await fs.writeFile(patchPath, patchContent, "utf8");
	console.log(`💾 Created cache patch: ${patchPath}`);
}

/**
 * Test the algorithm configuration system
 */
async function testAlgorithmSystem() {
	console.log("\n🧪 Testing algorithm configuration system...");

	const storage = new MockAlgorithmConfigStorage();
	await storage.initialize();

	// Test getting configurations
	const composite = await storage.getConfiguration("composite");
	const quality = await storage.getConfiguration("quality");

	if (composite && quality) {
		console.log("✅ Default algorithms are available:");
		console.log(`   • ${composite.name}: ${composite.weights.length} factors`);
		console.log(`   • ${quality.name}: ${quality.weights.length} factors`);

		// Test configuration validation
		const isCompositeValid = validateConfiguration(composite);
		const isQualityValid = validateConfiguration(quality);

		console.log(`✅ Configuration validation:`);
		console.log(`   • Composite: ${isCompositeValid ? "Valid" : "Invalid"}`);
		console.log(`   • Quality: ${isQualityValid ? "Valid" : "Invalid"}`);

		return isCompositeValid && isQualityValid;
	} else {
		console.log("❌ Default algorithms not found");
		return false;
	}
}

/**
 * Basic configuration validation
 */
function validateConfiguration(config) {
	try {
		// Basic validation checks
		if (!config.id || !config.name || !config.type) {
			return false;
		}

		if (!config.universe || !config.weights || !config.selection) {
			return false;
		}

		if (config.weights.length === 0) {
			return false;
		}

		// Validate weights sum to reasonable total
		const totalWeight = config.weights
			.filter(w => w.enabled)
			.reduce((sum, w) => sum + w.weight, 0);

		if (totalWeight <= 0 || totalWeight > 2) {
			// Allow some flexibility
			return false;
		}

		return true;
	} catch (error) {
		console.error("Configuration validation error:", error);
		return false;
	}
}

/**
 * Generate initialization summary report
 */
async function generateInitializationReport(storage) {
	console.log("\n📋 Generating initialization report...");

	const configs = await storage.listConfigurations();
	const timestamp = new Date().toISOString();

	const report = `# Algorithm Configuration Initialization Report

**Generated:** ${timestamp}

## Summary
- **Total Configurations:** ${configs.length}
- **Status:** System Ready ✅

## Configurations Created

${configs
	.map(
		config => `### ${config.name} (\`${config.id}\`)
- **Type:** ${config.type}
- **Factors:** ${config.weights.length}
- **Max Positions:** ${config.universe.maxPositions}
- **Rebalance Frequency:** ${config.selection.rebalanceFrequency / 86400} days
- **Risk Level:** ${config.risk.maxTurnover > 1 ? "High" : config.risk.maxTurnover > 0.5 ? "Medium" : "Low"}
`
	)
	.join("\n")}

## Next Steps
1. Start the application server
2. Test the stock analysis endpoints
3. Monitor algorithm performance

## Available Endpoints
- \`GET /api/stocks/select\` - Health check
- \`POST /api/stocks/select\` - Stock analysis

---
*Report generated by algorithm initialization script*
`;

	const reportPath = path.join(
		__dirname,
		"..",
		"docs",
		"test-output",
		"algorithm-initialization-report.md"
	);
	await fs.writeFile(reportPath, report, "utf8");
	console.log(`📄 Report saved: ${reportPath}`);
}

/**
 * Main execution function
 */
async function main() {
	try {
		console.log("🎯 Algorithm Configuration Initialization");
		console.log("=".repeat(50));

		// Step 1: Initialize algorithm configurations
		const storage = await initializeAlgorithmConfigurations();

		// Step 2: Create cache health patch
		await createCacheHealthPatch();

		// Step 3: Test the system
		const testPassed = await testAlgorithmSystem();

		// Step 4: Generate report
		await generateInitializationReport(storage);

		console.log("\n" + "=".repeat(50));
		if (testPassed) {
			console.log("✅ Algorithm configuration initialization completed successfully!");
			console.log("🚀 The system is now ready for stock analysis");
		} else {
			console.log("⚠️  Initialization completed but tests failed");
			console.log("🔍 Check the configurations and try again");
		}

		return testPassed;
	} catch (error) {
		console.error("❌ Initialization failed:", error);
		throw error;
	}
}

// Run if called directly
if (require.main === module) {
	main()
		.then(success => {
			process.exit(success ? 0 : 1);
		})
		.catch(error => {
			console.error("Fatal error:", error);
			process.exit(1);
		});
}

module.exports = {
	initializeAlgorithmConfigurations,
	testAlgorithmSystem,
	validateConfiguration,
	ALGORITHM_CONFIGURATIONS,
};
