PRAGMA foreign_keys=OFF;

CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" DATETIME,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "dealerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_User" ("id", "phone", "password", "name", "role", "createdAt", "updatedAt")
SELECT "id", "phone", "password", "name", "role", "createdAt", "createdAt" FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE UNIQUE INDEX "User_customerId_key" ON "User"("customerId");
CREATE UNIQUE INDEX "User_dealerId_key" ON "User"("dealerId");

ALTER TABLE "ServiceOrder" ADD COLUMN "serviceFee" INTEGER NOT NULL DEFAULT 150000;
ALTER TABLE "ServiceOrder" ADD COLUMN "assignedAt" DATETIME;
ALTER TABLE "ServiceOrder" ADD COLUMN "acceptedAt" DATETIME;
ALTER TABLE "ServiceOrder" ADD COLUMN "completedAt" DATETIME;
ALTER TABLE "ServiceOrder" ADD COLUMN "updatedAt" DATETIME NOT NULL DEFAULT '1970-01-01 00:00:00';

CREATE TABLE "MachineShareRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "ownerCustomerId" TEXT NOT NULL,
    "relativePhone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MachineShareRequest_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MachineShareRequest_ownerCustomerId_fkey" FOREIGN KEY ("ownerCustomerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "MachineShareRequest_ownerCustomerId_createdAt_idx" ON "MachineShareRequest"("ownerCustomerId", "createdAt");
CREATE INDEX "MachineShareRequest_machineId_relativePhone_idx" ON "MachineShareRequest"("machineId", "relativePhone");

CREATE TABLE "PasswordResetRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PasswordResetRequest_userId_createdAt_idx" ON "PasswordResetRequest"("userId", "createdAt");
CREATE INDEX "PasswordResetRequest_phone_createdAt_idx" ON "PasswordResetRequest"("phone", "createdAt");

PRAGMA foreign_keys=ON;
