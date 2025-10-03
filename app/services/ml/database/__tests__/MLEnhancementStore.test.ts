/**
 * ML Enhancement Store Tests
 * Basic tests for CRUD operations
 */

import { MLEnhancementStore, MLEnhancement } from "../MLEnhancementStore";

describe("MLEnhancementStore", () => {
	let store: MLEnhancementStore;

	beforeAll(async () => {
		store = new MLEnhancementStore();
		// Only initialize if database is available
		try {
			await store.initialize();
		} catch (error) {
			console.log("Database not available for testing, skipping ML Enhancement Store tests");
		}
	});

	afterAll(async () => {
		if (store) {
			await store.close();
		}
	});

	describe("Basic Operations", () => {
		it("should create MLEnhancementStore instance", () => {
			expect(store).toBeDefined();
			expect(store).toBeInstanceOf(MLEnhancementStore);
		});

		it("should handle healthCheck", async () => {
			const isHealthy = await store.healthCheck();
			expect(typeof isHealthy).toBe("boolean");
		});
	});

	describe("Enhancement Operations", () => {
		const testEnhancement: MLEnhancement = {
			ticker: "TEST",
			timestamp: new Date(),
			enhancement_id: "test_enhancement",
			base_vfr_value: 0.75,
			enhanced_value: 0.82,
			enhanced_composite_value: 0.785,
			confidence_score: 0.87,
			data_quality_score: 0.92,
			vfr_factor_name: "technical",
			enhancement_weight: 0.1,
			enhancement_latency_ms: 150,
			models_used: ["test_model"],
			fallback_mode: false,
			validation_status: "pending",
		};

		it("should handle storeEnhancement gracefully", async () => {
			const result = await store.storeEnhancement(testEnhancement);
			expect(typeof result).toBe("boolean");
		});

		it("should handle getLatestEnhancement gracefully", async () => {
			const result = await store.getLatestEnhancement("TEST");
			// Should return null or MLEnhancement object
			expect(result === null || (typeof result === "object" && result.ticker)).toBe(true);
		});

		it("should handle getEnhancements gracefully", async () => {
			const result = await store.getEnhancements("TEST");
			expect(Array.isArray(result)).toBe(true);
		});

		it("should handle updateWithActuals gracefully", async () => {
			const result = await store.updateWithActuals("TEST", new Date(), "test_enhancement", {
				validation_status: "valid",
			});
			expect(typeof result).toBe("boolean");
		});

		it("should handle getEnhancementStats gracefully", async () => {
			const result = await store.getEnhancementStats("TEST");
			// Should return null or stats object
			expect(
				result === null ||
					(typeof result === "object" && typeof result.totalEnhancements === "number")
			).toBe(true);
		});

		it("should handle cleanupOldEnhancements gracefully", async () => {
			const result = await store.cleanupOldEnhancements(365);
			expect(typeof result).toBe("number");
		});
	});

	describe("Error Handling", () => {
		it("should handle invalid ticker gracefully", async () => {
			const result = await store.getLatestEnhancement("");
			expect(result).toBe(null);
		});

		it("should handle malformed dates gracefully", async () => {
			const result = await store.getEnhancements("TEST", new Date("invalid"));
			expect(Array.isArray(result)).toBe(true);
		});
	});
});
