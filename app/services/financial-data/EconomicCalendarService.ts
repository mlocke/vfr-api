/**
 * Economic Calendar Service
 * Provides real upcoming economic events using FRED API and public data sources
 */

import { FREDAPI } from "./FREDAPI";
import { EconomicForecastService } from "./EconomicForecastService";

export interface EconomicEvent {
	id: string;
	title: string;
	time: string;
	impact: "high" | "medium" | "low";
	actual?: string;
	forecast?: string;
	previous?: string;
	description: string;
	category: string;
	country: string;
	source: string;
}

export interface EconomicCalendarData {
	events: EconomicEvent[];
	timeframe: string;
	lastUpdate: string;
	source: string;
}

export class EconomicCalendarService {
	private fredAPI: FREDAPI;
	private forecastService: EconomicForecastService;
	private cache: Map<string, { data: EconomicEvent[]; timestamp: number; ttl: number }> =
		new Map();

	// Static FOMC meeting dates (official Fed schedule 2024-2026)
	private static readonly FOMC_MEETINGS = [
		// 2024 remaining meetings
		{ date: "2024-12-17", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2024-12-18", time: "14:30", title: "Federal Reserve Press Conference" },

		// 2025 meetings (verified from Fed research - September meeting already occurred)
		{ date: "2025-01-28", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-01-29", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-03-18", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-03-19", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-04-29", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-04-30", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-06-10", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-06-11", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-07-29", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-07-30", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-09-16", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-09-17", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-10-28", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-10-29", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2025-12-09", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2025-12-10", time: "14:30", title: "Federal Reserve Press Conference" },

		// 2026 meetings
		{ date: "2026-01-27", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-01-28", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-03-17", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-03-18", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-04-28", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-04-29", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-06-16", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-06-17", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-07-28", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-07-29", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-09-15", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-09-16", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-10-27", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-10-28", time: "14:30", title: "Federal Reserve Press Conference" },
		{ date: "2026-12-08", time: "14:00", title: "FOMC Meeting Decision" },
		{ date: "2026-12-09", time: "14:30", title: "Federal Reserve Press Conference" },
	];

	// Key recurring economic events (based on typical BLS/Census schedules)
	private static readonly RECURRING_EVENTS = [
		// CPI - Monthly, around 12th-15th of each month at 8:30 AM ET
		{
			title: "Consumer Price Index (CPI)",
			category: "Inflation",
			impact: "high" as const,
			description:
				"Monthly measure of inflation based on a basket of consumer goods and services",
			time: "08:30",
			schedule: "monthly", // Around 12th-15th of each month
			dayRange: [12, 15],
		},

		// Employment Report - First Friday of each month at 8:30 AM ET
		{
			title: "Non-Farm Payrolls",
			category: "Employment",
			impact: "high" as const,
			description: "Monthly change in the number of employed people, excluding farm workers",
			time: "08:30",
			schedule: "first_friday",
		},

		// Unemployment Rate - Same as NFP
		{
			title: "Unemployment Rate",
			category: "Employment",
			impact: "high" as const,
			description:
				"Percentage of the labor force that is unemployed and actively seeking employment",
			time: "08:30",
			schedule: "first_friday",
		},

		// Initial Jobless Claims - Every Thursday at 8:30 AM ET
		{
			title: "Initial Jobless Claims",
			category: "Employment",
			impact: "medium" as const,
			description: "Weekly measure of new unemployment insurance claims",
			time: "08:30",
			schedule: "weekly_thursday",
		},

		// GDP - Quarterly, roughly 30 days after quarter end
		{
			title: "Gross Domestic Product (GDP)",
			category: "Growth",
			impact: "high" as const,
			description: "Quarterly measure of economic output and growth",
			time: "08:30",
			schedule: "quarterly",
		},

		// Retail Sales - Mid-month around 13th-17th at 8:30 AM ET
		{
			title: "Retail Sales",
			category: "Consumer",
			impact: "medium" as const,
			description: "Monthly measure of consumer spending at retail establishments",
			time: "08:30",
			schedule: "monthly",
			dayRange: [13, 17],
		},

		// Producer Price Index - Mid-month around 11th-15th at 8:30 AM ET
		{
			title: "Producer Price Index (PPI)",
			category: "Inflation",
			impact: "medium" as const,
			description: "Monthly measure of wholesale price changes",
			time: "08:30",
			schedule: "monthly",
			dayRange: [11, 15],
		},

		// Industrial Production - Mid-month around 15th-17th at 9:15 AM ET
		{
			title: "Industrial Production",
			category: "Manufacturing",
			impact: "medium" as const,
			description: "Monthly measure of manufacturing, mining, and utilities output",
			time: "09:15",
			schedule: "monthly",
			dayRange: [15, 17],
		},

		// Housing Starts - Mid-month around 16th-20th at 8:30 AM ET
		{
			title: "Housing Starts",
			category: "Housing",
			impact: "medium" as const,
			description: "Monthly measure of new residential construction",
			time: "08:30",
			schedule: "monthly",
			dayRange: [16, 20],
		},

		// Consumer Confidence - Last Tuesday of each month at 10:00 AM ET
		{
			title: "Consumer Confidence",
			category: "Consumer",
			impact: "medium" as const,
			description: "Monthly measure of consumer sentiment and spending expectations",
			time: "10:00",
			schedule: "last_tuesday",
		},
	];

	constructor() {
		this.fredAPI = new FREDAPI();
		this.forecastService = new EconomicForecastService();
	}

	/**
	 * Smart cache TTL based on data type and proximity to events
	 */
	private getCacheTTL(timeframe: string, hasUpcomingEvents: boolean): number {
		const now = new Date();
		const currentHour = now.getHours();

		// Shorter cache during market hours (9 AM - 4 PM ET = 13-20 UTC)
		const isMarketHours = currentHour >= 13 && currentHour <= 20;

		// Shorter cache if we have events in next 24 hours
		if (hasUpcomingEvents) {
			return isMarketHours ? 2 * 60 * 1000 : 5 * 60 * 1000; // 2-5 minutes
		}

		// Normal cache times
		switch (timeframe) {
			case "today":
				return 5 * 60 * 1000; // 5 minutes
			case "week":
				return 15 * 60 * 1000; // 15 minutes
			case "month":
				return 30 * 60 * 1000; // 30 minutes
			default:
				return 5 * 60 * 1000;
		}
	}

	/**
	 * Check if cache is valid
	 */
	private isCacheValid(cacheKey: string): boolean {
		const cached = this.cache.get(cacheKey);
		if (!cached) return false;

		const now = Date.now();
		return now - cached.timestamp < cached.ttl;
	}

	/**
	 * Clear expired cache entries
	 */
	private cleanExpiredCache(): void {
		const now = Date.now();
		for (const [key, value] of this.cache.entries()) {
			if (now - value.timestamp >= value.ttl) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Force clear all cached data (for schedule changes)
	 */
	public invalidateCache(): void {
		this.cache.clear();
		console.log("Economic Calendar cache invalidated due to schedule changes");
	}

	/**
	 * Force clear specific timeframe cache
	 */
	public invalidateTimeframe(timeframe: "today" | "week" | "month"): void {
		const cacheKey = `events-${timeframe}`;
		this.cache.delete(cacheKey);
		console.log(`Economic Calendar cache invalidated for timeframe: ${timeframe}`);
	}

	/**
	 * Get economic events for specified timeframe
	 */
	async getEconomicEvents(timeframe: "today" | "week" | "month"): Promise<EconomicCalendarData> {
		try {
			// Clean expired cache entries
			this.cleanExpiredCache();

			// Check cache first
			const cacheKey = `events-${timeframe}`;
			if (this.isCacheValid(cacheKey)) {
				const cached = this.cache.get(cacheKey)!;
				return {
					events: cached.data,
					timeframe,
					lastUpdate: new Date(cached.timestamp).toISOString(),
					source: "Multiple sources (Fed, BLS, Census, FRED API) - Cached",
				};
			}

			const now = new Date();
			const events: EconomicEvent[] = [];

			// Get timeframe bounds
			const { startDate, endDate } = this.getTimeframeBounds(timeframe, now);

			// Get FOMC meetings in timeframe
			const fomcEvents = this.getFOMCEvents(startDate, endDate);
			events.push(...fomcEvents);

			// Get recurring economic events
			const recurringEvents = await this.getRecurringEvents(startDate, endDate);
			events.push(...recurringEvents);

			// Try to get actual FRED release dates for major events
			const fredEvents = await this.getFREDReleaseEvents(startDate, endDate);
			events.push(...fredEvents);

			// Remove duplicates based on title and date
			const uniqueEvents = events.filter((event, index, arr) => {
				const eventDate = new Date(event.time).toISOString().split("T")[0];
				return (
					index ===
					arr.findIndex(
						e =>
							e.title === event.title &&
							new Date(e.time).toISOString().split("T")[0] === eventDate
					)
				);
			});

			// Sort events by date and time
			uniqueEvents.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

			// Check if we have events in next 24 hours for smart caching
			const hasUpcomingEvents = uniqueEvents.some(event => {
				const eventTime = new Date(event.time).getTime();
				const now24h = now.getTime() + 24 * 60 * 60 * 1000;
				return eventTime <= now24h;
			});

			// Cache the results with smart TTL
			const ttl = this.getCacheTTL(timeframe, hasUpcomingEvents);
			this.cache.set(cacheKey, {
				data: uniqueEvents,
				timestamp: Date.now(),
				ttl,
			});

			return {
				events: uniqueEvents,
				timeframe,
				lastUpdate: new Date().toISOString(),
				source: "Multiple sources (Fed, BLS, Census, FRED API)",
			};
		} catch (error) {
			console.error("EconomicCalendarService error:", error);

			// Return minimal fallback data
			return {
				events: [],
				timeframe,
				lastUpdate: new Date().toISOString(),
				source: "Error retrieving events",
			};
		}
	}

	/**
	 * Get timeframe date bounds
	 */
	private getTimeframeBounds(timeframe: "today" | "week" | "month", now: Date) {
		// Always start from current time to exclude past events
		const startDate = new Date(now);
		let endDate = new Date(now);

		switch (timeframe) {
			case "today":
				// For today: from now until end of today
				endDate.setHours(23, 59, 59, 999);
				break;
			case "week":
				// For week: from now until 7 days from now
				endDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
				endDate.setHours(23, 59, 59, 999);
				break;
			case "month":
				// For month: from now until 45 days from now (to catch next FOMC meetings)
				endDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);
				endDate.setHours(23, 59, 59, 999);
				break;
		}

		return { startDate, endDate };
	}

	/**
	 * Get FOMC meeting events in date range
	 */
	private getFOMCEvents(startDate: Date, endDate: Date): EconomicEvent[] {
		const events: EconomicEvent[] = [];

		for (const meeting of EconomicCalendarService.FOMC_MEETINGS) {
			const meetingDate = new Date(`${meeting.date}T${meeting.time}:00.000Z`);

			if (meetingDate >= startDate && meetingDate <= endDate) {
				events.push({
					id: `fomc-${meeting.date}-${meeting.time}`,
					title: meeting.title,
					time: meetingDate.toISOString(),
					impact: "high",
					description:
						"Federal Open Market Committee meeting where interest rate decisions are made",
					category: "Monetary Policy",
					country: "US",
					source: "Federal Reserve",
				});
			}
		}
		return events;
	}

	/**
	 * Get recurring economic events in date range
	 */
	private async getRecurringEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
		const events: EconomicEvent[] = [];

		for (const eventTemplate of EconomicCalendarService.RECURRING_EVENTS) {
			const eventDates = this.calculateEventDates(eventTemplate, startDate, endDate);

			for (const eventDate of eventDates) {
				// Get real forecast and previous values
				const forecast = await this.forecastService.getForecast(eventTemplate.title);
				const previous = await this.fredAPI.getEconomicPreviousValue(eventTemplate.title);

				events.push({
					id: `recurring-${eventTemplate.title.toLowerCase().replace(/\s+/g, "-")}-${eventDate.toISOString().split("T")[0]}`,
					title: eventTemplate.title,
					time: eventDate.toISOString(),
					impact: eventTemplate.impact,
					description: eventTemplate.description,
					category: eventTemplate.category,
					country: "US",
					source: "BLS/Census Schedule",
					forecast: forecast || "TBD",
					previous: previous || "TBD",
				});
			}
		}

		return events;
	}

	/**
	 * Calculate specific dates for recurring events
	 */
	private calculateEventDates(eventTemplate: any, startDate: Date, endDate: Date): Date[] {
		const dates: Date[] = [];

		// For monthly events, iterate month by month
		if (
			eventTemplate.schedule === "monthly" ||
			eventTemplate.schedule === "first_friday" ||
			eventTemplate.schedule === "last_tuesday" ||
			eventTemplate.schedule === "quarterly"
		) {
			const currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
			const endMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0);

			while (currentMonth <= endMonth) {
				let eventDate: Date | null = null;

				switch (eventTemplate.schedule) {
					case "monthly":
						if (eventTemplate.dayRange) {
							// Find date within day range for current month
							for (
								let day = eventTemplate.dayRange[0];
								day <= eventTemplate.dayRange[1];
								day++
							) {
								const testDate = new Date(
									currentMonth.getFullYear(),
									currentMonth.getMonth(),
									day
								);
								if (
									testDate >= startDate &&
									testDate <= endDate &&
									this.isWeekday(testDate)
								) {
									eventDate = testDate;
									break;
								}
							}
						}
						break;

					case "first_friday":
						eventDate = this.getFirstFridayOfMonth(currentMonth);
						break;

					case "last_tuesday":
						eventDate = this.getLastTuesdayOfMonth(currentMonth);
						break;

					case "quarterly":
						// GDP releases are typically 30 days after quarter end
						const month = currentMonth.getMonth();
						const isGDPReleaseMonth =
							month === 3 || month === 6 || month === 9 || month === 0; // Apr, Jul, Oct, Jan
						if (isGDPReleaseMonth) {
							// Set to end of month for GDP releases
							eventDate = new Date(currentMonth.getFullYear(), month, 28);
							while (!this.isWeekday(eventDate) && eventDate.getDate() > 25) {
								eventDate.setDate(eventDate.getDate() - 1);
							}
						}
						break;
				}

				if (eventDate && eventDate >= startDate && eventDate <= endDate) {
					// Set the time
					const [hours, minutes] = eventTemplate.time.split(":");
					eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
					dates.push(new Date(eventDate));
				}

				// Move to next month
				currentMonth.setMonth(currentMonth.getMonth() + 1);
			}
		} else if (eventTemplate.schedule === "weekly_thursday") {
			// For weekly events, iterate day by day
			const current = new Date(startDate);

			while (current <= endDate) {
				if (current.getDay() === 4) {
					// Thursday
					const eventDate = new Date(current);
					const [hours, minutes] = eventTemplate.time.split(":");
					eventDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
					dates.push(eventDate);
				}
				// Move to next day
				current.setDate(current.getDate() + 1);
			}
		}

		return dates;
	}

	/**
	 * Get FRED release events (this would use real FRED releases API)
	 */
	private async getFREDReleaseEvents(startDate: Date, endDate: Date): Promise<EconomicEvent[]> {
		try {
			// For now, return empty array since FRED releases API requires specific implementation
			// In a full implementation, this would call:
			// - FRED releases/dates API to get actual release schedules
			// - Parse the response to extract relevant events
			return [];
		} catch (error) {
			console.error("Error fetching FRED release events:", error);
			return [];
		}
	}

	/**
	 * Utility functions for date calculations
	 */
	private isWeekday(date: Date): boolean {
		const day = date.getDay();
		return day >= 1 && day <= 5; // Monday to Friday
	}

	private getFirstFridayOfMonth(date: Date): Date {
		const year = date.getFullYear();
		const month = date.getMonth();
		const firstDay = new Date(year, month, 1);

		// Find first Friday
		let dayOfWeek = firstDay.getDay();
		let firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
		if (dayOfWeek === 0) firstFriday = 6; // If first day is Sunday

		return new Date(year, month, firstFriday);
	}

	private getLastTuesdayOfMonth(date: Date): Date {
		const year = date.getFullYear();
		const month = date.getMonth();
		const lastDay = new Date(year, month + 1, 0); // Last day of month

		// Find last Tuesday
		let dayOfWeek = lastDay.getDay();
		let lastTuesday = lastDay.getDate() - ((dayOfWeek + 5) % 7);

		return new Date(year, month, lastTuesday);
	}

	private isQuarterEndMonth(date: Date): boolean {
		const month = date.getMonth();
		return month === 2 || month === 5 || month === 8 || month === 11; // Mar, Jun, Sep, Dec
	}
}
