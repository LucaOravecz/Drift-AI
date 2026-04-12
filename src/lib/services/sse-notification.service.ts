import "server-only";

import prisma from "@/lib/db";

/**
 * Server-Sent Events (SSE) Notification Service
 *
 * Provides real-time notification delivery to connected clients.
 * Uses an in-memory connection map (upgradeable to Redis pub/sub for multi-instance).
 *
 * The SSE endpoint is at /api/notifications/stream
 */

// ---------------------------------------------------------------------------
// Connection management
// ---------------------------------------------------------------------------

interface SSEConnection {
  userId: string;
  organizationId: string;
  encoder: TextEncoder;
  controller: ReadableStreamDefaultController;
  connectedAt: Date;
}

const connections = new Map<string, SSEConnection[]>();

function addConnection(userId: string, conn: SSEConnection) {
  const existing = connections.get(userId) ?? [];
  connections.set(userId, [...existing, conn]);
}

function removeConnection(userId: string, controller: ReadableStreamDefaultController) {
  const existing = connections.get(userId) ?? [];
  connections.set(
    userId,
    existing.filter((c) => c.controller !== controller),
  );
  if (connections.get(userId)?.length === 0) {
    connections.delete(userId);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class SSENotificationService {
  /**
   * Create a new SSE stream for a user.
   * Returns a ReadableStream suitable for a Next.js Response.
   */
  static createStream(userId: string, organizationId: string): ReadableStream {
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const conn: SSEConnection = {
          userId,
          organizationId,
          encoder,
          controller,
          connectedAt: new Date(),
        };

        addConnection(userId, conn);

        // Send initial connection event
        controller.enqueue(
          encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`),
        );

        // Send any unread notifications as initial batch
        prisma.notification
          .findMany({
            where: { userId, status: "UNREAD" },
            orderBy: { createdAt: "desc" },
            take: 20,
          })
          .then((unread) => {
            if (unread.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `event: notifications\ndata: ${JSON.stringify(unread)}\n\n`,
                ),
              );
            }
          })
          .catch(() => {});

        // Heartbeat every 30 seconds to keep connection alive
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`event: heartbeat\ndata: {}\n\n`));
          } catch {
            clearInterval(heartbeat);
          }
        }, 30_000);

        // Cleanup on close
        controller.enqueue?.(
          encoder.encode(`event: heartbeat\ndata: {}\n\n`),
        );
      },
      cancel(controller) {
        removeConnection(userId, controller);
      },
    });

    return stream;
  }

  /**
   * Push a notification to all connected sessions for a user.
   */
  static pushToUser(userId: string, event: {
    type: string;
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }) {
    const userConnections = connections.get(userId) ?? [];
    const data = JSON.stringify(event);

    for (const conn of userConnections) {
      try {
        conn.controller.enqueue(
          conn.encoder.encode(`event: notification\ndata: ${data}\n\n`),
        );
      } catch {
        // Connection may have closed — will be cleaned up on next heartbeat
      }
    }
  }

  /**
   * Push a notification to all users in an organization.
   */
  static async pushToOrganization(organizationId: string, event: {
    type: string;
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Get all active users in the org
    const users = await prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true },
    });

    for (const user of users) {
      this.pushToUser(user.id, event);
    }
  }

  /**
   * Create a notification in the database AND push it via SSE.
   */
  static async createAndPush(params: {
    organizationId: string;
    userId?: string;
    type: string;
    title: string;
    body: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }) {
    // Persist to database
    const notification = await prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        metadata: params.metadata ?? undefined as any,
      },
    });

    // Push via SSE
    if (params.userId) {
      this.pushToUser(params.userId, {
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        metadata: params.metadata,
      });
    } else {
      await this.pushToOrganization(params.organizationId, {
        type: params.type,
        title: params.title,
        body: params.body,
        link: params.link,
        metadata: params.metadata,
      });
    }

    return notification;
  }

  /**
   * Get count of currently connected users (for monitoring).
   */
  static getConnectionStats() {
    let totalConnections = 0;
    const byOrg: Record<string, number> = {};

    for (const [, conns] of connections.entries()) {
      totalConnections += conns.length;
      for (const conn of conns) {
        byOrg[conn.organizationId] = (byOrg[conn.organizationId] ?? 0) + 1;
      }
    }

    return { totalConnections, uniqueUsers: connections.size, byOrg };
  }
}
