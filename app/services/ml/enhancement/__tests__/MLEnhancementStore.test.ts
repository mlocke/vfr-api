/**
 * MLEnhancementStore Tests
 *
 * Tests for the ML Enhancement Store that persists ML enhancements
 * to VFR factor scores in PostgreSQL.
 *
 * NO MOCK DATA policy - uses real database connections
 * Performance target: <100ms for single record storage
 */

import { MLEnhancementStore } from "../MLEnhancementStore";
import type {
	EnhancementRecord,
	EnhancementRetrievalOptions,
	EnhancementStatistics,
} from "../MLEnhancementStore";

describe("MLEnhancementStore", () => {
	let store: MLEnhancementStore;

	beforeAll(async () => {
		store = MLEnhancementStore.getInstance();
		await store.initialize();
	});

	afterAll(async () => {
		await store.close();
	});

	describe("Initialization", () => {
		it("should initialize successfully", async () => {
			const health = await store.healthCheck();

			expect(health.status).toBe("healthy");
			expect(health.latency).toBeGreaterThan(0);
			expect(health.latency).toBeLessThan(1000);
		});

		it("should use singleton pattern", () => {
			const instance1 = MLEnhancementStore.getInstance();
			const instance2 = MLEnhancementStore.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe("Single Record Storage", () => {
		const testRecord: EnhancementRecord = {
			ticker: "AAPL",
			timestamp: Date.now(),
			enhancementId: "550e8400-e29b-41d4-a716-446655440000",
			baseVfrValue: 0.75,
			enhancedValue: 0.82,
			enhancedCompositeValue: 0.79,
			confidenceScore: 0.85,
			dataQualityScore: 0.9,
			vfrFactorName: "technical",
			enhancementWeight: 0.1,
			enhancementLatencyMs: 250,
			modelsUsed: ["lightgbm_v1", "xgboost_v1"],
			fallbackMode: false,
			validationStatus: "valid",
		};

		it("should store a single enhancement record", async () => {
			await expect(store.storeEnhancement(testRecord)).resolves.not.toThrow();
		});

		it("should retrieve stored record", async () => {
			const timestamp = Date.now();
			const record: EnhancementRecord = {
				...testRecord,
				ticker: "GOOGL",
				timestamp,
				enhancementId: "550e8400-e29b-41d4-a716-446655440001",
			};

			await store.storeEnhancement(record);

			const retrieved = await store.getLatestEnhancement("GOOGL");

			expect(retrieved).not.toBeNull();
			if (retrieved) {
				expect(retrieved.ticker).toBe("GOOGL");
				expect(retrieved.enhancementId).toBe(record.enhancementId);
				expect(retrieved.baseVfrValue).toBe(record.baseVfrValue);
				expect(retrieved.enhancedValue).toBe(record.enhancedValue);
				expect(retrieved.confidenceScore).toBe(record.confidenceScore);
			}
		});

		it("should handle upsert on conflict", async () => {
			const timestamp = Date.now();
			const record: EnhancementRecord = {
				...testRecord,
				ticker: "MSFT",
				timestamp,
				enhancedValue: 0.75,
			};

			// First insert
			await store.storeEnhancement(record);

			// Update with new enhanced value
			const updatedRecord: EnhancementRecord = {
				...record,
				enhancedValue: 0.85,
			};

			await store.storeEnhancement(updatedRecord);

			// Retrieve and verify update
			const retrieved = await store.getLatestEnhancement("MSFT");

			expect(retrieved).not.toBeNull();
			if (retrieved) {
				expect(retrieved.enhancedValue).toBe(0.85);
			}
		});

		it("should store record with low latency", async () => {
			const record: EnhancementRecord = {
				...testRecord,
				ticker: "TSLA",
				timestamp: Date.now(),
				enhancementId: "550e8400-e29b-41d4-a716-446655440002",
			};

			const startTime = Date.now();
			await store.storeEnhancement(record);
			const latency = Date.now() - startTime;

			// Should be fast
			expect(latency).toBeLessThan(500); // 500ms max
		});
	});

	describe("Batch Storage", () => {
		it("should store multiple records in batch", async () => {
			const timestamp = Date.now();
			const records: EnhancementRecord[] = [
				{
					ticker: "NVDA",
					timestamp,
					enhancementId: "550e8400-e29b-41d4-a716-446655440010",
					baseVfrValue: 0.7,
					enhancedValue: 0.75,
					enhancedCompositeValue: 0.73,
					confidenceScore: 0.8,
					dataQualityScore: 0.85,
					vfrFactorName: "technical",
					enhancementWeight: 0.1,
					enhancementLatencyMs: 200,
					modelsUsed: ["lightgbm_v1"],
					fallbackMode: false,
					validationStatus: "valid",
				},
				{
					ticker: "AMD",
					timestamp,
					enhancementId: "550e8400-e29b-41d4-a716-446655440010",
					baseVfrValue: 0.65,
					enhancedValue: 0.72,
					enhancedCompositeValue: 0.69,
					confidenceScore: 0.82,
					dataQualityScore: 0.88,
					vfrFactorName: "technical",
					enhancementWeight: 0.1,
					enhancementLatencyMs: 220,
					modelsUsed: ["lightgbm_v1"],
					fallbackMode: false,
					validationStatus: "valid",
				},
				{
					ticker: "INTC",
					timestamp,
					enhancementId: "550e8400-e29b-41d4-a716-446655440010",
					baseVfrValue: 0.6,
					enhancedValue: 0.68,
					enhancedCompositeValue: 0.65,
					confidenceScore: 0.78,
					dataQualityScore: 0.83,
					vfrFactorName: "technical",
					enhancementWeight: 0.1,
					enhancementLatencyMs: 240,
					modelsUsed: ["lightgbm_v1"],
					fallbackMode: false,
					validationStatus: "valid",
				},
			];

			await expect(store.storeEnhancementBatch(records)).resolves.not.toThrow();
		});

		it("should handle large batch efficiently", async () => {
			const timestamp = Date.now();
			const largeBatch: EnhancementRecord[] = Array.from({ length: 100 }, (_, i) => ({
				ticker: `SYM${i.toString().padStart(3, "0")}`,
				timestamp: timestamp + i,
				enhancementId: "550e8400-e29b-41d4-a716-446655440020",
				baseVfrValue: 0.7 + (i % 30) / 100,
				enhancedValue: 0.75 + (i % 30) / 100,
				enhancedCompositeValue: 0.73 + (i % 30) / 100,
				confidenceScore: 0.8 + (i % 20) / 100,
				dataQualityScore: 0.85 + (i % 15) / 100,
				vfrFactorName: "technical",
				enhancementWeight: 0.1,
				enhancementLatencyMs: 200 + i,
				modelsUsed: ["lightgbm_v1"],
				fallbackMode: false,
				validationStatus: "valid",
			}));

			const startTime = Date.now();
			await store.storeEnhancementBatch(largeBatch);
			const latency = Date.now() - startTime;

			// Should be efficient even for large batch
			expect(latency).toBeLessThan(5000); // 5s max for 100 records
		});

		it("should handle empty batch gracefully", async () => {
			await expect(store.storeEnhancementBatch([])).resolves.not.toThrow();
		});
	});

	describe("Retrieval", () => {
		beforeAll(async () => {
			// Seed test data
			const timestamp = Date.now();
			const testData: EnhancementRecord[] = [
				{
					ticker: "RETRIEVE_TEST_1",
					timestamp,
					enhancementId: "550e8400-e29b-41d4-a716-446655440030",
					baseVfrValue: 0.7,
					enhancedValue: 0.75,
					enhancedCompositeValue: 0.73,
					confidenceScore: 0.85,
					dataQualityScore: 0.9,
					vfrFactorName: "technical",
					enhancementWeight: 0.1,
					enhancementLatencyMs: 200,
					modelsUsed: ["lightgbm_v1"],
					fallbackMode: false,
					validationStatus: "valid",
				},
				{
					ticker: "RETRIEVE_TEST_2",
					timestamp: timestamp + 1000,
					enhancementId: "550e8400-e29b-41d4-a716-446655440030",
					baseVfrValue: 0.65,
					enhancedValue: 0.7,
					enhancedCompositeValue: 0.68,
					confidenceScore: 0.8,
					dataQualityScore: 0.85,
					vfrFactorName: "fundamental",
					enhancementWeight: 0.1,
					enhancementLatencyMs: 250,
					modelsUsed: ["xgboost_v1"],
					fallbackMode: true,
					validationStatus: "fallback",
				},
			];

			await store.storeEnhancementBatch(testData);
		});

		it("should retrieve by ticker", async () => {
			const options: EnhancementRetrievalOptions = {
				ticker: "RETRIEVE_TEST_1",
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			expect(results[0].ticker).toBe("RETRIEVE_TEST_1");
		});

		it("should retrieve by enhancement ID", async () => {
			const options: EnhancementRetrievalOptions = {
				enhancementId: "550e8400-e29b-41d4-a716-446655440030",
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			expect(results.every(r => r.enhancementId === options.enhancementId)).toBe(true);
		});

		it("should retrieve by VFR factor name", async () => {
			const options: EnhancementRetrievalOptions = {
				vfrFactorName: "technical",
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			expect(results.every(r => r.vfrFactorName === "technical")).toBe(true);
		});

		it("should retrieve by validation status", async () => {
			const options: EnhancementRetrievalOptions = {
				validationStatus: ["valid"],
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			expect(results.every(r => r.validationStatus === "valid")).toBe(true);
		});

		it("should retrieve by fallback mode", async () => {
			const options: EnhancementRetrievalOptions = {
				fallbackMode: true,
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			expect(results.every(r => r.fallbackMode === true)).toBe(true);
		});

		it("should retrieve with time range", async () => {
			const now = Date.now();
			const options: EnhancementRetrievalOptions = {
				startTime: now - 60000, // 1 minute ago
				endTime: now + 60000, // 1 minute from now
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeGreaterThan(0);
			results.forEach(r => {
				expect(r.timestamp).toBeGreaterThanOrEqual(options.startTime!);
				expect(r.timestamp).toBeLessThanOrEqual(options.endTime!);
			});
		});

		it("should respect limit parameter", async () => {
			const options: EnhancementRetrievalOptions = {
				limit: 5,
			};

			const results = await store.getEnhancements(options);

			expect(results.length).toBeLessThanOrEqual(5);
		});

		it("should get latest enhancement for ticker", async () => {
			const latest = await store.getLatestEnhancement("RETRIEVE_TEST_2");

			expect(latest).not.toBeNull();
			if (latest) {
				expect(latest.ticker).toBe("RETRIEVE_TEST_2");
				expect(latest.enhancementId).toBe("550e8400-e29b-41d4-a716-446655440030");
			}
		});

		it("should return null for non-existent ticker", async () => {
			const latest = await store.getLatestEnhancement("NON_EXISTENT_TICKER");

			expect(latest).toBeNull();
		});
	});

	describe("Statistics", () => {
		beforeAll(async () => {
			// Seed statistics test data
			const timestamp = Date.now();
			const statsTestData: EnhancementRecord[] = Array.from({ length: 10 }, (_, i) => ({
				ticker: "STATS_TEST",
				timestamp: timestamp + i * 1000,
				enhancementId: `550e8400-e29b-41d4-a716-44665544004${i}`,
				baseVfrValue: 0.7,
				enhancedValue: 0.75,
				enhancedCompositeValue: 0.73,
				confidenceScore: 0.8 + i / 100,
				dataQualityScore: 0.85 + i / 100,
				vfrFactorName: "technical",
				enhancementWeight: 0.1,
				enhancementLatencyMs: 200 + i * 10,
				modelsUsed: ["lightgbm_v1"],
				fallbackMode: i % 3 === 0, // Every 3rd is fallback
				validationStatus: i % 3 === 0 ? "fallback" : "valid",
			}));

			await store.storeEnhancementBatch(statsTestData);
		});

		it("should calculate statistics for ticker", async () => {
			const stats = await store.getStatistics("STATS_TEST");

			expect(stats).toBeDefined();
			expect(stats.ticker).toBe("STATS_TEST");
			expect(stats.totalEnhancements).toBeGreaterThan(0);
			expect(stats.validEnhancements).toBeGreaterThan(0);
			expect(stats.avgConfidence).toBeGreaterThan(0);
			expect(stats.avgConfidence).toBeLessThanOrEqual(1);
			expect(stats.avgDataQuality).toBeGreaterThan(0);
			expect(stats.avgDataQuality).toBeLessThanOrEqual(1);
			expect(stats.avgLatency).toBeGreaterThan(0);
			expect(stats.successRate).toBeGreaterThanOrEqual(0);
			expect(stats.successRate).toBeLessThanOrEqual(1);
		});

		it("should calculate statistics with time range", async () => {
			const now = Date.now();
			const stats = await store.getStatistics("STATS_TEST", {
				start: now - 60000,
				end: now + 60000,
			});

			expect(stats).toBeDefined();
			expect(stats.totalEnhancements).toBeGreaterThan(0);
		});

		it("should track fallback count", async () => {
			const stats = await store.getStatistics("STATS_TEST");

			expect(stats.fallbackCount).toBeGreaterThanOrEqual(0);
			// Should have some fallbacks from test data
			expect(stats.fallbackCount).toBeGreaterThan(0);
		});

		it("should calculate success rate correctly", async () => {
			const stats = await store.getStatistics("STATS_TEST");

			const expectedSuccessRate = stats.validEnhancements / stats.totalEnhancements;

			expect(stats.successRate).toBeCloseTo(expectedSuccessRate, 2);
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid ticker gracefully", async () => {
			const invalidRecord: EnhancementRecord = {
				ticker: "", // Invalid empty ticker
				timestamp: Date.now(),
				enhancementId: "550e8400-e29b-41d4-a716-446655440050",
				baseVfrValue: 0.7,
				enhancedValue: 0.75,
				enhancedCompositeValue: 0.73,
				confidenceScore: 0.85,
				dataQualityScore: 0.9,
				vfrFactorName: "technical",
				enhancementWeight: 0.1,
				enhancementLatencyMs: 200,
				modelsUsed: ["lightgbm_v1"],
				fallbackMode: false,
				validationStatus: "valid",
			};

			await expect(store.storeEnhancement(invalidRecord)).rejects.toThrow();
		});

		it("should handle invalid confidence score", async () => {
			const invalidRecord: EnhancementRecord = {
				ticker: "TEST",
				timestamp: Date.now(),
				enhancementId: "550e8400-e29b-41d4-a716-446655440051",
				baseVfrValue: 0.7,
				enhancedValue: 0.75,
				enhancedCompositeValue: 0.73,
				confidenceScore: 1.5, // Invalid >1
				dataQualityScore: 0.9,
				vfrFactorName: "technical",
				enhancementWeight: 0.1,
				enhancementLatencyMs: 200,
				modelsUsed: ["lightgbm_v1"],
				fallbackMode: false,
				validationStatus: "valid",
			};

			await expect(store.storeEnhancement(invalidRecord)).rejects.toThrow();
		});
	});

	describe("Health Check", () => {
		it("should return healthy status when database is accessible", async () => {
			const health = await store.healthCheck();

			expect(health.status).toBe("healthy");
			expect(health.latency).toBeGreaterThan(0);
			expect(health.error).toBeUndefined();
		});
	});

	describe("Performance", () => {
		it("should store single record quickly", async () => {
			const record: EnhancementRecord = {
				ticker: "PERF_TEST",
				timestamp: Date.now(),
				enhancementId: "550e8400-e29b-41d4-a716-446655440060",
				baseVfrValue: 0.7,
				enhancedValue: 0.75,
				enhancedCompositeValue: 0.73,
				confidenceScore: 0.85,
				dataQualityScore: 0.9,
				vfrFactorName: "technical",
				enhancementWeight: 0.1,
				enhancementLatencyMs: 200,
				modelsUsed: ["lightgbm_v1"],
				fallbackMode: false,
				validationStatus: "valid",
			};

			const startTime = Date.now();
			await store.storeEnhancement(record);
			const latency = Date.now() - startTime;

			expect(latency).toBeLessThan(100); // <100ms target
		});

		it("should retrieve records quickly", async () => {
			const startTime = Date.now();
			await store.getEnhancements({ ticker: "PERF_TEST", limit: 10 });
			const latency = Date.now() - startTime;

			expect(latency).toBeLessThan(500); // <500ms for retrieval
		});
	});
});
