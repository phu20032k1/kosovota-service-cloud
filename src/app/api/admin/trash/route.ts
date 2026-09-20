import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { ensureTrashStorage, RESTORABLE_TRASH_TYPES } from "@/lib/trash";
import { writeAudit } from "@/lib/audit";

const MAX_BULK = 100;

function readIds(body: Record<string, unknown>) {
  const raw = Array.isArray(body.ids) ? body.ids : typeof body.id === "string" ? [body.id] : [];
  return Array.from(new Set(raw.map((value) => String(value || "").trim()).filter(Boolean))).slice(0, MAX_BULK);
}

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem Thùng rác." }, { status: 403 });

  await ensureTrashStorage(prisma);
  const includeRestored = new URL(request.url).searchParams.get("includeRestored") === "1";
  const items = await prisma.trashItem.findMany({
    where: includeRestored ? undefined : { restoredAt: null },
    orderBy: { deletedAt: "desc" },
    take: 500,
    select: {
      id: true, entityType: true, entityId: true, label: true,
      deletedById: true, deletedByName: true, source: true,
      deletedAt: true, restoredAt: true, restoredById: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: items.map((item) => ({ ...item, restoreSupported: RESTORABLE_TRASH_TYPES.has(item.entityType) })),
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "SUPER_ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa vĩnh viễn dữ liệu trong Thùng rác." }, { status: 403 });

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ids = readIds(body);
  if (!ids.length) return NextResponse.json({ success: false, message: "Chưa chọn dữ liệu cần xóa vĩnh viễn." }, { status: 400 });

  await ensureTrashStorage(prisma);
  const items = await prisma.trashItem.findMany({ where: { id: { in: ids }, restoredAt: null } });
  if (!items.length) return NextResponse.json({ success: false, message: "Không tìm thấy dữ liệu còn hiệu lực trong Thùng rác." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.trashItem.deleteMany({ where: { id: { in: items.map((item) => item.id) } } });
  });

  for (const item of items) {
    await writeAudit({
      request,
      userId: auth.user.id,
      action: "PERMANENT_DELETE_TRASH",
      target: item.entityType + ":" + item.entityId,
      detail: { trashId: item.id, label: item.label, bulk: ids.length > 1 },
    });
  }

  return NextResponse.json({
    success: true,
    deleted: items.length,
    message: items.length === 1 ? "Đã xóa vĩnh viễn bản lưu trong Thùng rác." : `Đã xóa vĩnh viễn ${items.length} bản lưu trong Thùng rác.`,
  });
}
