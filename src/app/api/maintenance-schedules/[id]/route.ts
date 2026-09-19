import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const allowed = ["PENDING", "ORDER_CREATED", "COMPLETED", "DISABLED", "SELF_SERVICE"];
  const current = await prisma.maintenanceSchedule.findUnique({
    where: { id },
    include: { machine: { select: { provinceCode: true } }, serviceOrder: { select: { id: true } } },
  });
  if (!current) return NextResponse.json({ success: false, message: "Không tìm thấy lịch bảo trì." }, { status: 404 });
  const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
  if (auth.user.role === "CSKH" && scopes.length && (!current.machine.provinceCode || !scopes.includes(current.machine.provinceCode))) {
    return NextResponse.json({ success: false, message: "Lịch nằm ngoài phạm vi được phân công." }, { status: 403 });
  }

  const data: { status?: string; dueDate?: Date; title?: string } = {};
  if ("status" in body) {
    if (!allowed.includes(body.status)) return NextResponse.json({ success: false, message: "Trạng thái không hợp lệ." }, { status: 400 });
    data.status = body.status;
  }
  if ("dueDate" in body) {
    const dueDate = new Date(body.dueDate);
    if (Number.isNaN(dueDate.getTime())) return NextResponse.json({ success: false, message: "Ngày đến hạn không hợp lệ." }, { status: 400 });
    if (current.serviceOrder) return NextResponse.json({ success: false, message: "Lịch đã sinh lệnh dịch vụ; hãy đổi hạn trên lệnh để tránh lệch dữ liệu." }, { status: 409 });
    data.dueDate = dueDate;
  }
  if ("title" in body) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title) return NextResponse.json({ success: false, message: "Nội dung lịch không được để trống." }, { status: 400 });
    data.title = title;
  }
  if (!Object.keys(data).length) return NextResponse.json({ success: false, message: "Không có thay đổi hợp lệ." }, { status: 400 });

  const schedule = await prisma.maintenanceSchedule.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: schedule });
}
export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa lịch." }, { status: 403 });
  const { id } = await params;
  await prisma.maintenanceSchedule.delete({ where: { id } });
  return NextResponse.json({ success: true, message: "Đã xóa lịch bảo trì." });
}
