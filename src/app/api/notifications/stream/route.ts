import { getActiveSession } from "@/lib/auth";
import { SSENotificationService } from "@/lib/services/sse-notification.service";

/**
 * SSE Notification Stream Endpoint
 *
 * GET /api/notifications/stream
 *
 * Returns a Server-Sent Events stream that pushes real-time notifications
 * to the authenticated user's browser.
 */
export async function GET() {
  const session = await getActiveSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const stream = SSENotificationService.createStream(
    session.user.id,
    session.user.organizationId,
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}
