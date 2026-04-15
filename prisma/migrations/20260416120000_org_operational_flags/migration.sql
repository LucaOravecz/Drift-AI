-- AlterTable
ALTER TABLE "organization_settings" ADD COLUMN "aiFeaturesEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "organization_settings" ADD COLUMN "readOnlyMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "organization_settings" ADD COLUMN "syncDriftAlertBps" INTEGER NOT NULL DEFAULT 50;
