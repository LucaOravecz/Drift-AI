import "server-only";

import { getActiveSession } from "@/lib/auth";
import { authenticateApiRequest } from "@/lib/middleware/api-auth";
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
  const auth = await authenticateApiRequest();
  if (!auth.authenticated || !auth.context) {
    return new Response("Unauthorized", { status: auth.statusCode ?? 401 });
  }

  const session = await getActiveSession();
  if (!session || session.user.id !== auth.context.userId) {
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
