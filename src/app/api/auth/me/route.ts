import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await getActiveUser(request);
  if (!auth) {
    return NextResponse.json({ success: false, message: "Chưa đăng nhập." }, { status: 401 });
  }

  return NextResponse.json({
    success: true,
    user: {
      id: auth.user.id,
      name: auth.user.name,
      phone: auth.user.phone,
      role: auth.user.role,
      dealerCode: auth.user.dealerCode,
      provinceScope: auth.user.provinceScope,
    },
  });
}
