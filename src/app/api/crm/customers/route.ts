import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const segment = request.nextUrl.searchParams.get("segment") || undefined;
  const provinceScope = auth.user.provinceScope?.split(",").map((v) => v.trim()).filter(Boolean) || [];
  const customers = await prisma.customer.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }, { address: { contains: q } }] } : {}),
      ...(segment ? { segment } : {}),
      ...(auth.user.role === "CSKH" && provinceScope.length ? { machines: { some: { provinceCode: { in: provinceScope } } } } : {}),
    },
    include: {
      owner: { select: { id: true, name: true } },
      machines: { select: { id: true, model: true, name: true, serial: true, status: true, installDate: true } },
      _count: { select: { activities: true, tickets: true } },
    }, orderBy: [{ nextContactAt: "asc" }, { updatedAt: "desc" }], take: 1000,
  });
  const staff = await prisma.user.findMany({ where: { active: true, role: { in: ["ADMIN", "CSKH"] } }, select: { id: true, name: true } });
  return NextResponse.json({ success: true, data: { customers, staff } });
}
