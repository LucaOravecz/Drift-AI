import "server-only";

import prisma from "@/lib/db";
import { BRAND, type BrandingSnapshot } from "@/lib/brand-config";

export function defaultBranding(): BrandingSnapshot {
  return {
    wordmark: BRAND.wordmark,
    shortName: BRAND.shortName,
    productName: BRAND.productName,
    tagline: BRAND.tagline,
    logoImagePath: BRAND.logoImagePath,
    iconFallbackText: BRAND.iconFallbackText,
    iconColorClass: BRAND.iconColorClass,
    iconTextColorClass: BRAND.iconTextColorClass,
    accentColor: BRAND.accentColor,
    supportEmail: null,
    notificationsEmail: null,
  };
}

export async function getBranding(organizationId?: string | null): Promise<BrandingSnapshot> {
  const fallback = defaultBranding();
  if (!organizationId) return fallback;

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
  });

  if (!settings) return fallback;

  return {
    ...fallback,
    wordmark: settings.brandName,
    shortName: settings.brandShortName,
    productName: settings.productName,
    tagline: settings.tagline,
    logoImagePath: settings.logoUrl,
    iconFallbackText: settings.brandShortName.slice(0, 2).toUpperCase() || fallback.iconFallbackText,
    accentColor: settings.accentColor,
    supportEmail: settings.supportEmail,
    notificationsEmail: settings.notificationsEmail,
  };
}

export async function getNotificationsForUser(userId: string, limit = 8) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notification.count({
    where: { userId, status: "UNREAD" },
  });
}

export async function getHeaderSummary(organizationId: string, userId: string) {
  const [clientCount, upcomingMeetingCount, pendingVaultCount, unreadNotificationCount, activeSessionCount] = await Promise.all([
    prisma.client.count({
      where: { organizationId },
    }),
    prisma.meeting.count({
      where: {
        client: { organizationId },
        status: "SCHEDULED",
        scheduledAt: { gte: new Date() },
      },
    }),
    prisma.document.count({
      where: {
        client: { organizationId },
        status: { in: ["UPLOADED", "QUEUED", "PROCESSING"] },
      },
    }),
    getUnreadNotificationCount(userId),
    prisma.userSession.count({
      where: { userId },
    }),
  ]);

  return {
    clientCount,
    upcomingMeetingCount,
    pendingVaultCount,
    unreadNotificationCount,
    activeSessionCount,
  };
}
