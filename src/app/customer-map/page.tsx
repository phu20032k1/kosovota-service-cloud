"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

 type MachineStatus = "active" | "due" | "overdue" | "inactive";
 type Schedule = { title: string; dueDate: string; status: string };
 type Machine = {
  id: string; model: string; serial?: string | null; status: string; installDate?: string | null;
  lat?: number | null; lng?: number | null; buildingPhoto?: string | null; machinePhoto?: string | null;
  customer?: { name: string; phone: string; address?: string | null } | null;
  maintenanceSchedules?: Schedule[];
};

const STATUS_META: Record<MachineStatus, { label: string; color: string; className: string }> = {
  active: { label: "Hoạt động tốt", color: "#059669", className: "status-green" },
  due: { label: "Sắp đến hạn", color: "#d97706", className: "status-amber" },
  overdue: { label: "Quá hạn / cần sửa", color: "#e11d48", className: "status-red" },
  inactive: { label: "Ngừng sử dụng", color: "#475569", className: "status-slate" },
};

function statusOf(machine: Machine): MachineStatus {
  if (["INACTIVE", "BROKEN", "STOPPED"].includes(machine.status)) return "inactive";
  const pending = (machine.maintenanceSchedules || []).filter((s) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(s.status));
  if (pending.some((s) => new Date(s.dueDate).getTime() < Date.now())) return "overdue";
  if (pending.some((s) => new Date(s.dueDate).getTime() < Date.now() + 30 * 86400000)) return "due";
  return "active";
}
function formatDate(value?: string | null) { return value ? new Date(value).toLocaleDateString("vi-VN") : "—"; }

export default function CustomerMapPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MachineStatus | "">("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/machines", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được danh sách máy.");
      setMachines(result.data || []);
    } catch (value) { setError(value instanceof Error ? value.message : "Không tải được dữ liệu."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const models = useMemo(() => [...new Set(machines.map((m) => m.model).filter(Boolean))].sort(), [machines]);
  const filtered = useMemo(() => machines.filter((machine) => {
    const text = `${machine.id} ${machine.serial || ""} ${machine.model} ${machine.customer?.name || ""} ${machine.customer?.phone || ""} ${machine.customer?.address || ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!status || statusOf(machine) === status) && (!model || machine.model === model);
  }), [machines, search, status, model]);
  const located = filtered.filter((m) => m.lat != null && m.lng != null);
  const selected = machines.find((m) => m.id === selectedId) || null;
  const markers: MapMarker[] = located.map((machine) => ({ id: machine.id, lat: machine.lat!, lng: machine.lng!, title: machine.id, subtitle: machine.customer?.name || machine.model, color: STATUS_META[statusOf(machine)].color, glyph: "droplet" }));
  const counts = (Object.keys(STATUS_META) as MachineStatus[]).map((key) => ({ key, value: machines.filter((m) => statusOf(m) === key).length }));
  const missingGps = machines.filter((m) => m.lat == null || m.lng == null).length;

  return (
    <main className="min-h-screen bg-slate-50/70">
      <OperationsHeader title="Bản đồ máy khách hàng" subtitle="Theo dõi vị trí, trạng thái và vòng đời thiết bị" actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>} />
      <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
        {error && <Notice kind="error">{error}</Notice>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {counts.map(({ key, value }) => <button type="button" key={key} onClick={() => setStatus(status === key ? "" : key)} className={`surface-card flex items-center justify-between gap-3 p-4 text-left ${status === key ? "ring-2 ring-emerald-500" : ""}`}><span><span className={`status-pill ${STATUS_META[key].className}`}>{STATUS_META[key].label}</span><strong className="mt-2 block text-2xl font-extrabold text-slate-950">{value}</strong></span><span className="h-3 w-3 rounded-full" style={{ background: STATUS_META[key].color }}/></button>)}
          <div className="surface-card flex items-center gap-3 p-4"><span className="metric-icon metric-slate"><Icon name="navigation"/></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Thiếu GPS</p><p className="mt-1 text-2xl font-extrabold">{missingGps}</p></div></div>
        </div>

        <div className="surface-card grid gap-3 p-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative block"><Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm ID, seri, khách hàng, số điện thoại hoặc địa chỉ" className="pl-11"/></label>
          <select value={model} onChange={(e) => setModel(e.target.value)}><option value="">Tất cả dòng máy</option>{models.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" onClick={() => { setSearch(""); setStatus(""); setModel(""); }} className="btn-secondary"><Icon name="x" size={17}/> Xóa lọc</button>
        </div>

        {loading ? <LoadingState label="Đang tải dữ liệu máy..."/> : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
            <InteractiveMap markers={markers} activeId={selectedId} onSelect={setSelectedId} height={690}/>
            <aside className="surface-card min-h-[320px] overflow-hidden p-5 xl:h-[690px] xl:overflow-y-auto">
              {selected ? <MachineDetail machine={selected} onClose={() => setSelectedId(null)}/> : <div className="flex h-full min-h-[300px] flex-col justify-center text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name="map-pin" size={30}/></span><h2 className="mt-4 text-xl font-extrabold">Chọn một điểm máy</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">Bấm marker trên bản đồ để xem khách hàng, ảnh xác thực, trạng thái và lịch bảo trì.</p><Link href="/operations-map" className="btn-primary mx-auto mt-5 inline-flex items-center gap-2 px-4 py-3 font-bold text-white"><Icon name="layers" size={18}/> Mở bản đồ điều phối</Link></div>}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function MachineDetail({ machine, onClose }: { machine: Machine; onClose: () => void }) {
  const currentStatus = statusOf(machine);
  const nextSchedule = (machine.maintenanceSchedules || []).filter((s) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(s.status)).sort((a,b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  return <div>
    <div className="flex items-start justify-between gap-3"><div><span className={`status-pill ${STATUS_META[currentStatus].className}`}>{STATUS_META[currentStatus].label}</span><h2 className="mt-3 text-xl font-extrabold text-slate-950">{machine.id}</h2><p className="mt-1 text-sm text-slate-500">{machine.model}{machine.serial ? ` · ${machine.serial}` : ""}</p></div><button type="button" onClick={onClose} className="icon-button"><Icon name="x" size={18}/></button></div>
    <div className="mt-5 space-y-4">
      <Info icon="user" label="Khách hàng" value={machine.customer?.name || "Chưa cập nhật"}/>
      <Info icon="phone" label="Số điện thoại" value={machine.customer?.phone || "—"}/>
      <Info icon="map-pin" label="Địa chỉ" value={machine.customer?.address || "—"}/>
      <Info icon="calendar" label="Ngày lắp đặt" value={formatDate(machine.installDate)}/>
      <Info icon="clock" label="Chăm sóc tiếp theo" value={nextSchedule ? `${nextSchedule.title} · ${formatDate(nextSchedule.dueDate)}` : "Không còn lịch mở"}/>
    </div>
    {(machine.buildingPhoto || machine.machinePhoto) && <div className="mt-5 grid grid-cols-2 gap-2">{machine.buildingPhoto && <a href={machine.buildingPhoto} target="_blank" className="btn-secondary text-sm"><Icon name="building" size={17}/> Mặt tiền</a>}{machine.machinePhoto && <a href={machine.machinePhoto} target="_blank" className="btn-secondary text-sm"><Icon name="camera" size={17}/> Vị trí máy</a>}</div>}
    <div className="mt-5 grid gap-2"><Link href={`/qr/${machine.id}`} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 font-bold text-white"><Icon name="qr" size={18}/> Mở hồ sơ QR</Link><Link href={`/operations-map?machine=${encodeURIComponent(machine.id)}`} className="btn-secondary"><Icon name="route" size={18}/> Tìm đại lý & điều phối</Link></div>
  </div>;
}
function Info({ icon, label, value }: { icon: "user"|"phone"|"map-pin"|"calendar"|"clock"; label: string; value: string }) { return <div className="flex gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} size={17}/></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-0.5 text-sm font-semibold text-slate-900">{value}</p></div></div>; }
