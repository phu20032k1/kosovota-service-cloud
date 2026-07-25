"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import { Icon } from "@/components/ui/Icon";
import { readApiResponse } from "@/lib/client-api";

type Machine = { id: string; model: string; name?: string | null; status: string; lat: number | null; lng: number | null; provinceCode?: string | null };
type Dealer = { id: string; dealerCode: string; name: string; province?: string | null; lat: number | null; lng: number | null; services?: string | null; rating?: number | null };
type MapData = { machines: Machine[]; dealers: Dealer[] };

export default function PublicNetworkMap({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<MapData>({ machines: [], dealers: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showMachines, setShowMachines] = useState(true);
  const [showDealers, setShowDealers] = useState(true);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/public-map", { cache: "no-store" });
      const result = await readApiResponse<MapData>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được bản đồ.");
      setData(result.data || { machines: [], dealers: [] });
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được bản đồ.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const markers = useMemo<MapMarker[]>(() => [
    ...(showMachines ? data.machines.filter((item) => item.lat != null && item.lng != null).map((item) => ({ id: `machine:${item.id}`, lat: item.lat!, lng: item.lng!, title: item.name || item.model, subtitle: `${item.model} · ${item.provinceCode || "Đang hoạt động"}`, color: "#059669", glyph: "droplet" as const })) : []),
    ...(showDealers ? data.dealers.filter((item) => item.lat != null && item.lng != null).map((item) => ({ id: `dealer:${item.id}`, lat: item.lat!, lng: item.lng!, title: item.name, subtitle: `${item.dealerCode} · ${item.province || "KOSOVOTA"}`, color: "#2563eb", glyph: "store" as const })) : []),
  ], [data, showMachines, showDealers]);

  return <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,.12)]">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Dữ liệu đồng bộ từ Admin</p><h3 className="mt-1 text-xl font-black text-slate-950 sm:text-2xl">Mạng lưới máy và đại lý KOSOVOTA</h3></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setShowMachines((v) => !v)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${showMachines ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}><Icon name="droplet" size={15}/> {data.machines.length} máy</button>
        <button type="button" onClick={() => setShowDealers((v) => !v)} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${showDealers ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500"}`}><Icon name="store" size={15}/> {data.dealers.length} đại lý</button>
      </div>
    </div>
    <div className="relative">
      {loading ? <div className="grid h-[420px] place-items-center bg-slate-50 text-slate-500"><span className="inline-flex items-center gap-2 font-bold"><Icon name="refresh" className="animate-spin"/> Đang tải dữ liệu bản đồ...</span></div> : error ? <div className="grid h-[420px] place-items-center bg-rose-50 p-8 text-center text-rose-700"><div><Icon name="alert" size={32} className="mx-auto"/><p className="mt-3 font-black">{error}</p><button type="button" onClick={() => void load()} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-black shadow-sm">Tải lại</button></div></div> : <InteractiveMap markers={markers} activeId={activeId} onSelect={setActiveId} height={compact ? 420 : 650}/>} 
    </div>
    {compact && <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 p-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm leading-6 text-slate-600">Bản đồ tổng hợp vị trí máy và đại lý đã được Admin nhập lên hệ thống.</p><Link href="/map" className="btn-primary inline-flex shrink-0 items-center justify-center gap-2 px-5 py-3 text-sm font-black text-white">Xem bản đồ chi tiết <Icon name="chevron-right" size={17}/></Link></div>}
  </div>;
}
