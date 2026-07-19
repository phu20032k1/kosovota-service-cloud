import { NextRequest, NextResponse } from "next/server";
import { getActiveUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { storeUpload, UPLOAD_TYPES } from "@/lib/storage";

const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_VIDEO = 40 * 1024 * 1024;
const PUBLIC_PURPOSES = new Set(["dealer-registration"]);
const INTERNAL_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "CSKH", "DEALER", "CTV", "KTV"]);

export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(request, { namespace: "upload", limit: 20, windowMs: 10 * 60 * 1000 });
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, message: "Bạn tải tệp quá nhanh. Vui lòng thử lại sau." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const purpose = String(formData.get("purpose") || "service-evidence").trim().toLowerCase();
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "Không có tệp tải lên." }, { status: 400 });
    }

    const isPublicRegistration = PUBLIC_PURPOSES.has(purpose);
    if (!isPublicRegistration) {
      const auth = await getActiveUser(request);
      if (!auth || !INTERNAL_ROLES.has(auth.user.role)) {
        return NextResponse.json({ success: false, message: "Cần đăng nhập để tải tệp." }, { status: 401 });
      }
    }

    const extension = UPLOAD_TYPES[file.type];
    if (!extension) {
      return NextResponse.json(
        { success: false, message: "Chỉ hỗ trợ ảnh JPG/PNG/WebP/HEIC và video MP4/WebM/MOV." },
        { status: 415 },
      );
    }

    const isVideo = file.type.startsWith("video/");
    if (file.size <= 0 || file.size > (isVideo ? MAX_VIDEO : MAX_IMAGE)) {
      return NextResponse.json(
        { success: false, message: isVideo ? "Video tối đa 40 MB." : "Ảnh tối đa 8 MB." },
        { status: 413 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await storeUpload({ buffer, contentType: file.type, purpose });
    return NextResponse.json({ success: true, url });
  } catch (error) {
    console.error("upload failed", error);
    return NextResponse.json(
      {
        success: false,
        message: process.env.NODE_ENV === "production"
          ? "Tải tệp thất bại."
          : error instanceof Error ? error.message : "Tải tệp thất bại.",
      },
      { status: 500 },
    );
  }
}
