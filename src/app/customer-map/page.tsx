"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import LocationPickerMap from "@/components/maps/LocationPickerMap";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type MachineStatus = "active" | "due" | "overdue" | "inactive";
type Schedule = { id?: string; title: string; dueDate: string; status: string };
type ServiceOrder = { id: string; orderCode?: string | null; serviceType: string; status: string; createdAt: string; dueDate?: string | null };
type ServiceReport = { id: string; serviceType: string; products?: string | null; note?: string | null; createdAt: string };
type Machine = {
  id: string;
  model: string;
  serial?: string | null;
  status: string;
  installDate?: string | null;
  lat?: number | null;
  lng?: number | null;
  buildingPhoto?: string | null;
  machinePhoto?: string | null;
  customer?: { name: string; phone: string; address?: string | null } | null;
  maintenanceSchedules?: Schedule[];
  serviceOrders?: ServiceOrder[];
  serviceReports?: ServiceReport[];
};
type Location = { lat: number; lng: number };

const CLOSED_SCHEDULE_STATUSES = ["COMPLETED", "DISABLED", "SELF_SERVICE", "INTERNAL"];
const STATUS_META: Record<MachineStatus, { label: string; color: string; className: string }> = {
  active: { label: "Hoạt động tốt", color: "#059669", className: "status-green" },
  due: { label: "Sắp đến hạn", color: "#d97706", className: "status-amber" },
  overdue: { label: "Quá hạn / cần sửa", color: "#e11d48", className: "status-red" },
  inactive: { label: "Ngừng sử dụng", color: "#475569", className: "status-slate" },
};

function statusOf(machine: Machine): MachineStatus {
  if (["INACTIVE", "BROKEN", "STOPPED"].includes(machine.status)) return "inactive";
  const pending = (machine.maintenanceSchedules || []).filter((item) => !CLOSED_SCHEDULE_STATUSES.includes(item.status));
  if (pending.some((item) => new Date(item.dueDate).getTime() < Date.now())) return "overdue";
  if (pending.some((item) => new Date(item.dueDate).getTime() < Date.now() + 30 * 86400000)) return "due";
  return "active";
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function formatDateTime(value?: string | null) {
  return value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
}

export default function CustomerMapPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<MachineStatus | "">("");
  const [model, setModel] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [editingLocation, setEditingLocation] = useState(false);
  const [draftLocation, setDraftLocation] = useState<Location | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError("");
    try {
      const response = await fetch("/api/machines", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được danh sách máy.");
      setMachines(result.data || []);
    } catch (value) {
      setError(value instanceof Error ? value.message : "Không tải được dữ liệu.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (response.ok && result.success) setRole(String(result.user?.role || "").toUpperCase());
      })
      .catch(() => undefined);
    const refresh = () => {
      if (document.visibilityState === "visible" && !editingLocation) void load(true);
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [editingLocation, load]);

  const models = useMemo(() => [...new Set(machines.map((machine) => machine.model).filter(Boolean))].sort(), [machines]);
  const filtered = useMemo(() => machines.filter((machine) => {
    const text = `${machine.id} ${machine.serial || ""} ${machine.model} ${machine.customer?.name || ""} ${machine.customer?.phone || ""} ${machine.customer?.address || ""}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (!status || statusOf(machine) === status) && (!model || machine.model === model);
  }), [machines, search, status, model]);
  const located = filtered.filter((machine) => machine.lat != null && machine.lng != null);
  const selected = machines.find((machine) => machine.id === selectedId) || null;
  const markers: MapMarker[] = located.map((machine) => ({
    id: machine.id,
    lat: machine.lat!,
    lng: machine.lng!,
    title: machine.id,
    subtitle: machine.customer?.name || machine.model,
    color: STATUS_META[statusOf(machine)].color,
    glyph: "droplet",
  }));
  const counts = (Object.keys(STATUS_META) as MachineStatus[]).map((key) => ({ key, value: machines.filter((machine) => statusOf(machine) === key).length }));
  const missingGps = machines.filter((machine) => machine.lat == null || machine.lng == null).length;
  const canEditLocation = role === "ADMIN" || role === "SUPER_ADMIN";

  function selectMachine(id: string) {
    setSelectedId(id);
    setEditingLocation(false);
    setDraftLocation(null);
    setNotice(null);
  }

  function beginLocationEdit(machine: Machine) {
    setEditingLocation(true);
    setDraftLocation(machine.lat != null && machine.lng != null ? { lat: machine.lat, lng: machine.lng } : null);
    setNotice({ kind: "info", text: "Bấm vào vị trí chính xác trên bản đồ nhỏ, sau đó lưu vị trí." });
  }

  async function saveLocation() {
    if (!selected || !draftLocation || savingLocation) return;
    setSavingLocation(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/machines/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftLocation),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được vị trí.");
      setMachines((current) => current.map((machine) => machine.id === selected.id ? { ...machine, lat: draftLocation.lat, lng: draftLocation.lng } : machine));
      setEditingLocation(false);
      setNotice({ kind: "success", text: `Đã cập nhật vị trí GPS cho máy ${selected.id}.` });
    } catch (value) {
      setNotice({ kind: "error", text: value instanceof Error ? value.message : "Không lưu được vị trí." });
    } finally {
      setSavingLocation(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50/70">
      <OperationsHeader title="Bản đồ máy khách hàng" subtitle="Theo dõi vị trí, trạng thái, lịch sử chăm sóc và vòng đời thiết bị" actions={<button type="button" onClick={() => void load()} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>} />
      <section className="mx-auto max-w-[1480px] space-y-4 p-3 sm:p-5">
        {error && <Notice kind="error">{error}</Notice>}
        {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {counts.map(({ key, value }) => <button type="button" key={key} onClick={() => setStatus(status === key ? "" : key)} className={`surface-card flex items-center justify-between gap-3 p-4 text-left ${status === key ? "ring-2 ring-emerald-500" : ""}`}><span><span className={`status-pill ${STATUS_META[key].className}`}>{STATUS_META[key].label}</span><strong className="mt-2 block text-2xl font-extrabold text-slate-950">{value}</strong></span><span className="h-3 w-3 rounded-full" style={{ background: STATUS_META[key].color }}/></button>)}
          <div className="surface-card flex items-center gap-3 p-4"><span className="metric-icon metric-slate"><Icon name="navigation"/></span><div><p className="text-xs font-extrabold uppercase tracking-wider text-slate-500">Thiếu GPS</p><p className="mt-1 text-2xl font-extrabold">{missingGps}</p></div></div>
        </div>

        <div className="surface-card grid gap-3 p-3 md:grid-cols-[1fr_220px_auto]">
          <label className="relative block"><Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm ID, seri, khách hàng, số điện thoại hoặc địa chỉ" className="pl-11"/></label>
          <select value={model} onChange={(event) => setModel(event.target.value)}><option value="">Tất cả dòng máy</option>{models.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="button" onClick={() => { setSearch(""); setStatus(""); setModel(""); }} className="btn-secondary"><Icon name="x" size={17}/> Xóa lọc</button>
        </div>

        {search.trim() && filtered.length > 0 && <div className="surface-card flex gap-2 overflow-x-auto p-3">
          {filtered.slice(0, 12).map((machine) => <button type="button" key={machine.id} onClick={() => selectMachine(machine.id)} className={`shrink-0 rounded-xl border px-3 py-2 text-left text-xs ${selectedId === machine.id ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}><strong className="block text-slate-900">{machine.id}</strong><span className="text-slate-500">{machine.customer?.name || machine.model}{machine.lat == null || machine.lng == null ? " · Thiếu GPS" : ""}</span></button>)}
        </div>}

        {loading ? <LoadingState label="Đang tải dữ liệu máy..."/> : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
            <InteractiveMap markers={markers} activeId={selectedId} onSelect={selectMachine} height={720}/>
            <aside className="surface-card min-h-[320px] overflow-hidden p-5 xl:h-[720px] xl:overflow-y-auto">
              {selected ? <MachineDetail
                machine={selected}
                onClose={() => selectMachine("")}
                canEditLocation={canEditLocation}
                editingLocation={editingLocation}
                draftLocation={draftLocation}
                savingLocation={savingLocation}
                onStartLocationEdit={() => beginLocationEdit(selected)}
                onCancelLocationEdit={() => { setEditingLocation(false); setDraftLocation(null); setNotice(null); }}
                onLocationChange={setDraftLocation}
                onSaveLocation={() => void saveLocation()}
              /> : <div className="flex h-full min-h-[300px] flex-col justify-center text-center"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name="map-pin" size={30}/></span><h2 className="mt-4 text-xl font-extrabold">Chọn một điểm máy</h2><p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-500">Bấm marker trên bản đồ hoặc tìm máy để xem khách hàng, lịch bảo trì và lịch sử dịch vụ.</p><Link href="/operations-map" className="btn-primary mx-auto mt-5 inline-flex items-center gap-2 px-4 py-3 font-bold text-white"><Icon name="layers" size={18}/> Mở bản đồ điều phối</Link></div>}
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}

function MachineDetail({ machine, onClose, canEditLocation, editingLocation, draftLocation, savingLocation, onStartLocationEdit, onCancelLocationEdit, onLocationChange, onSaveLocation }: {
  machine: Machine;
  onClose: () => void;
  canEditLocation: boolean;
  editingLocation: boolean;
  draftLocation: Location | null;
  savingLocation: boolean;
  onStartLocationEdit: () => void;
  onCancelLocationEdit: () => void;
  onLocationChange: (location: Location) => void;
  onSaveLocation: () => void;
}) {
  const currentStatus = statusOf(machine);
  const nextSchedule = (machine.maintenanceSchedules || []).filter((item) => !CLOSED_SCHEDULE_STATUSES.includes(item.status)).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  const history = [
    ...(machine.serviceReports || []).map((item) => ({ id: `report-${item.id}`, at: item.createdAt, title: item.serviceType, detail: [item.products, item.note].filter(Boolean).join(" · ") || "Báo cáo hiện trường", kind: "Báo cáo" })),
    ...(machine.serviceOrders || []).map((item) => ({ id: `order-${item.id}`, at: item.createdAt, title: item.serviceType, detail: `${item.orderCode || "Lệnh dịch vụ"} · ${item.status}`, kind: "Lệnh" })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 8);
  const recentSchedules = (machine.maintenanceSchedules || []).slice().sort((a, b) => +new Date(b.dueDate) - +new Date(a.dueDate)).slice(0, 6);

  return <div>
    <div className="flex items-start justify-between gap-3"><div><span className={`status-pill ${STATUS_META[currentStatus].className}`}>{STATUS_META[currentStatus].label}</span><h2 className="mt-3 text-xl font-extrabold text-slate-950">{machine.id}</h2><p className="mt-1 text-sm text-slate-500">{machine.model}{machine.serial ? ` · ${machine.serial}` : ""}</p></div><button type="button" onClick={onClose} className="icon-button"><Icon name="x" size={18}/></button></div>

    <div className="mt-5 space-y-4">
      <Info icon="user" label="Khách hàng" value={machine.customer?.name || "Chưa cập nhật"}/>
      <Info icon="phone" label="Số điện thoại" value={machine.customer?.phone || "—"}/>
      <Info icon="map-pin" label="Địa chỉ" value={machine.customer?.address || "—"}/>
      <Info icon="calendar" label="Ngày lắp đặt" value={formatDate(machine.installDate)}/>
      <Info icon="clock" label="Chăm sóc tiếp theo" value={nextSchedule ? `${nextSchedule.title} · ${formatDate(nextSchedule.dueDate)}` : "Không còn lịch mở"}/>
      <Info icon="map-pin" label="GPS hiện tại" value={machine.lat != null && machine.lng != null ? `${machine.lat.toFixed(6)}, ${machine.lng.toFixed(6)}` : "Chưa có GPS"}/>
    </div>

    {canEditLocation && !editingLocation && <button type="button" onClick={onStartLocationEdit} className="btn-secondary mt-5 w-full justify-center"><Icon name="map-pin" size={17}/> Chỉnh vị trí máy trên bản đồ</button>}
    {editingLocation && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3">
      <p className="mb-3 text-sm font-black text-emerald-900">Chọn lại vị trí GPS</p>
      <LocationPickerMap value={draftLocation} onChange={onLocationChange} height={300}/>
      <p className="mt-2 break-all text-xs font-bold text-slate-600">{draftLocation ? `Tọa độ mới: ${draftLocation.lat.toFixed(6)}, ${draftLocation.lng.toFixed(6)}` : "Chưa chọn điểm mới."}</p>
      <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={onCancelLocationEdit} className="btn-secondary justify-center">Hủy</button><button type="button" onClick={onSaveLocation} disabled={!draftLocation || savingLocation} className="btn-primary justify-center px-4 py-3 font-bold text-white disabled:opacity-50">{savingLocation ? "Đang lưu..." : "Lưu vị trí"}</button></div>
    </div>}

    {(machine.buildingPhoto || machine.machinePhoto) && <div className="mt-5 grid grid-cols-2 gap-2">{machine.buildingPhoto && <a href={machine.buildingPhoto} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><Icon name="building" size={17}/> Mặt tiền</a>}{machine.machinePhoto && <a href={machine.machinePhoto} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><Icon name="camera" size={17}/> Vị trí máy</a>}</div>}

    <section className="mt-6 border-t border-slate-200 pt-5">
      <div className="flex items-center justify-between gap-2"><h3 className="font-black text-slate-950">Lịch sử chăm sóc / sửa chữa</h3><span className="text-xs font-bold text-slate-400">{history.length} gần nhất</span></div>
      <div className="mt-3 space-y-2">{history.length ? history.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-2"><strong className="text-sm text-slate-900">{item.title}</strong><span className="shrink-0 text-[11px] font-bold text-slate-400">{formatDateTime(item.at)}</span></div><p className="mt-1 text-xs leading-5 text-slate-600"><span className="font-bold text-emerald-700">{item.kind}</span> · {item.detail}</p></article>) : <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">Chưa có báo cáo hoặc lệnh dịch vụ.</p>}</div>
    </section>

    <section className="mt-5 border-t border-slate-200 pt-5">
      <h3 className="font-black text-slate-950">Lịch bảo trì / thay lõi</h3>
      <div className="mt-3 space-y-2">{recentSchedules.length ? recentSchedules.map((item, index) => <div key={item.id || `${item.title}-${index}`} className="flex items-start justify-between gap-3 rounded-xl bg-slate-50 p-3 text-xs"><span><strong className="block text-slate-800">{item.title}</strong><span className="mt-1 block text-slate-500">{item.status}</span></span><span className="shrink-0 font-bold text-slate-600">{formatDate(item.dueDate)}</span></div>) : <p className="text-sm text-slate-500">Chưa có lịch bảo trì.</p>}</div>
    </section>

    <div className="mt-5 grid gap-2"><Link href={`/qr/${encodeURIComponent(machine.id)}`} className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-3 font-bold text-white"><Icon name="qr" size={18}/> Mở hồ sơ QR</Link><Link href={`/admin/machines/${encodeURIComponent(machine.id)}`} className="btn-secondary"><Icon name="file" size={18}/> Xem hồ sơ đầy đủ</Link><Link href={`/operations-map?machine=${encodeURIComponent(machine.id)}`} className="btn-secondary"><Icon name="route" size={18}/> Tìm đại lý & điều phối</Link></div>
  </div>;
}

function Info({ icon, label, value }: { icon: "user" | "phone" | "map-pin" | "calendar" | "clock"; label: string; value: string }) {
  return <div className="flex gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icon name={icon} size={17}/></span><div className="min-w-0"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-0.5 break-words text-sm font-semibold text-slate-900">{value}</p></div></div>;
}
