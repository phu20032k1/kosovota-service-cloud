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

const STOP_WORDS = new Set(["kiem", "tra", "may", "dich", "vu", "va", "cho", "can", "lam"]);
function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").toLowerCase();
}
function serviceScore(serviceType: string, services?: string | null) {
  if (!serviceType) return 0;
  const haystack = normalize(services || "");
  const tokens = normalize(serviceType).split(/[^a-z0-9]+/).filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function isTechnicalDealer(dealer: { dealerCode: string; registrationType?: string | null; technicianCount?: number | null }) {
  const registration = normalize(dealer.registrationType || "");
  if (/commercial|thuong mai/.test(registration)) return false;
  if (/service|dich vu|collaborator|cong tac|freelancer|ctv/.test(registration)) return true;
  if (/ctv/.test(normalize(dealer.dealerCode))) return true;
  return (dealer.technicianCount || 0) > 0;
}

export async function POST(request: NextRequest) {
  const auth = await hasRole(request, ["ADMIN", "CSKH"]);
  if (!auth) return NextResponse.json({ success: false, message: "Chưa được cấp quyền." }, { status: 401 });
  const body = await request.json();
  const limit = Math.min(30, Math.max(5, Number(body.limit) || 10));
  const serviceType = typeof body.serviceType === "string" ? body.serviceType.trim() : "";
  const machine = await prisma.machine.findUnique({ where: { id: body.machineId } });
  if (!machine || machine.lat === null || machine.lng === null) return NextResponse.json({ success: false, message: "Máy chưa có tọa độ GPS." }, { status: 404 });
  const scopes = auth.user.provinceScope?.split(",").map((value: string) => value.trim()).filter(Boolean) || [];
  if (auth.user.role === "CSKH" && scopes.length && (!machine.provinceCode || !scopes.includes(machine.provinceCode))) {
    return NextResponse.json({ success: false, message: "Máy nằm ngoài phạm vi được phân công." }, { status: 403 });
  }

  const dealers = await prisma.dealer.findMany({ where: { status: "APPROVED", lat: { not: null }, lng: { not: null } } });
  const shortlist = dealers
    .filter(isTechnicalDealer)
    .map((dealer) => {
      const matchScore = serviceScore(serviceType, dealer.services);
      return {
        ...dealer,
        serviceMatchScore: matchScore,
        capabilityMatched: serviceType ? matchScore > 0 : true,
        distanceKm: Number(distanceKm(machine.lat!, machine.lng!, dealer.lat!, dealer.lng!).toFixed(2)),
      };
    })
    .sort((a, b) => b.serviceMatchScore - a.serviceMatchScore || a.distanceKm - b.distanceKm)
    .slice(0, limit)
    .map((dealer, index) => ({ ...dealer, rank: index + 1 }));

  return NextResponse.json({ success: true, data: shortlist });
}
