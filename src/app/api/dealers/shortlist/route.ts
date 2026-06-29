import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasRole } from "@/lib/auth";

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const limit = Math.min(30, Math.max(5, Number(body.limit) || 10));
  const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim().toLowerCase() : "";
  const machine = await prisma.machine.findUnique({ where: { id: body.machineId } });
  if (!machine || machine.lat === null || machine.lng === null) return NextResponse.json({ success: false, message: "Máy chưa có tọa độ GPS." }, { status: 404 });
  const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
  if (auth.user.role === "CSKH" && scopes.length && (!machine.provinceCode || !scopes.includes(machine.provinceCode))) {
    return NextResponse.json({ success: false, message: "Máy nằm ngoài phạm vi được phân công." }, { status: 403 });
  }

  const dealers = await prisma.dealer.findMany({ where: { status: "APPROVED", lat: { not: null }, lng: { not: null } } });
  const tokens: string[] = serviceType.split(/\s+/).filter((token: string) => token.length > 3);
  const shortlist = dealers
    .filter((dealer: { services?: string | null }) => !tokens.length || tokens.some((token: string) => (dealer.services || "").toLowerCase().includes(token)))
    .map((dealer: { lat: number | null; lng: number | null; [key: string]: unknown }) => ({ ...dealer, distanceKm: Number(distanceKm(machine.lat!, machine.lng!, dealer.lat!, dealer.lng!).toFixed(2)) }))
    .sort((a: { distanceKm: number }, b: { distanceKm: number }) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
  return NextResponse.json({ success: true, data: shortlist });
}
