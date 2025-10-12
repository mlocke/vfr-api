/**
 * Progress tracking utilities for SSE connections
 * Separated from route.ts to avoid Next.js route handler conflicts
 */

// Global map to store active progress trackers by session ID
export const progressSessions = new Map<
	string,
	{
		encoder: TextEncoder;
		controller: ReadableStreamDefaultController;
		active: boolean;
	}
>();

/**
 * Utility function to send progress update to a specific session
 */
export function sendProgressUpdate(sessionId: string, update: any): boolean {
	const session = progressSessions.get(sessionId);
	if (!session || !session.active) {
		return false;
	}

	try {
		const message = `data: ${JSON.stringify(update)}\n\n`;
		session.controller.enqueue(session.encoder.encode(message));
		return true;
	} catch (error) {
		console.error(`Failed to send progress update to ${sessionId}:`, error);
		session.active = false;
		progressSessions.delete(sessionId);
		return false;
	}
}

/**
 * Close SSE connection for a session
 */
export function closeProgressSession(sessionId: string) {
	const session = progressSessions.get(sessionId);
	if (session && session.active) {
		try {
			// Send completion message
			const completeMessage = `data: ${JSON.stringify({
				stage: "complete",
				message: "Analysis complete - closing connection",
				progress: 100,
				timestamp: Date.now(),
			})}\n\n`;
			session.controller.enqueue(session.encoder.encode(completeMessage));

			// Close the stream
			session.controller.close();
		} catch (error) {
			console.error(`Error closing session ${sessionId}:`, error);
		}

		session.active = false;
		progressSessions.delete(sessionId);
		console.log(`🔒 SSE session ${sessionId} closed`);
	}
}
