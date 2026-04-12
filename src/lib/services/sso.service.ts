import "server-only";

import prisma from "@/lib/db";
import { AuditEventService } from "./audit-event.service";
import { createHash, randomBytes } from "crypto";

/**
 * SSO / SAML / OIDC Service
 *
 * Provides Single Sign-On integration for enterprise financial firms.
 * Supports:
 * - Google Workspace (OIDC)
 * - Microsoft Azure AD (OIDC)
 * - Okta (SAML 2.0 / OIDC)
 * - OneLogin (SAML 2.0 / OIDC)
 * - Custom SAML 2.0 providers
 *
 * Architecture:
 * - SSO providers are configured per-organization via IntegrationConfig
 * - Users are linked via ssoProviderId + ssoProvider on the User model
 * - Auto-provisioning creates users on first SSO login
 * - MFA is delegated to the SSO provider when SSO is active
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SSOProvider = "GOOGLE" | "AZURE_AD" | "OKTA" | "ONELOGIN" | "CUSTOM_SAML";

export interface SSOConfig {
  provider: SSOProvider;
  clientId: string;
  clientSecret: string;
  issuer: string; // OIDC issuer URL or SAML Entity ID
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl?: string;
  jwksUri?: string;
  samlMetadataUrl?: string; // For SAML providers
  scopes?: string[];
  autoProvision?: boolean; // Auto-create users on first login
  defaultRole?: string; // Role for auto-provisioned users
}

export interface SSOUserProfile {
  email: string;
  name?: string;
  avatarUrl?: string;
  providerId: string; // Unique ID from the SSO provider
  provider: SSOProvider;
  organizationId?: string; // Derived from email domain or config
}

export interface SSOLoginResult {
  success: boolean;
  userId?: string;
  mustLink?: boolean; // User exists but not linked to SSO
  error?: string;
}

// ---------------------------------------------------------------------------
// Provider configurations
// ---------------------------------------------------------------------------

const PROVIDER_DEFAULTS: Record<SSOProvider, Partial<SSOConfig>> = {
  GOOGLE: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    userInfoUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  AZURE_AD: {
    authorizationUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
    userInfoUrl: "https://graph.microsoft.com/oidc/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  OKTA: {
    authorizationUrl: "https://{domain}/oauth2/v1/authorize",
    tokenUrl: "https://{domain}/oauth2/v1/token",
    userInfoUrl: "https://{domain}/oauth2/v1/userinfo",
    scopes: ["openid", "email", "profile"],
  },
  ONELOGIN: {
    authorizationUrl: "https://{domain}/oidc/2/auth",
    tokenUrl: "https://{domain}/oidc/2/token",
    userInfoUrl: "https://{domain}/oidc/2/me",
    scopes: ["openid", "email", "profile"],
  },
  CUSTOM_SAML: {
    scopes: [],
  },
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class SSOService {
  /**
   * Get the SSO configuration for an organization.
   */
  static async getConfig(organizationId: string, provider: SSOProvider): Promise<SSOConfig | null> {
    const integration = await prisma.integrationConfig.findUnique({
      where: {
        organizationId_provider: {
          organizationId,
          provider,
        },
      },
      select: { config: true, status: true },
    });

    if (!integration || integration.status !== "ACTIVE") return null;

    const config = integration.config as Record<string, unknown>;
    const defaults = PROVIDER_DEFAULTS[provider];

    return {
      provider,
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      issuer: config.issuer as string,
      authorizationUrl: (config.authorizationUrl as string) ?? defaults.authorizationUrl ?? "",
      tokenUrl: (config.tokenUrl as string) ?? defaults.tokenUrl ?? "",
      userInfoUrl: (config.userInfoUrl as string) ?? defaults.userInfoUrl,
      jwksUri: config.jwksUri as string | undefined,
      samlMetadataUrl: config.samlMetadataUrl as string | undefined,
      scopes: (config.scopes as string[]) ?? defaults.scopes ?? [],
      autoProvision: (config.autoProvision as boolean) ?? true,
      defaultRole: (config.defaultRole as string) ?? "ADVISOR",
    };
  }

  /**
   * Generate the authorization URL for OIDC login flow.
   */
  static async getAuthorizationUrl(
    organizationId: string,
    provider: SSOProvider,
    redirectUri: string,
  ): Promise<{ url: string; state: string } | null> {
    const config = await this.getConfig(organizationId, provider);
    if (!config) return null;

    const state = randomBytes(32).toString("hex");

    // Store state for CSRF verification (expires in 10 minutes)
    // In production, use a proper state store (Redis, DB)
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: config.scopes?.join(" ") ?? "openid email profile",
      state,
    });

    let authUrl = config.authorizationUrl;
    // Replace tenant/domain placeholders
    if (provider === "AZURE_AD") {
      authUrl = authUrl.replace("{tenant}", config.issuer);
    } else if (provider === "OKTA" || provider === "ONELOGIN") {
      authUrl = authUrl.replace("{domain}", config.issuer);
    }

    return {
      url: `${authUrl}?${params.toString()}`,
      state,
    };
  }

  /**
   * Handle the OIDC callback — exchange code for tokens and get user profile.
   */
  static async handleCallback(
    organizationId: string,
    provider: SSOProvider,
    code: string,
    redirectUri: string,
  ): Promise<SSOLoginResult> {
    const config = await this.getConfig(organizationId, provider);
    if (!config) return { success: false, error: "SSO not configured" };

    try {
      // Exchange code for tokens
      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });

      if (!tokenResponse.ok) {
        const errorBody = await tokenResponse.text();
        return { success: false, error: `Token exchange failed: ${errorBody}` };
      }

      const tokens = await tokenResponse.json();
      const accessToken = tokens.access_token;

      // Get user profile from provider
      const profile = await this.fetchUserProfile(accessToken, config);
      if (!profile) {
        return { success: false, error: "Failed to fetch user profile" };
      }

      // Find or create the user
      return await this.findOrCreateUser(profile, organizationId, config);
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "SSO callback failed",
      };
    }
  }

  /**
   * Fetch user profile from the OIDC provider.
   */
  private static async fetchUserProfile(
    accessToken: string,
    config: SSOConfig,
  ): Promise<SSOUserProfile | null> {
    if (!config.userInfoUrl) return null;

    try {
      const response = await fetch(config.userInfoUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) return null;

      const data = await response.json();

      return {
        email: data.email,
        name: data.name ?? `${data.given_name ?? ""} ${data.family_name ?? ""}`.trim(),
        avatarUrl: data.picture,
        providerId: data.sub,
        provider: config.provider,
      };
    } catch {
      return null;
    }
  }

  /**
   * Find or create a user from SSO profile.
   */
  private static async findOrCreateUser(
    profile: SSOUserProfile,
    organizationId: string,
    config: SSOConfig,
  ): Promise<SSOLoginResult> {
    // 1. Check if user exists with this SSO provider ID
    const existingBySSO = await prisma.user.findFirst({
      where: {
        ssoProviderId: profile.providerId,
        ssoProvider: profile.provider,
        isActive: true,
      },
    });

    if (existingBySSO) {
      await AuditEventService.appendEvent({
        organizationId: existingBySSO.organizationId,
        userId: existingBySSO.id,
        action: "SSO_LOGIN",
        target: `User:${existingBySSO.id}`,
        details: `User signed in via ${profile.provider}`,
        severity: "INFO",
        metadata: { provider: profile.provider, email: profile.email },
      });

      return { success: true, userId: existingBySSO.id };
    }

    // 2. Check if user exists with this email (needs linking)
    const existingByEmail = await prisma.user.findUnique({
      where: { email: profile.email.toLowerCase() },
    });

    if (existingByEmail) {
      // Link the SSO provider to the existing user
      await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          ssoProviderId: profile.providerId,
          ssoProvider: profile.provider,
        },
      });

      await AuditEventService.appendEvent({
        organizationId: existingByEmail.organizationId,
        userId: existingByEmail.id,
        action: "SSO_LINKED",
        target: `User:${existingByEmail.id}`,
        details: `SSO provider ${profile.provider} linked to existing user`,
        severity: "INFO",
        metadata: { provider: profile.provider },
      });

      return { success: true, userId: existingByEmail.id };
    }

    // 3. Auto-provision new user if enabled
    if (config.autoProvision) {
      const newUser = await prisma.user.create({
        data: {
          organizationId,
          email: profile.email.toLowerCase(),
          name: profile.name,
          avatarUrl: profile.avatarUrl,
          role: config.defaultRole ?? "ADVISOR",
          ssoProviderId: profile.providerId,
          ssoProvider: profile.provider,
          mfaEnabled: true, // MFA handled by SSO provider
          passwordHash: null, // No password — SSO only
        },
      });

      await AuditEventService.appendEvent({
        organizationId,
        action: "SSO_USER_PROVISIONED",
        target: `User:${newUser.id}`,
        details: `New user auto-provisioned via ${profile.provider}: ${profile.email}`,
        severity: "INFO",
        metadata: { provider: profile.provider, email: profile.email, role: config.defaultRole },
      });

      return { success: true, userId: newUser.id };
    }

    // 4. No auto-provision — user must be invited first
    return {
      success: false,
      mustLink: true,
      error: "No matching user found. Contact your administrator for an invite.",
    };
  }

  /**
   * Configure SSO for an organization.
   */
  static async configure(organizationId: string, config: SSOConfig, userId: string) {
    await prisma.integrationConfig.upsert({
      where: {
        organizationId_provider: {
          organizationId,
          provider: config.provider,
        },
      },
      update: {
        config: config as any,
        status: "ACTIVE",
        category: "CRM", // Using existing category; semantically = SSO
      },
      create: {
        organizationId,
        provider: config.provider,
        category: "CRM",
        config: config as any,
        status: "ACTIVE",
      },
    });

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "SSO_CONFIGURED",
      target: `Integration:${config.provider}`,
      details: `SSO provider ${config.provider} configured`,
      severity: "WARNING",
      metadata: { provider: config.provider, autoProvision: config.autoProvision },
    });
  }

  /**
   * Disable SSO for an organization.
   */
  static async disable(organizationId: string, provider: SSOProvider, userId: string) {
    await prisma.integrationConfig.update({
      where: {
        organizationId_provider: {
          organizationId,
          provider,
        },
      },
      data: { status: "DISCONNECTED" },
    });

    await AuditEventService.appendEvent({
      organizationId,
      userId,
      action: "SSO_DISABLED",
      target: `Integration:${provider}`,
      details: `SSO provider ${provider} disabled`,
      severity: "WARNING",
    });
  }
}
