-- PostgreSQL baseline for KOSOVOTA.
-- Existing Neon databases previously created with `prisma db push` must mark this
-- migration as applied once with: npm run db:baseline

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "dealerCode" TEXT,
  "provinceScope" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Customer" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "address" TEXT,
  "notifyChannels" TEXT,
  "callFrom" TEXT,
  "callTo" TEXT,
  "segment" TEXT DEFAULT 'STANDARD',
  "tags" TEXT,
  "satisfaction" INTEGER,
  "birthday" TIMESTAMP(3),
  "lastContactAt" TIMESTAMP(3),
  "nextContactAt" TIMESTAMP(3),
  "ownerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Dealer" (
  "id" TEXT NOT NULL,
  "dealerCode" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "province" TEXT,
  "address" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "services" TEXT,
  "technicianCount" INTEGER,
  "representativeName" TEXT,
  "registrationType" TEXT,
  "companyName" TEXT,
  "birthDate" TIMESTAMP(3),
  "locationType" TEXT,
  "serviceArea" TEXT,
  "taxCode" TEXT,
  "citizenId" TEXT,
  "bankAccount" TEXT,
  "accountHolder" TEXT,
  "bankName" TEXT,
  "portraitPhoto" TEXT,
  "storePhoto" TEXT,
  "warehousePhoto" TEXT,
  "videoName" TEXT,
  "rating" DOUBLE PRECISION DEFAULT 5,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Machine" (
  "id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "name" TEXT,
  "capacity" TEXT,
  "specification" TEXT,
  "warrantyMonths" INTEGER,
  "serial" TEXT,
  "provinceCode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "manufactureDate" TIMESTAMP(3),
  "installDate" TIMESTAMP(3),
  "customerId" TEXT,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "buildingPhoto" TEXT,
  "machinePhoto" TEXT,
  "sharedPhones" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Machine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Activation" (
  "id" TEXT NOT NULL,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Activation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MaintenanceSchedule" (
  "id" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceOrder" (
  "id" TEXT NOT NULL,
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
  "rejectedAt" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3),
  "serviceFee" INTEGER,
  "paymentStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceReport" (
  "id" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "orderId" TEXT,
  "dealerCode" TEXT,
  "serviceType" TEXT NOT NULL,
  "products" TEXT,
  "oldCorePhoto" TEXT,
  "newCorePhoto" TEXT,
  "finalPhoto" TEXT,
  "signature" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "kind" TEXT,
  "content" TEXT NOT NULL,
  "payload" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "providerMessageId" TEXT,
  "error" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminLog" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "target" TEXT,
  "detail" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SosTicket" (
  "id" TEXT NOT NULL,
  "machineId" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "address" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "priority" TEXT NOT NULL DEFAULT 'HIGH',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SosTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OtpCode" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IdSequence" (
  "key" TEXT NOT NULL,
  "value" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdSequence_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "SalesLead" (
  "id" TEXT NOT NULL,
  "productSlug" TEXT,
  "fullName" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "province" TEXT,
  "note" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryItem" (
  "id" TEXT NOT NULL,
  "sku" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'cái',
  "minStock" INTEGER NOT NULL DEFAULT 0,
  "costPrice" INTEGER NOT NULL DEFAULT 0,
  "salePrice" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Warehouse" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'CENTRAL',
  "dealerId" TEXT,
  "province" TEXT,
  "address" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockBalance" (
  "id" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StockMovement" (
  "id" TEXT NOT NULL,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentBatch" (
  "id" TEXT NOT NULL,
  "batchCode" TEXT NOT NULL,
  "dealerId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "grossAmount" INTEGER NOT NULL DEFAULT 0,
  "deductions" INTEGER NOT NULL DEFAULT 0,
  "netAmount" INTEGER NOT NULL DEFAULT 0,
  "bankReference" TEXT,
  "note" TEXT,
  "approvedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentLine" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "serviceAmount" INTEGER NOT NULL DEFAULT 0,
  "materialAmount" INTEGER NOT NULL DEFAULT 0,
  "bonusAmount" INTEGER NOT NULL DEFAULT 0,
  "deductionAmount" INTEGER NOT NULL DEFAULT 0,
  "totalAmount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL,
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
  "dueAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "satisfaction" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TicketMessage" (
  "id" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT,
  "authorName" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "attachment" TEXT,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerActivity" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "detail" TEXT,
  "userId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
CREATE INDEX "User_role_active_idx" ON "User"("role", "active");
CREATE INDEX "User_dealerCode_idx" ON "User"("dealerCode");
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");
CREATE UNIQUE INDEX "Dealer_dealerCode_key" ON "Dealer"("dealerCode");
CREATE INDEX "Dealer_status_province_idx" ON "Dealer"("status", "province");
CREATE INDEX "Dealer_phone_idx" ON "Dealer"("phone");
CREATE UNIQUE INDEX "Machine_serial_key" ON "Machine"("serial");
CREATE INDEX "Machine_customerId_idx" ON "Machine"("customerId");
CREATE INDEX "Machine_status_idx" ON "Machine"("status");
CREATE INDEX "Machine_provinceCode_idx" ON "Machine"("provinceCode");
CREATE UNIQUE INDEX "Activation_machineId_step_key" ON "Activation"("machineId", "step");
CREATE INDEX "Activation_machineId_idx" ON "Activation"("machineId");
CREATE INDEX "Activation_dealerCode_idx" ON "Activation"("dealerCode");
CREATE INDEX "MaintenanceSchedule_machineId_idx" ON "MaintenanceSchedule"("machineId");
CREATE INDEX "MaintenanceSchedule_dueDate_status_idx" ON "MaintenanceSchedule"("dueDate", "status");
CREATE UNIQUE INDEX "ServiceOrder_orderCode_key" ON "ServiceOrder"("orderCode");
CREATE UNIQUE INDEX "ServiceOrder_maintenanceScheduleId_key" ON "ServiceOrder"("maintenanceScheduleId");
CREATE INDEX "ServiceOrder_machineId_idx" ON "ServiceOrder"("machineId");
CREATE INDEX "ServiceOrder_dealerId_idx" ON "ServiceOrder"("dealerId");
CREATE INDEX "ServiceOrder_technicianId_idx" ON "ServiceOrder"("technicianId");
CREATE INDEX "ServiceOrder_status_dueDate_idx" ON "ServiceOrder"("status", "dueDate");
CREATE INDEX "ServiceReport_machineId_idx" ON "ServiceReport"("machineId");
CREATE INDEX "ServiceReport_orderId_idx" ON "ServiceReport"("orderId");
CREATE INDEX "Notification_phone_status_idx" ON "Notification"("phone", "status");
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");
CREATE INDEX "AdminLog_userId_createdAt_idx" ON "AdminLog"("userId", "createdAt");
CREATE INDEX "SosTicket_status_priority_createdAt_idx" ON "SosTicket"("status", "priority", "createdAt");
CREATE INDEX "OtpCode_phone_purpose_createdAt_idx" ON "OtpCode"("phone", "purpose", "createdAt");
CREATE INDEX "OtpCode_expiresAt_idx" ON "OtpCode"("expiresAt");
CREATE INDEX "SalesLead_status_createdAt_idx" ON "SalesLead"("status", "createdAt");
CREATE INDEX "SalesLead_phone_idx" ON "SalesLead"("phone");
CREATE UNIQUE INDEX "InventoryItem_sku_key" ON "InventoryItem"("sku");
CREATE INDEX "InventoryItem_category_active_idx" ON "InventoryItem"("category", "active");
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");
CREATE UNIQUE INDEX "Warehouse_dealerId_key" ON "Warehouse"("dealerId");
CREATE INDEX "Warehouse_type_active_idx" ON "Warehouse"("type", "active");
CREATE UNIQUE INDEX "StockBalance_warehouseId_itemId_key" ON "StockBalance"("warehouseId", "itemId");
CREATE INDEX "StockBalance_itemId_quantity_idx" ON "StockBalance"("itemId", "quantity");
CREATE UNIQUE INDEX "StockMovement_movementCode_key" ON "StockMovement"("movementCode");
CREATE INDEX "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");
CREATE INDEX "StockMovement_serviceOrderId_idx" ON "StockMovement"("serviceOrderId");
CREATE INDEX "StockMovement_fromWarehouseId_createdAt_idx" ON "StockMovement"("fromWarehouseId", "createdAt");
CREATE INDEX "StockMovement_toWarehouseId_createdAt_idx" ON "StockMovement"("toWarehouseId", "createdAt");
CREATE UNIQUE INDEX "PaymentBatch_batchCode_key" ON "PaymentBatch"("batchCode");
CREATE INDEX "PaymentBatch_dealerId_status_idx" ON "PaymentBatch"("dealerId", "status");
CREATE INDEX "PaymentBatch_periodStart_periodEnd_idx" ON "PaymentBatch"("periodStart", "periodEnd");
CREATE UNIQUE INDEX "PaymentLine_serviceOrderId_key" ON "PaymentLine"("serviceOrderId");
CREATE INDEX "PaymentLine_batchId_idx" ON "PaymentLine"("batchId");
CREATE UNIQUE INDEX "SupportTicket_ticketCode_key" ON "SupportTicket"("ticketCode");
CREATE INDEX "SupportTicket_status_priority_createdAt_idx" ON "SupportTicket"("status", "priority", "createdAt");
CREATE INDEX "SupportTicket_customerId_idx" ON "SupportTicket"("customerId");
CREATE INDEX "SupportTicket_machineId_idx" ON "SupportTicket"("machineId");
CREATE INDEX "SupportTicket_dealerId_idx" ON "SupportTicket"("dealerId");
CREATE INDEX "SupportTicket_assigneeId_status_idx" ON "SupportTicket"("assigneeId", "status");
CREATE INDEX "TicketMessage_ticketId_createdAt_idx" ON "TicketMessage"("ticketId", "createdAt");
CREATE INDEX "CustomerActivity_customerId_occurredAt_idx" ON "CustomerActivity"("customerId", "occurredAt");
CREATE INDEX "CustomerActivity_type_occurredAt_idx" ON "CustomerActivity"("type", "occurredAt");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Machine" ADD CONSTRAINT "Machine_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Activation" ADD CONSTRAINT "Activation_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceSchedule" ADD CONSTRAINT "MaintenanceSchedule_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_maintenanceScheduleId_fkey" FOREIGN KEY ("maintenanceScheduleId") REFERENCES "MaintenanceSchedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ServiceReport" ADD CONSTRAINT "ServiceReport_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceReport" ADD CONSTRAINT "ServiceReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SosTicket" ADD CONSTRAINT "SosTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Warehouse" ADD CONSTRAINT "Warehouse_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockBalance" ADD CONSTRAINT "StockBalance_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentBatch" ADD CONSTRAINT "PaymentBatch_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PaymentBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentLine" ADD CONSTRAINT "PaymentLine_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
