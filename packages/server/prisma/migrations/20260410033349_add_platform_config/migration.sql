-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Merchant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "platformConfig" TEXT NOT NULL DEFAULT '{}',
    "couponRules" TEXT,
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Merchant" ("apiKey", "config", "couponRules", "createdAt", "domain", "id", "name", "platform") SELECT "apiKey", "config", "couponRules", "createdAt", "domain", "id", "name", "platform" FROM "Merchant";
DROP TABLE "Merchant";
ALTER TABLE "new_Merchant" RENAME TO "Merchant";
CREATE UNIQUE INDEX "Merchant_domain_key" ON "Merchant"("domain");
CREATE UNIQUE INDEX "Merchant_apiKey_key" ON "Merchant"("apiKey");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
