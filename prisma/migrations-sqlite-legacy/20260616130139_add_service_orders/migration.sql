-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Activation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "installerName" TEXT,
    "installerPhone" TEXT,
    "dealerCode" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "note" TEXT,
    "bankAccount" TEXT,
    "bankOwner" TEXT,
    "bankName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activation_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Activation" ("bankAccount", "bankName", "bankOwner", "createdAt", "dealerCode", "id", "installerName", "installerPhone", "machineId", "note", "ownerName", "ownerPhone", "step") SELECT "bankAccount", "bankName", "bankOwner", "createdAt", "dealerCode", "id", "installerName", "installerPhone", "machineId", "note", "ownerName", "ownerPhone", "step" FROM "Activation";
DROP TABLE "Activation";
ALTER TABLE "new_Activation" RENAME TO "Activation";
CREATE INDEX "Activation_machineId_idx" ON "Activation"("machineId");
CREATE INDEX "Activation_dealerCode_idx" ON "Activation"("dealerCode");
CREATE UNIQUE INDEX "Activation_machineId_step_key" ON "Activation"("machineId", "step");
CREATE TABLE "new_Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Customer" ("address", "createdAt", "id", "name", "phone") SELECT "address", "createdAt", "id", "name", "phone" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE TABLE "new_Dealer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dealerCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "province" TEXT,
    "address" TEXT,
    "lat" REAL,
    "lng" REAL,
    "services" TEXT,
    "technicianCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Dealer" ("address", "createdAt", "dealerCode", "id", "lat", "lng", "name", "phone", "province", "services", "status", "technicianCount") SELECT "address", "createdAt", "dealerCode", "id", "lat", "lng", "name", "phone", "province", "services", "status", "technicianCount" FROM "Dealer";
DROP TABLE "Dealer";
ALTER TABLE "new_Dealer" RENAME TO "Dealer";
CREATE UNIQUE INDEX "Dealer_dealerCode_key" ON "Dealer"("dealerCode");
CREATE TABLE "new_Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model" TEXT NOT NULL,
    "serial" TEXT,
    "provinceCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "manufactureDate" DATETIME,
    "installDate" DATETIME,
    "customerId" TEXT,
    "lat" REAL,
    "lng" REAL,
    "buildingPhoto" TEXT,
    "machinePhoto" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Machine" ("buildingPhoto", "createdAt", "customerId", "id", "installDate", "lat", "lng", "machinePhoto", "manufactureDate", "model", "provinceCode", "serial", "status") SELECT "buildingPhoto", "createdAt", "customerId", "id", "installDate", "lat", "lng", "machinePhoto", "manufactureDate", "model", "provinceCode", "serial", "status" FROM "Machine";
DROP TABLE "Machine";
ALTER TABLE "new_Machine" RENAME TO "Machine";
CREATE INDEX "Machine_customerId_idx" ON "Machine"("customerId");
CREATE INDEX "Machine_status_idx" ON "Machine"("status");
CREATE TABLE "new_MaintenanceSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaintenanceSchedule_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MaintenanceSchedule" ("createdAt", "dueDate", "id", "machineId", "status", "title") SELECT "createdAt", "dueDate", "id", "machineId", "status", "title" FROM "MaintenanceSchedule";
DROP TABLE "MaintenanceSchedule";
ALTER TABLE "new_MaintenanceSchedule" RENAME TO "MaintenanceSchedule";
CREATE INDEX "MaintenanceSchedule_machineId_idx" ON "MaintenanceSchedule"("machineId");
CREATE INDEX "MaintenanceSchedule_dueDate_status_idx" ON "MaintenanceSchedule"("dueDate", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ServiceOrder_machineId_idx" ON "ServiceOrder"("machineId");

-- CreateIndex
CREATE INDEX "ServiceOrder_dealerId_idx" ON "ServiceOrder"("dealerId");

-- CreateIndex
CREATE INDEX "ServiceOrder_status_dueDate_idx" ON "ServiceOrder"("status", "dueDate");

-- CreateIndex
CREATE INDEX "ServiceReport_machineId_idx" ON "ServiceReport"("machineId");

-- CreateIndex
CREATE INDEX "ServiceReport_orderId_idx" ON "ServiceReport"("orderId");
