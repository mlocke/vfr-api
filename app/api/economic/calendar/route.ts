/**
 * Economic Calendar API Route
 * Provides real upcoming economic events using comprehensive data sources
 */

import { NextRequest, NextResponse } from "next/server";
import { EconomicCalendarService } from "../../../services/financial-data/EconomicCalendarService";
import ErrorHandler from "../../../services/error-handling/ErrorHandler";

interface EconomicEvent {
	id: string;
	title: string;
	time: string;
	impact: "high" | "medium" | "low";
	actual?: string;
	forecast?: string;
	previous?: string;
	description: string;
	category: string;
}

const economicCalendarService = new EconomicCalendarService();

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const timeframe = searchParams.get("timeframe") || "today";

		// Validate timeframe parameter
		if (!["today", "week", "month"].includes(timeframe)) {
			return NextResponse.json(
				{
					error: "Invalid timeframe",
					message: "Timeframe must be one of: today, week, month",
					timestamp: new Date().toISOString(),
				},
				{ status: 400 }
			);
		}

		// Get real economic events using the new service
		const calendarData = await economicCalendarService.getEconomicEvents(
			timeframe as "today" | "week" | "month"
		);

		// Dynamic cache control based on timeframe and upcoming events
		const hasUpcomingEvents = calendarData.events.some(event => {
			const eventTime = new Date(event.time).getTime();
			const now24h = Date.now() + 24 * 60 * 60 * 1000;
			return eventTime <= now24h;
		});

		// Shorter cache for time-sensitive data
		const maxAge = hasUpcomingEvents ? 120 : timeframe === "today" ? 300 : 600; // 2-10 minutes
		const staleWhileRevalidate = hasUpcomingEvents ? 30 : 60; // 30-60 seconds

		return NextResponse.json(calendarData, {
			status: 200,
			headers: {
				"Cache-Control": `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
				"Content-Type": "application/json",
				"X-Cache-Strategy": hasUpcomingEvents ? "fast-refresh" : "standard",
			},
		});
	} catch (error) {
		console.error("EconomicCalendarAPI.GET error:", error);

		// Use centralized error handling
		const errorResponse = ErrorHandler.normalizeError(error);

		return NextResponse.json(
			{
				error: "Failed to retrieve economic calendar",
				message: "Unable to fetch economic events. Please try again later.",
				timestamp: new Date().toISOString(),
				details: errorResponse,
			},
			{ status: 500 }
		);
	}
}

export async function OPTIONS(request: NextRequest) {
	return new NextResponse(null, {
		status: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}
