import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE } from "@/lib/auth";
import { verifySessionToken } from "@/lib/session-token";
import { consumeOtp, issueOtp } from "@/lib/otp";
import { isValidVietnamPhone, normalizePhone } from "@/lib/phone";

async function getOwnerPhone(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(CUSTOMER_COOKIE)?.value);
  return session?.purpose === "CUSTOMER_LOGIN" ? session.phone : null;
}

function sharePurpose(machineId: string, relativePhone: string) {
  return `SHARE_MACHINE:${machineId}:${relativePhone}`;
}

export async function POST(request: NextRequest) {
  try {
    const ownerPhone = await getOwnerPhone(request);
    if (!ownerPhone) return NextResponse.json({ success: false, message: "Cần xác thực OTP." }, { status: 401 });

    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const relativePhone = normalizePhone(body.relativePhone);

    if (!machineId || !isValidVietnamPhone(relativePhone) || relativePhone === ownerPhone) {
      return NextResponse.json({ success: false, message: "Thông tin chia sẻ chưa hợp lệ." }, { status: 400 });
    }

    const machine = await prisma.machine.findFirst({
      where: { id: machineId, customer: { phone: ownerPhone } },
      select: { id: true },
    });
    if (!machine) return NextResponse.json({ success: false, message: "Không có quyền chia sẻ máy này." }, { status: 403 });

    const otp = await issueOtp({
      phone: ownerPhone,
      purpose: sharePurpose(machineId, relativePhone),
      message: (code) => `KOSOVOTA: Mã xác nhận chia sẻ máy ${machineId} cho số ${relativePhone} là ${code}. Mã có hiệu lực 5 phút.`,
    });

    return NextResponse.json({
      success: true,
      message: "Đã gửi OTP đến số điện thoại chủ máy.",
      ...(otp.debugCode ? { debugCode: otp.debugCode } : {}),
    });
  } catch (error) {
    console.error("POST share-machine failed", error);
    return NextResponse.json({ success: false, message: "Không gửi được mã xác nhận." }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const ownerPhone = await getOwnerPhone(request);
    if (!ownerPhone) return NextResponse.json({ success: false, message: "Cần xác thực OTP." }, { status: 401 });

    const body = await request.json();
    const machineId = typeof body.machineId === "string" ? body.machineId.trim() : "";
    const relativePhone = normalizePhone(body.relativePhone);
    const code = typeof body.otp === "string" ? body.otp.trim() : "";
    const result = await consumeOtp(ownerPhone, sharePurpose(machineId, relativePhone), code);

    if (!result.ok) return NextResponse.json({ success: false, message: result.message }, { status: 400 });

    const machine = await prisma.machine.findFirst({
      where: { id: machineId, customer: { phone: ownerPhone } },
    });
    if (!machine) return NextResponse.json({ success: false, message: "Không có quyền chia sẻ máy này." }, { status: 403 });

    const currentPhones = machine.sharedPhones
      ? machine.sharedPhones.split(",").map((item: string) => item.trim()).filter(Boolean)
      : [];
    const nextPhones = Array.from(new Set([...currentPhones, relativePhone]));

    await prisma.machine.update({ where: { id: machineId }, data: { sharedPhones: nextPhones.join(",") } });
    return NextResponse.json({ success: true, message: "Đã chia sẻ máy cho người thân." });
  } catch (error) {
    console.error("PUT share-machine failed", error);
    return NextResponse.json({ success: false, message: "Không chia sẻ được máy." }, { status: 500 });
  }
}
