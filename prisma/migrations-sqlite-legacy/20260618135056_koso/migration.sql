-- Idempotent cleanup of indexes that may already have been removed by the previous migration.
DROP INDEX IF EXISTS "AdminLog_action_createdAt_idx";
DROP INDEX IF EXISTS "Customer_segment_idx";
DROP INDEX IF EXISTS "Customer_ownerId_nextContactAt_idx";
