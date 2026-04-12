-- AlterTable
ALTER TABLE "OrganizationSettings" ADD COLUMN "appBaseUrl" TEXT;
ALTER TABLE "OrganizationSettings" ADD COLUMN "calendarSyncWebhookUrl" TEXT;
ALTER TABLE "OrganizationSettings" ADD COLUMN "emailDeliveryWebhookUrl" TEXT;
