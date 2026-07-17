-- KOSOVOTA V3: CRM 360, inventory, settlements, support tickets and richer audit logs.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Customer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "notifyChannels" TEXT,
  "callFrom" TEXT,
  "callTo" TEXT,
  "segment" TEXT DEFAULT 'STANDARD',
  "tags" TEXT,
  "satisfaction" INTEGER,
  "birthday" DATETIME,
  "lastContactAt" DATETIME,
  "nextContactAt" DATETIME,
  "ownerId" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Customer" ("id","name","phone","address","notifyChannels","callFrom","callTo","createdAt","updatedAt")
SELECT "id","name","phone","address","notifyChannels","callFrom","callTo","createdAt","updatedAt" FROM "Customer";
DROP TABLE "Customer";
ALTER TABLE "new_Customer" RENAME TO "Customer";
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE INDEX "Customer_ownerId_nextContactAt_idx" ON "Customer"("ownerId", "nextContactAt");
CREATE INDEX "Customer_segment_idx" ON "Customer"("segment");

ALTER TABLE "AdminLog" ADD COLUMN "ipAddress" TEXT;
ALTER TABLE "AdminLog" ADD COLUMN "userAgent" TEXT;
ALTER TABLE "AdminLog" ADD COLUMN "requestId" TEXT;
CREATE INDEX "AdminLog_action_createdAt_idx" ON "AdminLog"("action", "createdAt");

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'cái',
  "minStock" INTEGER NOT NULL DEFAULT 0,
  "costPrice" INTEGER NOT NULL DEFAULT 0,
  "salePrice" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");
CREATE INDEX "InventoryItem_category_active_idx" ON "InventoryItem"("category", "active");

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CENTRAL',
  "dealerId" TEXT,
  "province" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Warehouse_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE UNIQUE INDEX "Warehouse_dealerId_key" ON "Warehouse"("dealerId");
CREATE INDEX "Warehouse_type_active_idx" ON "Warehouse"("type", "active");

CREATE TABLE "StockBalance" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "warehouseId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StockBalance_warehouseId_itemId_key" ON "StockBalance"("warehouseId", "itemId");
CREATE INDEX "StockBalance_itemId_quantity_idx" ON "StockBalance"("itemId", "quantity");

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "movementCode" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "fromWarehouseId" TEXT,
  "toWarehouseId" TEXT,
  "serviceOrderId" TEXT,
  "quantity" INTEGER NOT NULL,
  "unitCost" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "StockMovement_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StockMovement_movementCode_key" ON "StockMovement"("movementCode");
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");
CREATE INDEX "StockMovement_serviceOrderId_idx" ON "StockMovement"("serviceOrderId");
CREATE INDEX "StockMovement_fromWarehouseId_createdAt_idx" ON "StockMovement"("fromWarehouseId", "createdAt");
CREATE INDEX "StockMovement_toWarehouseId_createdAt_idx" ON "StockMovement"("toWarehouseId", "createdAt");

CREATE TABLE "PaymentBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchCode" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "periodStart" DATETIME NOT NULL,
  "periodEnd" DATETIME NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "grossAmount" INTEGER NOT NULL DEFAULT 0,
  "deductions" INTEGER NOT NULL DEFAULT 0,
  "netAmount" INTEGER NOT NULL DEFAULT 0,
  "bankReference" TEXT,
  "note" TEXT,
  "approvedAt" DATETIME,
  "paidAt" DATETIME,
  "createdById" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentBatch_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentBatch_batchCode_key" ON "PaymentBatch"("batchCode");
CREATE INDEX "PaymentBatch_dealerId_status_idx" ON "PaymentBatch"("dealerId", "status");
CREATE INDEX "PaymentBatch_periodStart_periodEnd_idx" ON "PaymentBatch"("periodStart", "periodEnd");

CREATE TABLE "PaymentLine" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "serviceAmount" INTEGER NOT NULL DEFAULT 0,
  "materialAmount" INTEGER NOT NULL DEFAULT 0,
  "bonusAmount" INTEGER NOT NULL DEFAULT 0,
  "deductionAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PaymentLine_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PaymentLine_serviceOrderId_key" ON "PaymentLine"("serviceOrderId");
CREATE INDEX "PaymentLine_batchId_idx" ON "PaymentLine"("batchId");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketCode" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'WARRANTY',
  "source" TEXT NOT NULL DEFAULT 'STAFF',
  "subject" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'NORMAL',
  "customerId" TEXT,
  "machineId" TEXT,
  "dealerId" TEXT,
  "assigneeId" TEXT,
  "contactName" TEXT NOT NULL,
  "contactPhone" TEXT NOT NULL,
  "dueAt" DATETIME,
  "resolvedAt" DATETIME,
  "satisfaction" INTEGER,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SupportTicket_ticketCode_key" ON "SupportTicket"("ticketCode");
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");
CREATE INDEX "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");
CREATE INDEX "SupportTicket_machineId_idx" ON "SupportTicket"("machineId");
CREATE INDEX "SupportTicket_dealerId_idx" ON "SupportTicket"("dealerId");
CREATE INDEX "SupportTicket_assigneeId_status_idx" ON "SupportTicket"("assigneeId", "status");

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "attachment" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");

CREATE TABLE "CustomerActivity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detail" TEXT,
  "userId" TEXT,
  "occurredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "CustomerActivity_customerId_occurredAt_idx" ON "CustomerActivity"("customerId", "occurredAt");
CREATE INDEX "CustomerActivity_type_occurredAt_idx" ON "CustomerActivity"("type", "occurredAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
