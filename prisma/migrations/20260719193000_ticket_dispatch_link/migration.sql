-- Link support tickets with their automatically-created dispatch orders.
ALTER TABLE "SupportTicket" ADD COLUMN "serviceOrderId" TEXT;

CREATE UNIQUE INDEX "SupportTicket_serviceOrderId_key" ON "SupportTicket"("serviceOrderId");

ALTER TABLE "SupportTicket"
ADD CONSTRAINT "SupportTicket_serviceOrderId_fkey"
FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
