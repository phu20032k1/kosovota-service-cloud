import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { geocodeAddress } from "@/lib/maps/geocode";

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const address = typeof body.address === "string" ? body.address.trim() : "";
  if (!address) return NextResponse.json({ success: false, message: "Vui lòng nhập địa chỉ." }, { status: 400 });
  try {
    const result = await geocodeAddress(address);
    if (!result) return NextResponse.json({ success: false, message: "Không tìm thấy tọa độ phù hợp." }, { status: 404 });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Không định vị được địa chỉ." }, { status: 502 });
  }
}
