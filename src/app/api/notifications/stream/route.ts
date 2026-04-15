import "server-only";

import { authenticateApiRequest, hasPermission } from "@/lib/middleware/api-auth";
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

  if (auth.context.authMethod !== "SESSION" || !auth.context.userId) {
    return new Response("Session required for notification stream", { status: 403 });
  }

  if (!hasPermission(auth.context, "read", "notifications")) {
    return new Response("Forbidden", { status: 403 });
  }

  const stream = SSENotificationService.createStream(
    auth.context.userId,
    auth.context.organizationId,
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
