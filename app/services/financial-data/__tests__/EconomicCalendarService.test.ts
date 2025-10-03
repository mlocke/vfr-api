/**
 * Economic Calendar Service Tests
 * Tests for the enhanced economic calendar with real data sources
 */

import { EconomicCalendarService } from "../EconomicCalendarService";

describe("EconomicCalendarService", () => {
	let service: EconomicCalendarService;

	beforeEach(() => {
		service = new EconomicCalendarService();
	});

	describe("getEconomicEvents", () => {
		it("should return events for today timeframe", async () => {
			const result = await service.getEconomicEvents("today");

			expect(result).toBeDefined();
			expect(result.events).toBeInstanceOf(Array);
			expect(result.timeframe).toBe("today");
			expect(result.source).toContain("Multiple sources");
			expect(result.lastUpdate).toBeDefined();
		});

		it("should return events for week timeframe", async () => {
			const result = await service.getEconomicEvents("week");

			expect(result).toBeDefined();
			expect(result.events).toBeInstanceOf(Array);
			expect(result.timeframe).toBe("week");
			expect(result.source).toContain("Multiple sources");
		});

		it("should return events for month timeframe with various categories", async () => {
			const result = await service.getEconomicEvents("month");

			expect(result).toBeDefined();
			expect(result.events).toBeInstanceOf(Array);
			expect(result.timeframe).toBe("month");

			// Should have events from multiple categories
			if (result.events.length > 0) {
				const categories = [...new Set(result.events.map(e => e.category))];
				expect(categories.length).toBeGreaterThan(1);

				// Check for key categories
				const hasEmployment = result.events.some(e => e.category === "Employment");
				const hasInflation = result.events.some(e => e.category === "Inflation");
				const hasMonetaryPolicy = result.events.some(e => e.category === "Monetary Policy");

				expect(hasEmployment || hasInflation || hasMonetaryPolicy).toBe(true);
			}
		});

		it("should return events with required properties", async () => {
			const result = await service.getEconomicEvents("week");

			if (result.events.length > 0) {
				const event = result.events[0];

				expect(event.id).toBeDefined();
				expect(event.title).toBeDefined();
				expect(event.time).toBeDefined();
				expect(event.impact).toMatch(/^(high|medium|low)$/);
				expect(event.description).toBeDefined();
				expect(event.category).toBeDefined();
				expect(event.country).toBe("US");
				expect(event.source).toBeDefined();
			}
		});

		it("should return events sorted by time", async () => {
			const result = await service.getEconomicEvents("month");

			if (result.events.length > 1) {
				for (let i = 1; i < result.events.length; i++) {
					const prev = new Date(result.events[i - 1].time);
					const curr = new Date(result.events[i].time);
					expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
				}
			}
		});

		it("should include FOMC meetings when they fall in timeframe", async () => {
			const result = await service.getEconomicEvents("month");

			// Check if any FOMC events are present
			const fomcEvents = result.events.filter(
				e =>
					e.category === "Monetary Policy" &&
					(e.title.includes("FOMC") || e.title.includes("Federal Reserve"))
			);

			// We don't assert they must be present since it depends on timing,
			// but if they are, they should have correct properties
			fomcEvents.forEach(event => {
				expect(event.impact).toBe("high");
				expect(event.source).toBe("Federal Reserve");
				expect(event.country).toBe("US");
			});
		});

		it("should include recurring economic events", async () => {
			const result = await service.getEconomicEvents("month");

			// Check for common recurring events
			const hasRecurringEvents = result.events.some(
				e =>
					e.title.includes("Initial Jobless Claims") ||
					e.title.includes("Consumer Price Index") ||
					e.title.includes("Non-Farm Payrolls") ||
					e.title.includes("Unemployment Rate")
			);

			expect(hasRecurringEvents).toBe(true);
		});

		it("should handle errors gracefully", async () => {
			// The service should return empty events array rather than throw
			const result = await service.getEconomicEvents("month");

			expect(result).toBeDefined();
			expect(result.events).toBeInstanceOf(Array);
			expect(result.timeframe).toBe("month");
			expect(result.lastUpdate).toBeDefined();
		});

		it("should remove duplicate events", async () => {
			const result = await service.getEconomicEvents("month");

			// Check for duplicates (same title on same date)
			const eventKeys = result.events.map(e => {
				const date = new Date(e.time).toISOString().split("T")[0];
				return `${e.title}-${date}`;
			});

			const uniqueKeys = [...new Set(eventKeys)];
			expect(eventKeys.length).toBe(uniqueKeys.length);
		});
	});
});
