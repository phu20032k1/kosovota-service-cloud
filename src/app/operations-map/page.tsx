"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type Schedule = { id: string; title: string; dueDate: string; status: string };
type Machine = { id: string; model: string; serial?: string | null; status: string; lat?: number | null; lng?: number | null; customer?: { name: string; phone: string; address?: string | null } | null; maintenanceSchedules?: Schedule[] };
type Dealer = { id: string; dealerCode: string; name: string; phone: string; address?: string | null; province?: string | null; lat?: number | null; lng?: number | null; services?: string | null; technicianCount?: number | null; rating?: number | null; status: string };
type ShortlistDealer = Dealer & { distanceKm: number };

type Selection = { kind: "machine"; id: string } | { kind: "dealer"; id: string } | null;

export default function OperationsMapPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [showMachines, setShowMachines] = useState(true);
  const [showDealers, setShowDealers] = useState(true);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success"|"error"|"info"; text: string } | null>(null);
  const [serviceType, setServiceType] = useState("Kiểm tra và bảo trì máy");
  const [radius, setRadius] = useState(20);
  const [shortlist, setShortlist] = useState<ShortlistDealer[]>([]);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    try {
      const [machineResponse, dealerResponse] = await Promise.all([fetch("/api/machines", { cache: "no-store" }), fetch("/api/dealers", { cache: "no-store" })]);
      const [machineResult, dealerResult] = await Promise.all([machineResponse.json(), dealerResponse.json()]);
      if (!machineResponse.ok || !machineResult.success) throw new Error(machineResult.message || "Không tải được máy.");
      if (!dealerResponse.ok || !dealerResult.success) throw new Error(dealerResult.message || "Không tải được đại lý.");
      setMachines(machineResult.data || []);
      setDealers((dealerResult.data || []).filter((d: Dealer) => d.status === "APPROVED"));
      const requested = new URLSearchParams(window.location.search).get("machine");
      if (requested && (machineResult.data || []).some((m: Machine) => m.id === requested)) setSelection({ kind: "machine", id: requested });
    } catch (value) { setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tải được dữ liệu." }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleMachines = useMemo(() => machines.filter((m) => m.lat != null && m.lng != null).filter((m) => !normalizedSearch || `${m.id} ${m.model} ${m.customer?.name || ""} ${m.customer?.phone || ""} ${m.customer?.address || ""}`.toLowerCase().includes(normalizedSearch)), [machines, normalizedSearch]);
  const visibleDealers = useMemo(() => dealers.filter((d) => d.lat != null && d.lng != null).filter((d) => !normalizedSearch || `${d.dealerCode} ${d.name} ${d.phone} ${d.services || ""} ${d.address || ""}`.toLowerCase().includes(normalizedSearch)), [dealers, normalizedSearch]);
  const markers: MapMarker[] = [
    ...(showMachines ? visibleMachines.map((m) => ({ id: `machine:${m.id}`, lat: m.lat!, lng: m.lng!, title: m.id, subtitle: m.customer?.name || m.model, color: machineColor(m), glyph: "droplet" as const })) : []),
    ...(showDealers ? visibleDealers.map((d) => ({ id: `dealer:${d.id}`, lat: d.lat!, lng: d.lng!, title: d.name, subtitle: `${d.dealerCode} · ${d.phone}`, color: "#2563eb", glyph: "store" as const })) : []),
  ];
  const activeMarkerId = selection ? `${selection.kind}:${selection.id}` : null;
  const selectedMachine = selection?.kind === "machine" ? machines.find((m) => m.id === selection.id) || null : null;
  const selectedDealer = selection?.kind === "dealer" ? dealers.find((d) => d.id === selection.id) || null : null;

  function selectMarker(markerId: string) {
    const [kind, ...rest] = markerId.split(":");
    setSelection(kind === "machine" ? { kind: "machine", id: rest.join(":") } : { kind: "dealer", id: rest.join(":") });
    setShortlist([]);
  }

  async function findDealers() {
    if (!selectedMachine) return;
    setBusy(true); setNotice(null); setShortlist([]);
    try {
      const response = await fetch("/api/dealers/shortlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineId: selectedMachine.id, serviceType, limit: 30 }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tìm được đại lý.");
      const items = (result.data || []).filter((d: ShortlistDealer) => d.distanceKm <= radius);
      setShortlist(items);
      setNotice({ kind: "info", text: items.length ? `Tìm thấy ${items.length} đại lý phù hợp trong bán kính ${radius} km.` : `Chưa có đại lý phù hợp trong bán kính ${radius} km.` });
    } catch (value) { setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tìm được đại lý." }); }
    finally { setBusy(false); }
  }

  async function createAndAssign(dealer: ShortlistDealer) {
    if (!selectedMachine) return;
    setBusy(true); setNotice(null);
    try {
      const assignResponse = await fetch("/api/service-orders/assign-dealer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ machineId: selectedMachine.id, serviceType, dealerId: dealer.id }) });
      const assignResult = await assignResponse.json();
      if (!assignResponse.ok || !assignResult.success) throw new Error(assignResult.message || "Không giao được lệnh.");
      setNotice({ kind: "success", text: `Đã tạo lệnh ${assignResult.data.orderCode} và giao cho ${dealer.name}. Thông báo đã được đưa vào hàng đợi.` });
      setShortlist([]);
    } catch (value) { setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không tạo được lệnh." }); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-50/70"><OperationsHeader title="Bản đồ điều phối hợp nhất" subtitle="Kết nối vị trí máy với đại lý/CTV phù hợp gần nhất" actions={<button type="button" onClick={load} className="icon-button"><Icon name="refresh" size={18}/></button>}/><section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
    {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
    <div className="surface-card grid gap-3 p-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto_auto]">
      <label className="relative"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm máy, khách hàng, đại lý hoặc năng lực" className="pl-11"/></label>
      <button type="button" onClick={() => setShowMachines((v) => !v)} className={`btn-secondary ${showMachines ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "opacity-60"}`}><Icon name="droplet" size={17}/> Máy ({visibleMachines.length})</button>
      <button type="button" onClick={() => setShowDealers((v) => !v)} className={`btn-secondary ${showDealers ? "border-blue-400 bg-blue-50 text-blue-800" : "opacity-60"}`}><Icon name="store" size={17}/> Đại lý ({visibleDealers.length})</button>
      <button type="button" onClick={() => { setSearch(""); setSelection(null); setShortlist([]); }} className="btn-secondary"><Icon name="x" size={17}/> Làm mới</button>
    </div>
    {loading ? <LoadingState label="Đang tải bản đồ điều phối..."/> : <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_410px]"><InteractiveMap markers={markers} activeId={activeMarkerId} onSelect={selectMarker} height={740}/><aside className="surface-card h-[740px] overflow-y-auto p-5">{selectedMachine ? <MachineDispatchPanel machine={selectedMachine} serviceType={serviceType} setServiceType={setServiceType} radius={radius} setRadius={setRadius} busy={busy} shortlist={shortlist} onFind={findDealers} onAssign={createAndAssign}/> : selectedDealer ? <DealerPanel dealer={selectedDealer}/> : <EmptyPanel/>}</aside></div>}
  </section></main>;
}

function machineColor(machine: Machine) { const due = (machine.maintenanceSchedules || []).filter((s) => !["COMPLETED","DISABLED","SELF_SERVICE"].includes(s.status)).map((s) => +new Date(s.dueDate)); if (["INACTIVE","BROKEN","STOPPED"].includes(machine.status)) return "#475569"; if (due.some((d) => d < Date.now())) return "#e11d48"; if (due.some((d) => d < Date.now() + 30 * 86400000)) return "#d97706"; return "#059669"; }
function MachineDispatchPanel({ machine, serviceType, setServiceType, radius, setRadius, busy, shortlist, onFind, onAssign }: { machine: Machine; serviceType: string; setServiceType: (v:string)=>void; radius:number; setRadius:(v:number)=>void; busy:boolean; shortlist:ShortlistDealer[]; onFind:()=>void; onAssign:(d:ShortlistDealer)=>void }) { const next = (machine.maintenanceSchedules || []).filter((s) => !["COMPLETED","DISABLED","SELF_SERVICE"].includes(s.status)).sort((a,b)=>+new Date(a.dueDate)-+new Date(b.dueDate))[0]; return <div><span className="status-pill status-green"><Icon name="droplet" size={14}/> Máy khách hàng</span><h2 className="mt-3 text-xl font-extrabold">{machine.id}</h2><p className="mt-1 text-sm text-slate-500">{machine.model}{machine.serial ? ` · ${machine.serial}` : ""}</p><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4"><Info label="Khách hàng" value={machine.customer?.name || "—"}/><Info label="Điện thoại" value={machine.customer?.phone || "—"}/><Info label="Địa chỉ" value={machine.customer?.address || "—"}/><Info label="Lịch gần nhất" value={next ? `${next.title} · ${new Date(next.dueDate).toLocaleDateString("vi-VN")}` : "Không có lịch mở"}/></div><div className="mt-5"><label className="block"><span className="mb-2 block text-sm font-bold text-slate-700">Dịch vụ cần điều phối</span><input value={serviceType} onChange={(e)=>setServiceType(e.target.value)} placeholder="Ví dụ: Thay lõi 1,2,3"/></label><label className="mt-4 block"><span className="mb-2 flex items-center justify-between text-sm font-bold text-slate-700"><span>Bán kính tìm kiếm</span><strong className="text-emerald-700">{radius} km</strong></span><input type="range" min="5" max="100" step="5" value={radius} onChange={(e)=>setRadius(Number(e.target.value))} className="w-full accent-emerald-600"/></label><button type="button" disabled={busy || !serviceType.trim()} onClick={onFind} className="btn-primary mt-4 flex w-full items-center justify-center gap-2 px-4 py-3 font-bold text-white disabled:opacity-50"><Icon name="search" size={18}/>{busy ? "ĐANG TÌM..." : "TÌM ĐẠI LÝ PHÙ HỢP"}</button></div>{shortlist.length > 0 && <div className="mt-6"><div className="flex items-center justify-between"><h3 className="font-extrabold">Danh sách gần nhất</h3><span className="status-pill status-blue">{shortlist.length} kết quả</span></div><div className="mt-3 space-y-3">{shortlist.map((dealer,index)=><article key={dealer.id} className="soft-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-extrabold text-blue-700">#{index+1} · {dealer.dealerCode}</p><h4 className="mt-1 font-extrabold">{dealer.name}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{dealer.services || "Chưa cập nhật năng lực"}</p></div><strong className="whitespace-nowrap text-sm text-emerald-700">{dealer.distanceKm} km</strong></div><div className="mt-3 flex gap-2"><a href={`tel:${dealer.phone}`} className="btn-secondary flex-1 py-2 text-sm"><Icon name="phone" size={16}/> Gọi</a><button type="button" disabled={busy} onClick={()=>onAssign(dealer)} className="btn-primary flex-[1.35] px-3 py-2 text-sm font-bold text-white disabled:opacity-50"><span className="inline-flex items-center gap-1.5"><Icon name="send" size={16}/> Tạo & giao lệnh</span></button></div></article>)}</div></div>}</div>; }
function DealerPanel({ dealer }: { dealer: Dealer }) { return <div><span className="status-pill status-blue"><Icon name="store" size={14}/> Đại lý/CTV</span><h2 className="mt-3 text-xl font-extrabold">{dealer.name}</h2><p className="mt-1 text-sm font-bold text-blue-700">{dealer.dealerCode}</p><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4"><Info label="Điện thoại" value={dealer.phone}/><Info label="Địa chỉ" value={[dealer.address,dealer.province].filter(Boolean).join(", ") || "—"}/><Info label="Kỹ thuật viên" value={`${dealer.technicianCount || 0} người`}/><Info label="Đánh giá" value={`${dealer.rating ?? 5}/5`}/><Info label="Năng lực" value={dealer.services || "—"}/></div><a href={`tel:${dealer.phone}`} className="btn-primary mt-5 flex items-center justify-center gap-2 px-4 py-3 font-bold text-white"><Icon name="phone" size={18}/> Gọi đại lý</a></div>; }
function EmptyPanel() { return <div className="flex h-full flex-col items-center justify-center text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name="layers" size={30}/></span><h2 className="mt-4 text-xl font-extrabold">Hai lớp dữ liệu trên một bản đồ</h2><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Chọn máy để tìm đại lý gần nhất và giao lệnh; chọn đại lý để xem năng lực và thông tin liên hệ.</p><div className="mt-5 grid w-full grid-cols-2 gap-3"><div className="soft-card p-4"><Icon name="droplet" className="mx-auto text-emerald-600"/><strong className="mt-2 block">Marker xanh/đỏ</strong><span className="text-xs text-slate-500">Máy khách hàng</span></div><div className="soft-card p-4"><Icon name="store" className="mx-auto text-blue-600"/><strong className="mt-2 block">Marker xanh lam</strong><span className="text-xs text-slate-500">Đại lý/CTV</span></div></div></div>; }
function Info({ label, value }: { label:string; value:string }) { return <div><p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-sm font-semibold text-slate-900">{value}</p></div>; }
