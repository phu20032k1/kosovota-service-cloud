import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await getActiveUser(request);
    if (!auth) {
      return NextResponse.json({ success: false, authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      user: {
        id: auth.user.id,
        name: auth.user.name,
        phone: auth.user.phone,
        role: auth.user.role,
        dealerCode: auth.user.dealerCode,
        provinceScope: auth.user.provinceScope,
      },
    });
  } catch (error) {
    console.error("GET /api/auth/session failed", error);
    return NextResponse.json({ success: false, authenticated: false }, { status: 500 });
  }
}
