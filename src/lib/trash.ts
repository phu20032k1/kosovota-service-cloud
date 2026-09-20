import { Prisma } from "@prisma/client";

type TrashDb = Pick<Prisma.TransactionClient, "trashItem" | "$executeRawUnsafe">;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function ensureTrashStorage(db: TrashDb) {
  await db.$executeRawUnsafe(
    'CREATE TABLE IF NOT EXISTS "TrashItem" ("id" TEXT NOT NULL, "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL, "label" TEXT NOT NULL, "snapshot" JSONB NOT NULL, "metadata" JSONB, "deletedById" TEXT, "deletedByName" TEXT, "source" TEXT, "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "restoredAt" TIMESTAMP(3), "restoredById" TEXT, CONSTRAINT "TrashItem_pkey" PRIMARY KEY ("id"))'
  );
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TrashItem_restoredAt_deletedAt_idx" ON "TrashItem"("restoredAt", "deletedAt")');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TrashItem_entityType_deletedAt_idx" ON "TrashItem"("entityType", "deletedAt")');
  await db.$executeRawUnsafe('CREATE INDEX IF NOT EXISTS "TrashItem_entityType_entityId_idx" ON "TrashItem"("entityType", "entityId")');
}

export async function archiveToTrash(
  db: TrashDb,
  input: {
    entityType: string;
    entityId: string;
    label: string;
    snapshot: unknown;
    metadata?: unknown;
    deletedById?: string | null;
    deletedByName?: string | null;
    source?: string | null;
  },
) {
  await ensureTrashStorage(db);
  return db.trashItem.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label,
      snapshot: jsonValue(input.snapshot),
      metadata: input.metadata === undefined ? undefined : jsonValue(input.metadata),
      deletedById: input.deletedById || null,
      deletedByName: input.deletedByName || null,
      source: input.source || null,
    },
  });
}

export const RESTORABLE_TRASH_TYPES = new Set([
  "USER",
  "CUSTOMER",
  "DEALER",
  "SERVICE_ORDER",
  "SUPPORT_TICKET",
  "MAINTENANCE_SCHEDULE",
]);
