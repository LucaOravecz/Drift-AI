import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import prisma from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";
import type { InstitutionalRole, SecurityContext } from "@/lib/services/security.service";
import { verifyPassword } from "@/lib/password";

export const SESSION_COOKIE_NAME = "drift_session";
export const MFA_CHALLENGE_COOKIE_NAME = "drift_mfa_challenge";
const SESSION_TTL_DAYS = 14;

export type SessionUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string | null;
  role: string;
  avatarUrl: string | null;
  isActive: boolean;
  mustChangePassword: boolean;
  preferences: {
    timezone: string | null;
    locale: string | null;
    emailNotifications: boolean;
    inAppNotifications: boolean;
    weeklyDigest: boolean;
  } | null;
  organization: {
    id: string;
    name: string;
    settings: {
      brandName: string;
      brandShortName: string;
      productName: string;
      tagline: string;
      logoUrl: string | null;
      accentColor: string;
      supportEmail: string | null;
      notificationsEmail: string | null;
    } | null;
  };
};

export type ActiveSession = {
  id: string;
  token: string;
  expiresAt: Date;
  lastSeenAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  user: SessionUser;
};

export async function setSessionCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function setMfaChallengeCookie(token: string, expiresAt: Date) {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export async function clearMfaChallengeCookie() {
  const store = await cookies();
  store.delete(MFA_CHALLENGE_COOKIE_NAME);
}

async function getRequestMetadata() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || requestHeaders.get("x-real-ip") || null;
  const userAgent = requestHeaders.get("user-agent");

  return {
    ipAddress,
    userAgent,
  };
}

async function createPersistedSession(userId: string, expiresAt: Date) {
  const token = randomUUID();
  const metadata = await getRequestMetadata();

  const session = await prisma.userSession.create({
    data: {
      userId,
      token,
      expiresAt,
      userAgent: metadata.userAgent,
      ipAddress: metadata.ipAddress,
    },
  });

  return { session, token, expiresAt };
}

export async function createSessionForUser(userId: string) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { session, token } = await createPersistedSession(userId, expiresAt);
  return { session, token, expiresAt };
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.userSession.findUnique({
    where: { token },
    include: {
      user: {
        include: {
          preferences: true,
          organization: {
            include: {
              settings: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    // Session not found - don't clear cookie here (happens in Server Component)
    return null;
  }

  if (!session.user.isActive) {
    // User is inactive - cleanup happens asynchronously, don't block
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  if (session.expiresAt <= new Date()) {
    // Session expired - cleanup happens asynchronously, don't block
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }

  await prisma.userSession.update({
    where: { id: session.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => null);

  return session;
}

export async function requireActiveSession() {
  const session = await getActiveSession();
  if (!session) {
    redirect("/sign-in");
  }
  return session;
}

export async function getSecurityContextFromSession(): Promise<SecurityContext | null> {
  const session = await getActiveSession();
  if (!session) return null;

  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.role as InstitutionalRole,
  };
}

export async function signInWithPassword(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      organization: true,
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { success: false as const, error: "Invalid email or password." };
  }

  if (!user.isActive) {
    return { success: false as const, error: "This account is inactive. Contact your firm administrator." };
  }

  if (user.mfaEnabled && user.mfaSecret) {
    const challengeToken = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.pendingLoginChallenge.create({
      data: {
        userId: user.id,
        token: challengeToken,
        expiresAt,
      },
    });

    return { success: true as const, mustChangePassword: false, requiresMfa: true, mfaChallengeToken: challengeToken, mfaChallengeExpiresAt: expiresAt };
  }

  const { session, token, expiresAt } = await createSessionForUser(user.id);

  await AuditService.logAction({
    organizationId: user.organizationId,
    userId: user.id,
    action: "USER_SIGNED_IN",
    target: `User:${user.id}`,
    details: `User ${user.email} signed in.`,
    severity: "INFO",
  });

  await prisma.notification.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      type: "SYSTEM",
      title: "Session started",
      body: `Signed in on ${new Date().toLocaleString()}.`,
      link: "/account",
      metadata: JSON.stringify({ sessionId: session.id }),
    },
  }).catch(() => null);

  return { success: true as const, mustChangePassword: user.mustChangePassword, requiresMfa: false, sessionToken: token, sessionExpiresAt: expiresAt };
}

export async function completeMfaChallenge(code: string) {
  const challengeToken = (await cookies()).get(MFA_CHALLENGE_COOKIE_NAME)?.value;
  if (!challengeToken) {
    return { success: false as const, error: "MFA verification session not found." };
  }

  const challenge = await prisma.pendingLoginChallenge.findUnique({
    where: { token: challengeToken },
    include: { user: true },
  });

  if (!challenge || challenge.expiresAt <= new Date()) {
    if (challenge) {
      await prisma.pendingLoginChallenge.delete({ where: { id: challenge.id } }).catch(() => null);
    }
    return { success: false as const, error: "MFA verification expired. Sign in again.", shouldClearCookie: true };
  }

  return { success: true as const, challenge };
}

export async function signOutActiveSession() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return { shouldClearCookies: false };

  const session = await prisma.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (session) {
    await prisma.userSession.delete({ where: { id: session.id } }).catch(() => null);
    await AuditService.logAction({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      action: "USER_SIGNED_OUT",
      target: `User:${session.user.id}`,
      details: `User ${session.user.email} signed out.`,
      severity: "INFO",
    });
  }

  return { shouldClearCookies: true };
}
