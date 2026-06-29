import { NextResponse } from "next/server";

function deprecated() {
  return NextResponse.json(
    {
      success: false,
      message: "API này đã được thay thế. Hãy dùng luồng /api/auth/forgot-password/request, /verify và /reset.",
    },
    { status: 410 },
  );
}

export async function POST() {
  return deprecated();
}

export async function PUT() {
  return deprecated();
}
