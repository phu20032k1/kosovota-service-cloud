import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { ensureTrashStorage, RESTORABLE_TRASH_TYPES } from "@/lib/trash";
import { writeAudit } from "@/lib/audit";

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

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) return NextResponse.json({ success: false, message: "Thiếu ID dữ liệu trong Thùng rác." }, { status: 400 });

  await ensureTrashStorage(prisma);
  const item = await prisma.trashItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ success: false, message: "Không tìm thấy dữ liệu trong Thùng rác." }, { status: 404 });

  await prisma.trashItem.delete({ where: { id } });
  await writeAudit({
    request,
    userId: auth.user.id,
    action: "PERMANENT_DELETE_TRASH",
    target: item.entityType + ":" + item.entityId,
    detail: { trashId: item.id, label: item.label },
  });
  return NextResponse.json({ success: true, message: "Đã xóa vĩnh viễn bản lưu trong Thùng rác." });
}
