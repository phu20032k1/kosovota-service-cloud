-- Production workflows, permissions, OTP, counters, lead management and service settlement.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- Rebuild User because SQLite cannot add a NOT NULL timestamp with CURRENT_TIMESTAMP safely.
CREATE TABLE "new_User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "dealerCode" TEXT,
  "provinceScope" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("id", "phone", "password", "name", "role", "createdAt")
SELECT "id", "phone", "password", "name", "role", "createdAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");
CREATE INDEX "User_dealerCode_idx" ON "User"("dealerCode");

-- Customer communication preferences.
ALTER TABLE "Customer" ADD COLUMN "notifyChannels" TEXT;
ALTER TABLE "Customer" ADD COLUMN "callFrom" TEXT;
ALTER TABLE "Customer" ADD COLUMN "callTo" TEXT;

-- Dealer registration and settlement profile.
ALTER TABLE "Dealer" ADD COLUMN "representativeName" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "registrationType" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "companyName" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "Dealer" ADD COLUMN "locationType" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "serviceArea" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "taxCode" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "citizenId" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "accountHolder" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "bankName" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "portraitPhoto" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "storePhoto" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "warehousePhoto" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "videoName" TEXT;
ALTER TABLE "Dealer" ADD COLUMN "rating" REAL DEFAULT 5;
CREATE INDEX "Dealer_status_province_idx" ON "Dealer"("status", "province");
CREATE INDEX "Dealer_phone_idx" ON "Dealer"("phone");

-- Machine sharing and stronger lookup indexes.
ALTER TABLE "Machine" ADD COLUMN "sharedPhones" TEXT;
CREATE UNIQUE INDEX "Machine_serial_key" ON "Machine"("serial");
CREATE INDEX "Machine_provinceCode_idx" ON "Machine"("provinceCode");

-- Rebuild ServiceOrder with schedule relation and settlement fields.
CREATE TABLE "new_ServiceOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderCode" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "dealerId" TEXT,
  "maintenanceScheduleId" TEXT,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "address" TEXT,
  "serviceType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "rejectReason" TEXT,
  "rejectedAt" DATETIME,
  "dueDate" DATETIME,
  "serviceFee" INTEGER,
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceOrder_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ServiceOrder_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ServiceOrder_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceOrder" ("id", "orderCode", "machineId", "dealerId", "customerName", "customerPhone", "address", "serviceType", "status", "dueDate", "createdAt")
SELECT "id", "orderCode", "machineId", "dealerId", "customerName", "customerPhone", "address", "serviceType", "status", "dueDate", "createdAt" FROM "ServiceOrder";
DROP TABLE "ServiceOrder";
ALTER TABLE "new_ServiceOrder" RENAME TO "ServiceOrder";
CREATE UNIQUE INDEX "ServiceOrder_orderCode_key" ON "ServiceOrder"("orderCode");
CREATE UNIQUE INDEX "ServiceOrder_maintenanceScheduleId_key" ON "ServiceOrder"("maintenanceScheduleId");
CREATE INDEX "ServiceOrder_machineId_idx" ON "ServiceOrder"("machineId");
CREATE INDEX "ServiceOrder_dealerId_idx" ON "ServiceOrder"("dealerId");
CREATE INDEX "ServiceOrder_status_dueDate_idx" ON "ServiceOrder"("status", "dueDate");

-- Emergency support tickets.
CREATE TABLE "SosTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "machineId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "address" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'HIGH',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SosTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "SosTicket_status_priority_createdAt_idx" ON "SosTicket"("status", "priority", "createdAt");

-- OTP, atomic counters and product consultation leads.
CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" DATETIME NOT NULL,
  "consumedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");

CREATE TABLE "IdSequence" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "SalesLead" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "productSlug" TEXT,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "province" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");
CREATE INDEX "SalesLead_phone_idx" ON "SalesLead"("phone");

CREATE INDEX "Notification_phone_status_idx" ON "Notification"("phone", "status");
CREATE INDEX "AdminLog_userId_createdAt_idx" ON "AdminLog"("userId", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
