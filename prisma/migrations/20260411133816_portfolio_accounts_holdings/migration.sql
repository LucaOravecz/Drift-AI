-- CreateTable
CREATE TABLE "FinancialAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "custodian" TEXT,
    "taxTreatment" TEXT,
    "currentValue" REAL NOT NULL DEFAULT 0,
    "cashBalance" REAL NOT NULL DEFAULT 0,
    "targetEquities" REAL,
    "targetFixedIncome" REAL,
    "targetCash" REAL,
    "targetAlternatives" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FinancialAccount_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "assetClass" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "marketValue" REAL NOT NULL,
    "costBasis" REAL,
    "weightPercent" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Holding_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinancialAccount" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
