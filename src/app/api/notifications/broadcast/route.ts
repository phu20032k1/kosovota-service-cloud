import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { queueEmailBroadcast } from "@/lib/notifications/broadcast";

const AUDIENCES = ["CUSTOMERS", "DEALERS", "USERS", "ALL"] as const;

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const audience = typeof body.audience === "string" ? body.audience.toUpperCase() : "ALL";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!AUDIENCES.includes(audience as typeof AUDIENCES[number])) return NextResponse.json({ success: false, message: "Nhóm nhận không hợp lệ." }, { status: 400 });
  if (!subject || !content) return NextResponse.json({ success: false, message: "Thiếu tiêu đề hoặc nội dung email." }, { status: 400 });

  const result = await queueEmailBroadcast({ audience: audience as typeof AUDIENCES[number], subject, content });
  return NextResponse.json({ success: true, message: `Đã đưa ${result.queued} email vào hàng đợi.`, data: result }, { status: 201 });
}
