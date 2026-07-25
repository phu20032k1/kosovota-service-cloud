import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [machines, dealers] = await Promise.all([
      prisma.machine.findMany({
        where: { lat: { not: null }, lng: { not: null } },
        select: { id: true, model: true, name: true, status: true, lat: true, lng: true, provinceCode: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.dealer.findMany({
        where: { status: "APPROVED", lat: { not: null }, lng: { not: null } },
        select: { id: true, dealerCode: true, name: true, province: true, lat: true, lng: true, services: true, rating: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({ success: true, data: { machines, dealers } });
  } catch (error) {
    console.error("GET /api/public-map failed", error);
    return NextResponse.json({ success: false, message: "Không tải được dữ liệu bản đồ." }, { status: 500 });
  }
}
