CREATE TABLE IF NOT EXISTS "TrashItem" (
  "id" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "metadata" JSONB,
  "deletedById" TEXT,
  "deletedByName" TEXT,
  "source" TEXT,
  "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "restoredAt" TIMESTAMP(3),
  "restoredById" TEXT,
  CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "TrashItem_restoredAt_deletedAt_idx" ON "TrashItem"("restoredAt", "deletedAt");
CREATE INDEX IF NOT EXISTS "TrashItem_entityType_deletedAt_idx" ON "TrashItem"("entityType", "deletedAt");
CREATE INDEX IF NOT EXISTS "TrashItem_entityType_entityId_idx" ON "TrashItem"("entityType", "entityId");
