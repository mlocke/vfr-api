/**
 * Server-Sent Events (SSE) endpoint for real-time analysis progress tracking
 * Streams progress updates to client during stock analysis
 */

import { NextRequest } from "next/server";
import { progressSessions } from "./progressUtils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * SSE endpoint - GET /api/stocks/analyze/progress/[sessionId]
 */
export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
	const { sessionId } = await params;

	console.log(`📡 SSE connection established for session: ${sessionId}`);

	const encoder = new TextEncoder();

	// Create a readable stream for SSE
	const stream = new ReadableStream({
		start(controller) {
			// Store the controller for this session
			progressSessions.set(sessionId, {
				encoder,
				controller,
				active: true,
			});

			// Send initial connection message
			const initMessage = `data: ${JSON.stringify({
				stage: "connected",
				message: "Progress tracking connected",
				progress: 0,
				timestamp: Date.now(),
			})}\n\n`;

			controller.enqueue(encoder.encode(initMessage));

			console.log(`✅ SSE session ${sessionId} initialized`);
		},

		cancel() {
			console.log(`❌ SSE connection closed for session: ${sessionId}`);
			const session = progressSessions.get(sessionId);
			if (session) {
				session.active = false;
				progressSessions.delete(sessionId);
			}
		},
	});

	// Return SSE response
	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no", // Disable buffering in nginx
		},
	});
}
