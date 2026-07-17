-- Reliable notification queue fields for SMS, Zalo and email providers.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "sentAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_Notification" ("id", "phone", "channel", "content", "status", "createdAt", "updatedAt")
SELECT "id", "phone", "channel", "content", "status", "createdAt", CURRENT_TIMESTAMP FROM "Notification";

DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_phone_status_idx" ON "Notification"("phone", "status");
CREATE INDEX "Notification_status_createdAt_idx" ON "Notification"("status", "createdAt");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
