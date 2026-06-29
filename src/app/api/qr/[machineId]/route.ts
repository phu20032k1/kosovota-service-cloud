import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { qrLandingUrl } from "@/lib/qr";

export async function GET(request: NextRequest, { params }: { params: Promise<{ machineId: string }> }) {
  const { machineId: rawMachineId } = await params;
  const machineId = decodeURIComponent(rawMachineId).trim();
  if (!machineId) return NextResponse.json({ success: false, message: "Thiếu mã máy." }, { status: 400 });

  const machine = await prisma.machine.findUnique({ where: { id: machineId }, select: { id: true } });
  if (!machine) return NextResponse.json({ success: false, message: "Mã máy chưa có trong hệ thống." }, { status: 404 });

  const size = Math.min(Math.max(Number(request.nextUrl.searchParams.get("size")) || 480, 180), 1200);
  const format = request.nextUrl.searchParams.get("format") === "png" ? "png" : "svg";
  const target = qrLandingUrl(machineId, process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin);

  if (format === "png") {
    const png = await QRCode.toBuffer(target, { type: "png", width: size, margin: 2, errorCorrectionLevel: "H" });
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `inline; filename="KOSOVOTA-${machineId}.png"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  const svg = await QRCode.toString(target, { type: "svg", width: size, margin: 2, errorCorrectionLevel: "H" });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Content-Disposition": `inline; filename="KOSOVOTA-${machineId}.svg"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
