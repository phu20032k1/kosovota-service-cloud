import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await hasRole(request, ["ADMIN", "CSKH"]);
    if (!auth) {
      const machine = await prisma.machine.findUnique({
        where: { id },
        select: { id: true, model: true, name: true, capacity: true, warrantyMonths: true, serial: true, status: true, manufactureDate: true, installDate: true },
      });
      if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
      return NextResponse.json({ success: true, data: machine, limited: true });
    }
    const machine = await prisma.machine.findUnique({
      where: { id },
      include: {
        customer: true,
        activations: { orderBy: { step: "asc" } },
        serviceOrders: { orderBy: { createdAt: "desc" } },
        serviceReports: { orderBy: { createdAt: "desc" } },
        maintenanceSchedules: { orderBy: { dueDate: "asc" } },
      },
    });
    if (!machine) return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    return NextResponse.json({ success: true, data: machine });
  } catch (error) {
    console.error("GET machine failed", error);
    return NextResponse.json({ success: false, message: "Không tải được thông tin máy." }, { status: 500 });
  }
}
