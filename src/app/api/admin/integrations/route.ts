import { NextRequest, NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chỉ Admin được xem cấu hình tích hợp." }, { status: 403 });

  const mapProvider = (process.env.NEXT_PUBLIC_MAP_PROVIDER || "osm").toLowerCase();
  const geocodingProvider = (process.env.GEOCODING_PROVIDER || "maptiler").toLowerCase();
  const data = {
    map: {
      provider: mapProvider,
      ready: mapProvider === "osm" || (mapProvider === "google" ? Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) : Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY)),
      browserKeyConfigured: mapProvider === "google" ? Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) : mapProvider === "maptiler" ? Boolean(process.env.NEXT_PUBLIC_MAPTILER_KEY) : true,
    },
    geocoding: {
      enabled: process.env.GEOCODING_ENABLED === "true",
      provider: geocodingProvider,
      ready: geocodingProvider === "google" ? Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY) : Boolean(process.env.MAPTILER_SERVER_API_KEY),
    },
    notifications: {
      dryRun: process.env.NOTIFICATION_DRY_RUN !== "false",
      otpChannel: (process.env.OTP_CHANNEL || "SMS").toUpperCase(),
    },
    sms: {
      provider: (process.env.SMS_PROVIDER || "esms").toLowerCase(),
      ready: Boolean(process.env.ESMS_API_KEY && process.env.ESMS_SECRET_KEY && process.env.ESMS_BRANDNAME),
      sandbox: process.env.ESMS_SANDBOX === "true",
    },
    zalo: {
      provider: "zbs",
      ready: Boolean(process.env.ZALO_ZBS_ACCESS_TOKEN && (process.env.ZALO_ZBS_TEMPLATE_ID || process.env.ZALO_ZBS_OTP_TEMPLATE_ID)),
      otpTemplate: Boolean(process.env.ZALO_ZBS_OTP_TEMPLATE_ID),
      serviceOrderTemplate: Boolean(process.env.ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID),
    },
    email: { ready: Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD), from: process.env.EMAIL_FROM || process.env.GMAIL_USER || "" },
  };
  return NextResponse.json({ success: true, data });
}
