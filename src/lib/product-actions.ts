"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import prisma from "@/lib/db";
import { AuditService } from "@/lib/services/audit.service";
import { SecurityService } from "@/lib/services/security.service";
import { createPasswordHash } from "@/lib/password";
import { passwordPolicyMessage, validatePasswordPolicy } from "@/lib/password-policy";
import { generateMfaSecret, verifyTotp } from "@/lib/mfa";
import { checkRateLimit, recordLoginAttempt } from "@/lib/rate-limit";
import { IntegrationService } from "@/lib/services/integration.service";
import {
  clearMfaChallengeCookie,
  clearSessionCookie,
  completeMfaChallenge,
  createSessionForUser,
  requireActiveSession,
  getSecurityContextFromSession,
  signInWithPassword,
  signOutActiveSession,
  setSessionCookie,
  setMfaChallengeCookie,
} from "@/lib/auth";
import { randomUUID } from "crypto";

function sanitize(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value.trim() : "";
}

async function createUserNotification(userId: string, organizationId: string, title: string, body: string, link: string) {
  await prisma.notification.create({
    data: {
      userId,
      organizationId,
      type: "SYSTEM",
      title,
      body,
      link,
    },
  });
}

function redirectWithError(path: string, message: string) {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function assertPresent<T>(value: T | null | undefined, path: string, message: string): NonNullable<T> {
  if (value == null) {
    redirectWithError(path, message);
  }

  return value as NonNullable<T>;
}

export async function signInAction(formData: FormData) {
  const email = sanitize(formData.get("email")).toLowerCase();
  const password = sanitize(formData.get("password"));

  if (!email || !password) {
    redirect("/sign-in?error=Email%20and%20password%20are%20required");
  }

  // Check rate limit
  const rateLimit = await checkRateLimit(email);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.remainingMs || 900000) / 60000);
    redirect(`/sign-in?error=${encodeURIComponent(`Too many attempts. Try again in ${minutes} minutes.`)}`);
  }

  const result = await signInWithPassword(email, password);
  
  // Record login attempt
  await recordLoginAttempt(email, result.success);

  if (!result.success) {
    redirect(`/sign-in?error=${encodeURIComponent(result.error)}`);
  }

  if (result.requiresMfa) {
    if (result.mfaChallengeToken && result.mfaChallengeExpiresAt) {
      await setMfaChallengeCookie(result.mfaChallengeToken, result.mfaChallengeExpiresAt);
    }
    redirect("/verify-mfa");
  }

  if (result.sessionToken && result.sessionExpiresAt) {
    await setSessionCookie(result.sessionToken, result.sessionExpiresAt);
  }

  redirect(result.mustChangePassword ? "/reset-password" : "/");
}

export async function signOutAction() {
  const result = await signOutActiveSession();
  if (result.shouldClearCookies) {
    await clearSessionCookie();
    await clearMfaChallengeCookie();
  }
  redirect("/sign-in");
}

export async function verifyMfaAction(formData: FormData) {
  const code = sanitize(formData.get("code"));
  
  // Check MFA rate limit by challenge ID
  const rateLimit = await checkRateLimit(`mfa-${code}`);
  if (!rateLimit.allowed) {
    const minutes = Math.ceil((rateLimit.remainingMs || 900000) / 60000);
    redirect(`/verify-mfa?error=${encodeURIComponent(`Too many attempts. Try again in ${minutes} minutes.`)}`);
  }

  const challengeResult = await completeMfaChallenge(code);
  if (!challengeResult.success) {
    if (challengeResult.shouldClearCookie) {
      await clearMfaChallengeCookie();
    }
    // Record failed MFA attempt
    await recordLoginAttempt(`mfa-${code}`, false);
    redirect(`/verify-mfa?error=${encodeURIComponent(challengeResult.error)}`);
  }

  const { challenge } = challengeResult;
  if (!challenge.user.mfaSecret || !verifyTotp(challenge.user.mfaSecret, code)) {
    // Record failed MFA attempt
    await recordLoginAttempt(`mfa-${code}`, false);
    redirect("/verify-mfa?error=Invalid%20verification%20code");
  }
  
  // Record successful MFA attempt
  await recordLoginAttempt(`mfa-${code}`, true);

  await prisma.pendingLoginChallenge.delete({ where: { id: challenge.id } }).catch(() => null);
  await clearMfaChallengeCookie();

  const sessionResult = await createSessionForUser(challenge.user.id);
  const sessionRecord = sessionResult.session;

  if (sessionResult.token && sessionResult.expiresAt) {
    await setSessionCookie(sessionResult.token, sessionResult.expiresAt);
  }

  await AuditService.logAction({
    organizationId: challenge.user.organizationId,
    userId: challenge.user.id,
    action: "USER_SIGNED_IN",
    target: `User:${challenge.user.id}`,
    details: `User ${challenge.user.email} completed MFA sign-in.`,
    metadata: { sessionId: sessionRecord.id, mfa: true },
    severity: "INFO",
  });

  await prisma.notification.create({
    data: {
      organizationId: challenge.user.organizationId,
      userId: challenge.user.id,
      type: "SYSTEM",
      title: "Session started",
      body: `Signed in with MFA on ${new Date().toLocaleString()}.`,
      link: "/account",
      metadata: JSON.stringify({ sessionId: sessionRecord.id, mfa: true }),
    },
  }).catch(() => null);

  redirect("/");
}

export async function updateAccountAction(formData: FormData) {
  const session = await requireActiveSession();
  const name = sanitize(formData.get("name"));
  const avatarUrl = sanitize(formData.get("avatarUrl")) || null;

  const before = {
    name: session.user.name,
    avatarUrl: session.user.avatarUrl,
  };

  const after = await prisma.user.update({
    where: { id: session.user.id },
    data: { name, avatarUrl },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "ACCOUNT_UPDATED",
    target: `User:${session.user.id}`,
    beforeState: before,
    afterState: { name: after.name, avatarUrl: after.avatarUrl },
    details: "User updated account profile fields.",
    severity: "INFO",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "Account updated",
    "Your account profile changes were saved.",
    "/account"
  );

  revalidatePath("/account");
  revalidatePath("/");
  redirect("/account?saved=1");
}

export async function updateSettingsAction(formData: FormData) {
  const session = await requireActiveSession();

  const brandName = sanitize(formData.get("brandName"));
  const brandShortName = sanitize(formData.get("brandShortName"));
  const productName = sanitize(formData.get("productName"));
  const tagline = sanitize(formData.get("tagline"));
  const logoUrl = sanitize(formData.get("logoUrl")) || null;
  const accentColor = sanitize(formData.get("accentColor")) || "#4f46e5";
  const supportEmail = sanitize(formData.get("supportEmail")) || null;
  const notificationsEmail = sanitize(formData.get("notificationsEmail")) || null;
  const timezone = sanitize(formData.get("timezone")) || null;
  const locale = sanitize(formData.get("locale")) || null;
  const emailNotifications = formData.get("emailNotifications") === "on";
  const inAppNotifications = formData.get("inAppNotifications") === "on";
  const weeklyDigest = formData.get("weeklyDigest") === "on";

  const currentSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  const currentPreferences = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: session.user.organizationId },
    update: {
      brandName,
      brandShortName,
      productName,
      tagline,
      logoUrl,
      accentColor,
      supportEmail,
      notificationsEmail,
    },
    create: {
      organizationId: session.user.organizationId,
      brandName,
      brandShortName,
      productName,
      tagline,
      logoUrl,
      accentColor,
      supportEmail,
      notificationsEmail,
    },
  });

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    update: {
      timezone,
      locale,
      emailNotifications,
      inAppNotifications,
      weeklyDigest,
    },
    create: {
      userId: session.user.id,
      timezone,
      locale,
      emailNotifications,
      inAppNotifications,
      weeklyDigest,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "SETTINGS_UPDATED",
    target: `Organization:${session.user.organizationId}`,
    beforeState: {
      organizationSettings: currentSettings,
      userPreferences: currentPreferences,
    },
    afterState: {
      organizationSettings: {
        brandName,
        brandShortName,
        productName,
        tagline,
        logoUrl,
        accentColor,
        supportEmail,
        notificationsEmail,
      },
      userPreferences: {
        timezone,
        locale,
        emailNotifications,
        inAppNotifications,
        weeklyDigest,
      },
    },
    details: "Branding and user preferences updated from settings page.",
    severity: "INFO",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "Settings saved",
    "Branding and notification preferences were updated.",
    "/settings"
  );

  revalidatePath("/settings");
  revalidatePath("/");
  redirect("/settings?saved=1");
}

export async function updateIntegrationSettingsAction(formData: FormData) {
  const session = await requireActiveSession();
  const appBaseUrl = sanitize(formData.get("appBaseUrl")) || null;
  const emailDeliveryWebhookUrl = sanitize(formData.get("emailDeliveryWebhookUrl")) || null;
  const calendarSyncWebhookUrl = sanitize(formData.get("calendarSyncWebhookUrl")) || null;

  const before = await prisma.organizationSettings.findUnique({
    where: { organizationId: session.user.organizationId },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: session.user.organizationId },
    update: {
      appBaseUrl,
      emailDeliveryWebhookUrl,
      calendarSyncWebhookUrl,
    },
    create: {
      organizationId: session.user.organizationId,
      appBaseUrl,
      emailDeliveryWebhookUrl,
      calendarSyncWebhookUrl,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "INTEGRATION_SETTINGS_UPDATED",
    target: `Organization:${session.user.organizationId}`,
    beforeState: before
      ? {
          appBaseUrl: before.appBaseUrl,
          emailDeliveryWebhookUrl: before.emailDeliveryWebhookUrl,
          calendarSyncWebhookUrl: before.calendarSyncWebhookUrl,
        }
      : null,
    afterState: {
      appBaseUrl,
      emailDeliveryWebhookUrl,
      calendarSyncWebhookUrl,
    },
    details: "Integration settings were updated from the settings page.",
    severity: "INFO",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "Integration settings saved",
    "Invite link, email delivery, and calendar sync configuration were updated.",
    "/settings"
  );

  revalidatePath("/settings");
  revalidatePath("/admin/users");
  redirect("/settings?saved=1");
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireActiveSession();
  const notificationId = sanitize(formData.get("notificationId"));
  if (!notificationId) return;

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markNotificationReadByIdAction(notificationId: string) {
  const session = await requireActiveSession();
  if (!notificationId) return;

  await prisma.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.user.id,
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsReadAction() {
  const session = await requireActiveSession();

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "NOTIFICATIONS_MARKED_READ",
    target: `User:${session.user.id}`,
    details: "User marked all notifications as read.",
    severity: "INFO",
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function markAllNotificationsReadQuickAction() {
  const session = await requireActiveSession();

  await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      status: "UNREAD",
    },
    data: {
      status: "READ",
      readAt: new Date(),
    },
  });

  revalidatePath("/notifications");
  revalidatePath("/");
}

export async function completeInitialPasswordSetupAction(formData: FormData) {
  const session = await requireActiveSession();
  const password = sanitize(formData.get("password"));
  const confirmPassword = sanitize(formData.get("confirmPassword"));

  const validation = validatePasswordPolicy(password);
  if (!password || !validation.isValid) {
    redirectWithError("/reset-password", passwordPolicyMessage());
  }

  if (password !== confirmPassword) {
    redirect("/reset-password?error=Passwords%20do%20not%20match");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash: createPasswordHash(password),
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "PASSWORD_RESET_COMPLETED",
    target: `User:${session.user.id}`,
    details: "User completed required password reset.",
    severity: "INFO",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "Password updated",
    "Your password was updated and your account is ready to use.",
    "/account"
  );

  revalidatePath("/");
  redirect("/");
}

export async function createManagedUserAction(formData: FormData) {
  const session = await requireActiveSession();
  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");
  await SecurityService.enforceAccess(ctx, "USER_MANAGE", "UserProvisioning");

  const name = sanitize(formData.get("name"));
  const email = sanitize(formData.get("email")).toLowerCase();
  const role = sanitize(formData.get("role")) || "ADVISOR";
  const temporaryPassword = sanitize(formData.get("temporaryPassword"));
  const returnTo = sanitize(formData.get("returnTo")) || "/admin/users";
  const validation = validatePasswordPolicy(temporaryPassword);

  if (!email || !temporaryPassword || !validation.isValid) {
    redirectWithError(returnTo, `Email and temporary password are required. ${passwordPolicyMessage()}`);
  }

  const user = await prisma.user.create({
    data: {
      organizationId: session.user.organizationId,
      email,
      name: name || null,
      role,
      passwordHash: createPasswordHash(temporaryPassword),
      isActive: true,
      mustChangePassword: true,
    },
  });

  await prisma.userPreference.create({
    data: {
      userId: user.id,
      timezone: "America/Chicago",
      locale: "en-US",
      emailNotifications: true,
      inAppNotifications: true,
      weeklyDigest: false,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "USER_PROVISIONED",
    target: `User:${user.id}`,
    details: `Provisioned stored account for ${email}. First login requires password reset.`,
    afterState: { email, role, isActive: true, mustChangePassword: true },
    severity: "INFO",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "User account created",
    `Stored sign-in created for ${email}. Share the temporary password through your firm process.`,
    "/admin/users"
  );

  revalidatePath("/settings");
  revalidatePath("/admin/users");
  redirect(`${returnTo}?userSaved=1`);
}

export async function setManagedUserStatusAction(formData: FormData) {
  const session = await requireActiveSession();
  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");
  await SecurityService.enforceAccess(ctx, "USER_MANAGE", "UserStatusUpdate");

  const userId = sanitize(formData.get("userId"));
  const nextStatus = sanitize(formData.get("nextStatus"));
  const returnTo = sanitize(formData.get("returnTo")) || "/admin/users";

  if (!userId || !nextStatus) {
    redirectWithError(returnTo, "Missing user status update input");
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.user.organizationId },
  });

  if (!user) {
    redirectWithError(returnTo, "User not found");
    return;
  }
  const managedUser = user;

  const isActive = nextStatus === "ACTIVE";

  await prisma.user.update({
    where: { id: managedUser.id },
    data: {
      isActive,
      deactivatedAt: isActive ? null : new Date(),
    },
  });

  if (!isActive) {
    await prisma.userSession.deleteMany({ where: { userId: managedUser.id } });
  }

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    target: `User:${managedUser.id}`,
    details: `${managedUser.email} was ${isActive ? "reactivated" : "deactivated"}.`,
    severity: "WARNING",
  });

  revalidatePath("/settings");
  revalidatePath("/admin/users");
  redirect(`${returnTo}?userSaved=1`);
}

export async function resetManagedUserPasswordAction(formData: FormData) {
  const session = await requireActiveSession();
  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");
  await SecurityService.enforceAccess(ctx, "USER_MANAGE", "UserPasswordReset");

  const userId = sanitize(formData.get("userId"));
  const temporaryPassword = sanitize(formData.get("temporaryPassword"));
  const returnTo = sanitize(formData.get("returnTo")) || "/admin/users";
  const validation = validatePasswordPolicy(temporaryPassword);

  if (!userId || !temporaryPassword || !validation.isValid) {
    redirectWithError(returnTo, passwordPolicyMessage());
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId: session.user.organizationId },
  });

  if (!user) {
    redirectWithError(returnTo, "User not found");
    return;
  }
  const managedUser = user;

  await prisma.user.update({
    where: { id: managedUser.id },
    data: {
      passwordHash: createPasswordHash(temporaryPassword),
      mustChangePassword: true,
      lastPasswordChangeAt: null,
      isActive: true,
      deactivatedAt: null,
    },
  });

  await prisma.userSession.deleteMany({ where: { userId: managedUser.id } });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "USER_PASSWORD_RESET_BY_ADMIN",
    target: `User:${managedUser.id}`,
    details: `Temporary password reset for ${managedUser.email}. First login requires password change.`,
    severity: "WARNING",
  });

  revalidatePath("/settings");
  revalidatePath("/admin/users");
  redirect(`${returnTo}?userSaved=1`);
}

export async function revokeUserSessionAction(formData: FormData) {
  const session = await requireActiveSession();
  const sessionId = sanitize(formData.get("sessionId"));
  const targetUserId = sanitize(formData.get("userId"));
  const returnTo = sanitize(formData.get("returnTo")) || "/account";

  if (!sessionId || !targetUserId) {
    redirectWithError(returnTo, "Missing session revoke input");
  }

  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");

  const canManageOthers = targetUserId !== session.user.id;
  if (canManageOthers) {
    await SecurityService.enforceAccess(ctx, "USER_MANAGE", `UserSession:${sessionId}`);
  }

  const active = await prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId: targetUserId,
      user: { organizationId: session.user.organizationId },
    },
    include: { user: true },
  });

  if (!active) {
    redirectWithError(returnTo, "Session not found");
    return;
  }
  const activeSession = active;

  await prisma.userSession.delete({ where: { id: activeSession.id } });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "USER_SESSION_REVOKED",
    target: `User:${activeSession.userId}`,
    details: `Revoked session ${activeSession.id} for ${activeSession.user.email}.`,
    severity: "WARNING",
  });

  revalidatePath("/account");
  revalidatePath("/admin/users");
  redirect(`${returnTo}?saved=1`);
}

export async function beginMfaEnrollmentAction() {
  const session = await requireActiveSession();
  const secret = generateMfaSecret();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaSecret: secret,
      mfaEnabled: false,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "MFA_ENROLLMENT_STARTED",
    target: `User:${session.user.id}`,
    details: "User started MFA enrollment.",
    severity: "INFO",
  });

  revalidatePath("/account");
  redirect("/account?mfaSetup=1");
}

export async function confirmMfaEnrollmentAction(formData: FormData) {
  const session = await requireActiveSession();
  const code = sanitize(formData.get("code"));
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  const mfaSecret = assertPresent(currentUser?.mfaSecret, "/account", "No MFA enrollment is pending");

  if (!verifyTotp(mfaSecret, code)) {
    redirectWithError("/account", "Invalid MFA code");
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: true,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "MFA_ENABLED",
    target: `User:${session.user.id}`,
    details: "User enabled TOTP MFA.",
    severity: "WARNING",
  });

  await createUserNotification(
    session.user.id,
    session.user.organizationId,
    "MFA enabled",
    "Two-factor authentication is now required for future sign-ins.",
    "/account"
  );

  revalidatePath("/account");
  redirect("/account?saved=1");
}

export async function disableMfaAction() {
  const session = await requireActiveSession();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      mfaEnabled: false,
      mfaSecret: null,
      mfaRecoveryCodes: null,
    },
  });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "MFA_DISABLED",
    target: `User:${session.user.id}`,
    details: "User disabled TOTP MFA.",
    severity: "WARNING",
  });

  revalidatePath("/account");
  redirect("/account?saved=1");
}

export async function sendUserInviteAction(formData: FormData) {
  const session = await requireActiveSession();
  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");
  await SecurityService.enforceAccess(ctx, "USER_MANAGE", "UserInvite");

  const userId = sanitize(formData.get("userId"));
  const returnTo = sanitize(formData.get("returnTo")) || "/admin/users";

  if (!userId) {
    redirectWithError(returnTo, "Missing invite target");
  }

  const managedUser = assertPresent(await prisma.user.findFirst({
    where: { id: userId, organizationId: session.user.organizationId },
  }), returnTo, "User not found");

  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const inviteLink = `/accept-invite?token=${token}`;
  const integrationConfig = await IntegrationService.getConfig(session.user.organizationId);
  const absoluteInviteLink = `${integrationConfig.appBaseUrl}${inviteLink}`;

  await prisma.userInvite.deleteMany({
    where: {
      userId: managedUser.id,
      acceptedAt: null,
    },
  });

  await prisma.userInvite.create({
    data: {
      userId: managedUser.id,
      invitedByUserId: session.user.id,
      email: managedUser.email,
      token,
      expiresAt,
    },
  });

  await prisma.user.update({
    where: { id: managedUser.id },
    data: {
      mustChangePassword: true,
      isActive: true,
      deactivatedAt: null,
    },
  });

  try {
    await IntegrationService.deliverSystemEmail(
      {
        to: managedUser.email,
        subject: "Your Drift OS account setup link",
        body: `Your firm created a Drift OS account for you.\n\nSet your password here: ${absoluteInviteLink}\n\nThis link expires on ${expiresAt.toLocaleString()}.`,
        organizationId: session.user.organizationId,
      },
      ctx,
      `UserInvite:${managedUser.id}`
    );
  } catch {
    // Honest fallback: invite stays stored even if email delivery is unavailable.
  }

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "USER_INVITE_CREATED",
    target: `User:${managedUser.id}`,
    details: `Invite created for ${managedUser.email}.`,
    metadata: { inviteLink, absoluteInviteLink, expiresAt },
    severity: "INFO",
  });

  revalidatePath("/admin/users");
  redirect(`${returnTo}?userSaved=1`);
}

export async function revokeUserInviteAction(formData: FormData) {
  const session = await requireActiveSession();
  const ctx = await getSecurityContextFromSession();
  if (!ctx) redirect("/sign-in");
  await SecurityService.enforceAccess(ctx, "USER_MANAGE", "UserInviteRevoke");

  const inviteId = sanitize(formData.get("inviteId"));
  const returnTo = sanitize(formData.get("returnTo")) || "/admin/users";

  if (!inviteId) {
    redirectWithError(returnTo, "Missing invite record");
  }

  const invite = assertPresent(await prisma.userInvite.findFirst({
    where: {
      id: inviteId,
      user: { organizationId: session.user.organizationId },
      acceptedAt: null,
    },
    include: { user: true },
  }), returnTo, "Invite not found");

  await prisma.userInvite.delete({ where: { id: invite.id } });

  await AuditService.logAction({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    action: "USER_INVITE_REVOKED",
    target: `User:${invite.userId}`,
    details: `Invite revoked for ${invite.user.email}.`,
    severity: "WARNING",
  });

  revalidatePath("/admin/users");
  redirect(`${returnTo}?userSaved=1`);
}

export async function acceptInviteAction(formData: FormData) {
  const token = sanitize(formData.get("token"));
  const password = sanitize(formData.get("password"));
  const confirmPassword = sanitize(formData.get("confirmPassword"));
  const invitePath = token ? `/accept-invite?token=${encodeURIComponent(token)}` : "/accept-invite";

  const validation = validatePasswordPolicy(password);
  if (!token || !validation.isValid) {
    redirectWithError(invitePath, passwordPolicyMessage());
  }

  if (password !== confirmPassword) {
    redirectWithError(invitePath, "Passwords do not match");
  }

  const invite = await prisma.userInvite.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt <= new Date()) {
    redirectWithError(invitePath, "Invite is invalid or expired");
  }

  const acceptedInvite = assertPresent(invite, invitePath, "Invite is invalid or expired");

  await prisma.user.update({
    where: { id: acceptedInvite.userId },
    data: {
      passwordHash: createPasswordHash(password),
      mustChangePassword: false,
      lastPasswordChangeAt: new Date(),
      isActive: true,
      deactivatedAt: null,
    },
  });

  await prisma.userInvite.update({
    where: { id: acceptedInvite.id },
    data: { acceptedAt: new Date() },
  });

  await AuditService.logAction({
    organizationId: acceptedInvite.user.organizationId,
    userId: acceptedInvite.userId,
    action: "USER_INVITE_ACCEPTED",
    target: `User:${acceptedInvite.userId}`,
    details: `Invite accepted for ${acceptedInvite.user.email}.`,
    severity: "INFO",
  });

  redirect("/sign-in");
}
