-- Separate technician work from dealer ownership. Existing orders remain unassigned until a dealer chooses a KTV.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_ServiceOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderCode" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "dealerId" TEXT,
  "technicianId" TEXT,
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
  CONSTRAINT "ServiceOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ServiceOrder_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceOrder" ("id","orderCode","machineId","dealerId","maintenanceScheduleId","customerName","customerPhone","address","serviceType","status","rejectReason","rejectedAt","dueDate","serviceFee","paymentStatus","createdAt","updatedAt")
SELECT "id","orderCode","machineId","dealerId","maintenanceScheduleId","customerName","customerPhone","address","serviceType","status","rejectReason","rejectedAt","dueDate","serviceFee","paymentStatus","createdAt","updatedAt" FROM "ServiceOrder";
DROP TABLE "ServiceOrder";
ALTER TABLE "new_ServiceOrder" RENAME TO "ServiceOrder";
CREATE UNIQUE INDEX "ServiceOrder_orderCode_key" ON "ServiceOrder"("orderCode");
CREATE UNIQUE INDEX "ServiceOrder_maintenanceScheduleId_key" ON "ServiceOrder"("maintenanceScheduleId");
CREATE INDEX "ServiceOrder_machineId_idx" ON "ServiceOrder"("machineId");
CREATE INDEX "ServiceOrder_dealerId_idx" ON "ServiceOrder"("dealerId");
CREATE INDEX "ServiceOrder_technicianId_idx" ON "ServiceOrder"("technicianId");
CREATE INDEX "ServiceOrder_status_dueDate_idx" ON "ServiceOrder"("status", "dueDate");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
