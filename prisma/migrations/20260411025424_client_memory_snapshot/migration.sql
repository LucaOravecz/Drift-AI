-- CreateTable
CREATE TABLE "ClientMemorySnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
    "dataQuality" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "missingData" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClientMemorySnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
