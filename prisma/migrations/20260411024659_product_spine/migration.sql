/*
  Warnings:

  - Added the required column `updatedAt` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN "afterState" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "beforeState" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "metadata" TEXT;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "householdId" TEXT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN "sourceRef" TEXT;

-- AlterTable
ALTER TABLE "OnboardingStep" ADD COLUMN "approverId" TEXT;

-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL DEFAULT 'DRIFT OS',
    "brandShortName" TEXT NOT NULL DEFAULT 'Drift',
    "productName" TEXT NOT NULL DEFAULT 'Drift Intelligence Platform',
    "tagline" TEXT NOT NULL DEFAULT 'AI Operating System for Financial Firms',
    "logoUrl" TEXT,
    "accentColor" TEXT NOT NULL DEFAULT '#4f46e5',
    "supportEmail" TEXT,
    "notificationsEmail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "timezone" TEXT,
    "locale" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "inAppNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'SYSTEM',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SentimentSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "sentimentScore" INTEGER NOT NULL,
    "relationStrength" INTEGER NOT NULL,
    "churnScore" INTEGER NOT NULL DEFAULT 0,
    "trigger" TEXT,
    "notes" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SentimentSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Communication" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "campaignId" TEXT,
    "type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approverId" TEXT,
    "approvalComments" TEXT,
    "sentAt" DATETIME,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Communication_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Communication_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Communication" ("body", "campaignId", "clientId", "direction", "id", "sentAt", "status", "subject", "timestamp", "type") SELECT "body", "campaignId", "clientId", "direction", "id", "sentAt", "status", "subject", "timestamp", "type" FROM "Communication";
DROP TABLE "Communication";
ALTER TABLE "new_Communication" RENAME TO "Communication";
CREATE TABLE "new_InvestmentInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "assetTicker" TEXT,
    "thesis" TEXT NOT NULL,
    "risks" TEXT,
    "catalysts" TEXT,
    "questions" TEXT,
    "confidence" REAL NOT NULL DEFAULT 75,
    "dataSources" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvestmentInsight_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_InvestmentInsight" ("assetTicker", "catalysts", "clientId", "createdAt", "id", "questions", "risks", "status", "thesis", "title") SELECT "assetTicker", "catalysts", "clientId", "createdAt", "id", "questions", "risks", "status", "thesis", "title" FROM "InvestmentInsight";
DROP TABLE "InvestmentInsight";
ALTER TABLE "new_InvestmentInsight" RENAME TO "InvestmentInsight";
CREATE TABLE "new_Opportunity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "valueEst" REAL,
    "confidence" REAL NOT NULL DEFAULT 70,
    "description" TEXT NOT NULL,
    "evidence" TEXT,
    "reasoning" TEXT,
    "suggestedAction" TEXT NOT NULL,
    "draftOutreach" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Opportunity_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Opportunity" ("clientId", "confidence", "createdAt", "description", "draftOutreach", "evidence", "id", "status", "suggestedAction", "type", "valueEst") SELECT "clientId", "confidence", "createdAt", "description", "draftOutreach", "evidence", "id", "status", "suggestedAction", "type", "valueEst" FROM "Opportunity";
DROP TABLE "Opportunity";
ALTER TABLE "new_Opportunity" RENAME TO "Opportunity";
CREATE TABLE "new_ResearchMemo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT,
    "title" TEXT NOT NULL,
    "assetOrSector" TEXT,
    "thesis" TEXT NOT NULL,
    "risks" TEXT NOT NULL,
    "catalysts" TEXT NOT NULL,
    "questions" TEXT,
    "sources" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedBy" TEXT NOT NULL DEFAULT 'AI',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResearchMemo_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ResearchMemo" ("assetOrSector", "catalysts", "clientId", "createdAt", "generatedBy", "id", "questions", "risks", "sources", "status", "thesis", "title") SELECT "assetOrSector", "catalysts", "clientId", "createdAt", "generatedBy", "id", "questions", "risks", "sources", "status", "thesis", "title" FROM "ResearchMemo";
DROP TABLE "ResearchMemo";
ALTER TABLE "new_ResearchMemo" RENAME TO "ResearchMemo";
CREATE TABLE "new_TaxInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "rationale" TEXT NOT NULL,
    "evidence" TEXT,
    "urgency" TEXT NOT NULL DEFAULT 'MEDIUM',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "confidence" REAL NOT NULL DEFAULT 80,
    "explanation" TEXT,
    "estimatedImpact" TEXT,
    "suggestedAction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNDER_REVIEW',
    "draftNote" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaxInsight_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TaxInsight" ("category", "clientId", "createdAt", "draftNote", "estimatedImpact", "evidence", "id", "rationale", "reviewedAt", "reviewedBy", "status", "suggestedAction", "title", "urgency") SELECT "category", "clientId", "createdAt", "draftNote", "estimatedImpact", "evidence", "id", "rationale", "reviewedAt", "reviewedBy", "status", "suggestedAction", "title", "urgency" FROM "TaxInsight";
DROP TABLE "TaxInsight";
ALTER TABLE "new_TaxInsight" RENAME TO "TaxInsight";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'ADVISOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "name", "organizationId", "role") SELECT "createdAt", "email", "id", "name", "organizationId", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_organizationId_key" ON "OrganizationSettings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");
