import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";
import { writeAudit } from "@/lib/audit";
import { databaseErrorMessage } from "@/lib/database-errors";

export async function GET(request: NextRequest) {
  try {
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q")?.trim();
    const segment = request.nextUrl.searchParams.get("segment") || undefined;
    const provinceScope = auth.user.provinceScope?.split(",").map((value) => value.trim()).filter(Boolean) || [];

    const customers = await prisma.customer.findMany({
      where: {
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { phone: { contains: q } },
            { address: { contains: q } },
            { machines: { some: { OR: [{ id: { contains: q } }, { serial: { contains: q } }] } } },
          ],
        } : {}),
        ...(segment ? { segment } : {}),
        ...(auth.user.role === "CSKH" && provinceScope.length
          ? { machines: { some: { provinceCode: { in: provinceScope } } } }
          : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        machines: { select: { id: true, model: true, name: true, serial: true, status: true, installDate: true } },
        _count: { select: { activities: true, tickets: true } },
      },
      orderBy: [{ nextContactAt: "asc" }, { updatedAt: "desc" }],
      take: 1000,
    });

    const staff = await prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "CSKH"] } },
      select: { id: true, name: true },
    });

    return NextResponse.json({ success: true, data: { customers, staff } });
  } catch (error) {
    console.error("GET /api/crm/customers failed", error);
    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không tải được danh sách khách hàng.") },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await hasRole(request, ["ADMIN"]);
    if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xóa khách hàng." }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const rawIds: unknown[] = Array.isArray(body.customerIds)
      ? body.customerIds
      : typeof body.customerId === "string"
        ? [body.customerId]
        : [];
    const customerIds: string[] = Array.from(
      new Set<string>(
        rawIds
          .map((value: unknown): string => String(value ?? "").trim())
          .filter((value: string): boolean => value.length > 0),
      ),
    ).slice(0, 1000);

    if (!customerIds.length) {
      return NextResponse.json({ success: false, message: "Chưa chọn khách hàng cần xóa." }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.customer.findMany({
        where: { id: { in: customerIds } },
        select: { id: true, name: true, phone: true },
      });
      const existingIds = existing.map((customer) => customer.id);
      if (!existingIds.length) return { deleted: 0, customers: existing };

      await tx.machine.updateMany({ where: { customerId: { in: existingIds } }, data: { customerId: null } });
      await tx.supportTicket.updateMany({ where: { customerId: { in: existingIds } }, data: { customerId: null } });
      await tx.customerActivity.deleteMany({ where: { customerId: { in: existingIds } } });
      const deleted = await tx.customer.deleteMany({ where: { id: { in: existingIds } } });
      return { deleted: deleted.count, customers: existing };
    });

    await writeAudit({
      request,
      userId: auth.user.id,
      action: result.deleted > 1 ? "DELETE_CUSTOMERS_BULK" : "DELETE_CUSTOMER",
      target: result.customers.map((customer) => customer.phone).join(","),
      detail: { customerIds, deleted: result.deleted, customers: result.customers },
    });

    return NextResponse.json({
      success: true,
      message: result.deleted === 1 ? "Đã xóa khách hàng." : `Đã xóa ${result.deleted} khách hàng.`,
      data: { deleted: result.deleted },
    });
  } catch (error) {
    console.error("DELETE /api/crm/customers failed", error);
    return NextResponse.json(
      { success: false, message: databaseErrorMessage(error, "Không xóa được khách hàng.") },
      { status: 500 },
    );
  }
}
