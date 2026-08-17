import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkDistributedRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rate = await checkDistributedRateLimit(request, {
    namespace: "machine-activate",
    limit: 30,
    windowMs: 5 * 60 * 1000,
  });
  if (!rate.allowed) {
    return NextResponse.json(
      { success: false, message: "Thao tác kích hoạt quá nhiều lần. Vui lòng thử lại sau." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  try {
    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const customerId = typeof body.customerId === "string" && body.customerId.trim() ? body.customerId.trim() : null;

    if (!machineId) {
      return NextResponse.json({ success: false, message: "Thiếu ID máy." }, { status: 400 });
    }

    const machine = await prisma.machine.findUnique({ where: { id: machineId } });
    if (!machine) {
      return NextResponse.json({ success: false, message: "Không tìm thấy máy." }, { status: 404 });
    }

    const updated = await prisma.machine.update({
      where: { id: machineId },
      data: {
        customerId,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      success: true,
      machine: updated,
    });
  } catch (error) {
    console.error("POST /api/machines/activate failed", error);
    return NextResponse.json({ success: false, message: "Không thể kích hoạt máy lúc này." }, { status: 500 });
  }
}
