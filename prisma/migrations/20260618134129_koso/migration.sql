/*
  Warnings:

  - You are about to drop the `MachineShareRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PasswordResetRequest` table. If the table is not empty, all the data it contains will be lost.

*/
DROP INDEX IF EXISTS "AdminLog_action_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "Customer_segment_idx";

-- DropIndex
DROP INDEX IF EXISTS "Customer_ownerId_nextContactAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "MachineShareRequest_machineId_relativePhone_idx";

-- DropIndex
DROP INDEX IF EXISTS "MachineShareRequest_ownerCustomerId_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "PasswordResetRequest_phone_createdAt_idx";

-- DropIndex
DROP INDEX IF EXISTS "PasswordResetRequest_userId_createdAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "MachineShareRequest";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "PasswordResetRequest";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_IdSequence" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_IdSequence" ("key", "updatedAt", "value") SELECT "key", "updatedAt", "value" FROM "IdSequence";
DROP TABLE "IdSequence";
ALTER TABLE "new_IdSequence" RENAME TO "IdSequence";
CREATE TABLE "new_SosTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "address" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "priority" TEXT NOT NULL DEFAULT 'HIGH',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SosTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SosTicket" ("address", "createdAt", "customerName", "customerPhone", "id", "machineId", "note", "priority", "status", "updatedAt") SELECT "address", "createdAt", "customerName", "customerPhone", "id", "machineId", "note", "priority", "status", "updatedAt" FROM "SosTicket";
DROP TABLE "SosTicket";
ALTER TABLE "new_SosTicket" RENAME TO "SosTicket";
CREATE INDEX "SosTicket_status_priority_createdAt_idx" ON "SosTicket"("status", "priority", "createdAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
