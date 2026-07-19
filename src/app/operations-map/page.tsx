"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import InteractiveMap, { type MapMarker } from "@/components/maps/InteractiveMap";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { readApiResponse } from "@/lib/client-api";

type Schedule = { id: string; title: string; dueDate: string; status: string };
type Machine = {
  id: string; model: string; name?: string | null; serial?: string | null; status: string;
  lat?: number | null; lng?: number | null; provinceCode?: string | null;
  customer?: { id?: string; name: string; phone: string; address?: string | null } | null;
  maintenanceSchedules?: Schedule[];
};
type Dealer = {
  id: string; dealerCode: string; name: string; phone: string; address?: string | null;
  province?: string | null; lat?: number | null; lng?: number | null; services?: string | null;
  technicianCount?: number | null; rating?: number | null; status: string;
};
type Order = {
  id: string; orderCode: string; machineId: string; customerName: string; customerPhone: string;
  address?: string | null; serviceType: string; status: string; dueDate?: string | null;
  createdAt: string; updatedAt: string;
  machine: Machine;
  dealer?: Dealer | null;
  technician?: { id: string; name: string; phone: string } | null;
  reports?: Array<{ id: string }>;
  sourceTicket?: { id: string; ticketCode: string; subject: string; priority: string; status: string } | null;
};
type ShortlistDealer = Dealer & { distanceKm: number };
type Selection = { kind: "machine" | "dealer" | "order"; id: string } | null;

const ACTIVE_ORDER_STATUSES = ["NEW", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "CALLED_NO_ANSWER", "CUSTOMER_ACCEPTED", "RESCHEDULED", "COMPLAINT"];
const dateTime = (value?: string | null) => value ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";

export default function OperationsMapPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  const [showMachines, setShowMachines] = useState(true);
  const [showDealers, setShowDealers] = useState(true);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);
  const [serviceType, setServiceType] = useState("Kiểm tra và bảo trì máy");
  const [radius, setRadius] = useState(20);
  const [shortlist, setShortlist] = useState<ShortlistDealer[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [machineResponse, dealerResponse, orderResponse] = await Promise.all([
        fetch("/api/machines", { cache: "no-store" }),
        fetch("/api/dealers", { cache: "no-store" }),
        fetch("/api/service-orders", { cache: "no-store" }),
      ]);
      const [machineResult, dealerResult, orderResult] = await Promise.all([
        readApiResponse<Machine[]>(machineResponse),
        readApiResponse<Dealer[]>(dealerResponse),
        readApiResponse<Order[]>(orderResponse),
      ]);
      if (!machineResponse.ok || !machineResult.success) throw new Error(machineResult.message || "Không tải được máy.");
      if (!dealerResponse.ok || !dealerResult.success) throw new Error(dealerResult.message || "Không tải được đại lý.");
      if (!orderResponse.ok || !orderResult.success) throw new Error(orderResult.message || "Không tải được lệnh điều phối.");

      const nextMachines = machineResult.data || [];
      const nextOrders = orderResult.data || [];
      setMachines(nextMachines);
      setDealers((dealerResult.data || []).filter((dealer: Dealer) => dealer.status === "APPROVED"));
      setOrders(nextOrders);

      const params = new URLSearchParams(window.location.search);
      const requestedOrder = params.get("order");
      const requestedMachine = params.get("machine");
      if (requestedOrder && nextOrders.some((order: Order) => order.id === requestedOrder)) {
        setSelection({ kind: "order", id: requestedOrder });
      } else if (requestedMachine && nextMachines.some((machine: Machine) => machine.id === requestedMachine)) {
        setSelection({ kind: "machine", id: requestedMachine });
      }
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được dữ liệu điều phối." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleMachines = useMemo(() => machines
    .filter((machine) => machine.lat != null && machine.lng != null)
    .filter((machine) => !normalizedSearch || `${machine.id} ${machine.model} ${machine.name || ""} ${machine.customer?.name || ""} ${machine.customer?.phone || ""} ${machine.customer?.address || ""}`.toLowerCase().includes(normalizedSearch)), [machines, normalizedSearch]);
  const visibleDealers = useMemo(() => dealers
    .filter((dealer) => dealer.lat != null && dealer.lng != null)
    .filter((dealer) => !normalizedSearch || `${dealer.dealerCode} ${dealer.name} ${dealer.phone} ${dealer.services || ""} ${dealer.address || ""}`.toLowerCase().includes(normalizedSearch)), [dealers, normalizedSearch]);
  const filteredOrders = useMemo(() => orders
    .filter((order) => orderFilter === "ALL" || (orderFilter === "ACTIVE" ? ACTIVE_ORDER_STATUSES.includes(order.status) : order.status === orderFilter))
    .filter((order) => !normalizedSearch || `${order.orderCode} ${order.serviceType} ${order.customerName} ${order.customerPhone} ${order.machineId} ${order.sourceTicket?.ticketCode || ""}`.toLowerCase().includes(normalizedSearch)), [orders, orderFilter, normalizedSearch]);

  const markers: MapMarker[] = [
    ...(showMachines ? visibleMachines.map((machine) => ({ id: `machine:${machine.id}`, lat: machine.lat!, lng: machine.lng!, title: machine.id, subtitle: machine.customer?.name || machine.model, color: machineColor(machine), glyph: "droplet" as const })) : []),
    ...(showDealers ? visibleDealers.map((dealer) => ({ id: `dealer:${dealer.id}`, lat: dealer.lat!, lng: dealer.lng!, title: dealer.name, subtitle: `${dealer.dealerCode} · ${dealer.phone}`, color: "#2563eb", glyph: "store" as const })) : []),
  ];

  const selectedOrder = selection?.kind === "order" ? orders.find((item) => item.id === selection.id) || null : null;
  const selectedMachine = selection?.kind === "machine"
    ? machines.find((item) => item.id === selection.id) || null
    : selectedOrder?.machine || null;
  const selectedDealer = selection?.kind === "dealer" ? dealers.find((item) => item.id === selection.id) || null : null;
  const activeMarkerId = selectedMachine ? `machine:${selectedMachine.id}` : selectedDealer ? `dealer:${selectedDealer.id}` : null;

  const metrics = useMemo(() => ({
    active: orders.filter((order) => ACTIVE_ORDER_STATUSES.includes(order.status)).length,
    waiting: orders.filter((order) => order.status === "NEW" || !order.dealer).length,
    assigned: orders.filter((order) => ["ASSIGNED", "ACCEPTED"].includes(order.status)).length,
    inProgress: orders.filter((order) => order.status === "IN_PROGRESS").length,
    completed: orders.filter((order) => order.status === "COMPLETED").length,
  }), [orders]);

  function selectMarker(markerId: string) {
    const [kind, ...rest] = markerId.split(":");
    setSelection({ kind: kind === "machine" ? "machine" : "dealer", id: rest.join(":") });
    setShortlist([]);
  }

  function selectOrder(order: Order) {
    setSelection({ kind: "order", id: order.id });
    setServiceType(order.serviceType);
    setShortlist([]);
  }

  async function findDealers() {
    if (!selectedMachine) return;
    setBusy(true);
    setNotice(null);
    setShortlist([]);
    try {
      const response = await fetch("/api/dealers/shortlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: selectedMachine.id, serviceType: selectedOrder?.serviceType || serviceType, limit: 30 }),
      });
      const result = await readApiResponse<ShortlistDealer[]>(response);
      if (!response.ok || !result.success) throw new Error(result.message || "Không tìm được đại lý.");
      const items = (result.data || []).filter((dealer: ShortlistDealer) => dealer.distanceKm <= radius);
      setShortlist(items);
      setNotice({ kind: "info", text: items.length ? `Tìm thấy ${items.length} đại lý/CTV phù hợp trong bán kính ${radius} km.` : `Chưa có đại lý phù hợp trong bán kính ${radius} km.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tìm được đại lý." });
    } finally {
      setBusy(false);
    }
  }

  async function assign(dealer: ShortlistDealer) {
    if (!selectedMachine) return;
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/service-orders/assign-dealer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder?.id,
          machineId: selectedMachine.id,
          serviceType: selectedOrder?.serviceType || serviceType,
          dealerId: dealer.id,
        }),
      });
      const result = await readApiResponse<Order>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không giao được lệnh.");
      setNotice({ kind: "success", text: `Đã ${selectedOrder ? "giao" : "tạo và giao"} lệnh ${result.data.orderCode} cho ${dealer.name}.` });
      setShortlist([]);
      await load();
      setSelection({ kind: "order", id: result.data.id });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không giao được lệnh." });
    } finally {
      setBusy(false);
    }
  }

  return <main className="min-h-screen bg-slate-50/70">
    <OperationsHeader title="Điều phối lệnh dịch vụ" subtitle="Ticket tạo lệnh tự động, theo dõi hàng chờ và giao đại lý/CTV gần máy" actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}/>
    <section className="mx-auto max-w-[1580px] space-y-4 p-3 sm:p-5">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Lệnh đang mở" value={metrics.active} icon="activity"/>
        <Metric label="Chờ điều phối" value={metrics.waiting} icon="clock"/>
        <Metric label="Đã giao đại lý" value={metrics.assigned} icon="store"/>
        <Metric label="Đang thực hiện" value={metrics.inProgress} icon="wrench"/>
        <Metric label="Đã hoàn thành" value={metrics.completed} icon="check"/>
      </div>

      <div className="surface-card grid gap-3 p-3 lg:grid-cols-[minmax(240px,1fr)_auto_auto_auto]">
        <label className="relative min-w-0"><Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm lệnh, Ticket, máy, khách hàng hoặc đại lý" className="pl-11"/></label>
        <button type="button" onClick={() => setShowMachines((value) => !value)} className={`btn-secondary ${showMachines ? "border-emerald-400 bg-emerald-50 text-emerald-800" : "opacity-60"}`}><Icon name="droplet" size={17}/> Máy ({visibleMachines.length})</button>
        <button type="button" onClick={() => setShowDealers((value) => !value)} className={`btn-secondary ${showDealers ? "border-blue-400 bg-blue-50 text-blue-800" : "opacity-60"}`}><Icon name="store" size={17}/> Đại lý ({visibleDealers.length})</button>
        <button type="button" onClick={() => { setSearch(""); setSelection(null); setShortlist([]); }} className="btn-secondary"><Icon name="x" size={17}/> Làm mới</button>
      </div>

      {loading ? <LoadingState label="Đang tải hàng chờ và bản đồ điều phối..."/> : <div className="dispatch-layout">
        <section className="surface-card min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
            <div><p className="section-kicker">Hàng chờ lệnh</p><h2 className="mt-1 text-lg font-black">{filteredOrders.length} lệnh phù hợp</h2></div>
            <select value={orderFilter} onChange={(event) => setOrderFilter(event.target.value)} className="max-w-52"><option value="ACTIVE">Đang mở</option><option value="ALL">Tất cả</option><option value="NEW">Chờ điều phối</option><option value="ASSIGNED">Đã giao</option><option value="IN_PROGRESS">Đang thực hiện</option><option value="COMPLETED">Hoàn thành</option><option value="CANCELLED">Đã hủy</option></select>
          </div>
          <div className="dispatch-order-list">{filteredOrders.map((order) => <button key={order.id} type="button" onClick={() => selectOrder(order)} className={`dispatch-order-item ${selectedOrder?.id === order.id ? "is-active" : ""}`}><div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-black text-slate-950">{order.orderCode}</p><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{order.serviceType}</p></div><StatusBadge value={order.status}/></div><div className="mt-3 grid gap-1 text-xs text-slate-500"><span className="truncate"><strong>Khách:</strong> {order.customerName} · {order.customerPhone}</span><span className="truncate"><strong>Máy:</strong> {order.machineId}</span><span className="truncate"><strong>Phụ trách:</strong> {order.dealer?.name || "Chưa giao"}</span>{order.sourceTicket && <span className="truncate font-bold text-violet-700">Ticket {order.sourceTicket.ticketCode}</span>}</div></button>)}{!filteredOrders.length && <div className="empty-detail-state m-4"><Icon name="check" size={28}/><strong>Không có lệnh phù hợp</strong><p>Đổi bộ lọc hoặc tạo Ticket có máy để hệ thống tự đưa lệnh sang đây.</p></div>}</div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="surface-card overflow-hidden"><InteractiveMap markers={markers} activeId={activeMarkerId} onSelect={selectMarker} height={520}/></div>
          <div className="surface-card min-w-0 p-4 sm:p-5">{selectedOrder ? <OrderDispatchPanel order={selectedOrder} serviceType={serviceType} setServiceType={setServiceType} radius={radius} setRadius={setRadius} busy={busy} shortlist={shortlist} onFind={findDealers} onAssign={assign}/> : selectedMachine ? <MachineDispatchPanel machine={selectedMachine} serviceType={serviceType} setServiceType={setServiceType} radius={radius} setRadius={setRadius} busy={busy} shortlist={shortlist} onFind={findDealers} onAssign={assign}/> : selectedDealer ? <DealerPanel dealer={selectedDealer}/> : <EmptyPanel/>}</div>
        </section>
      </div>}
    </section>
  </main>;
}

function machineColor(machine: Machine) {
  const due = (machine.maintenanceSchedules || []).filter((schedule) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(schedule.status)).map((schedule) => +new Date(schedule.dueDate));
  if (["INACTIVE", "BROKEN", "STOPPED"].includes(machine.status)) return "#475569";
  if (due.some((date) => date < Date.now())) return "#e11d48";
  if (due.some((date) => date < Date.now() + 30 * 86400000)) return "#d97706";
  return "#059669";
}

function Metric({ label, value, icon }: { label: string; value: number; icon: "activity" | "clock" | "store" | "wrench" | "check" }) {
  return <div className="surface-card p-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon name={icon} size={18}/></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-2xl font-black text-slate-950">{value}</p></div></div></div>;
}

function DispatchControls({ serviceType, setServiceType, radius, setRadius, busy, shortlist, onFind, onAssign, existingOrder }: { serviceType: string; setServiceType: (value: string) => void; radius: number; setRadius: (value: number) => void; busy: boolean; shortlist: ShortlistDealer[]; onFind: () => void; onAssign: (dealer: ShortlistDealer) => void; existingOrder: boolean }) {
  return <div className="mt-5"><div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]"><label><span className="field-label">Dịch vụ cần làm</span><input value={serviceType} onChange={(event) => setServiceType(event.target.value)} disabled={existingOrder}/></label><label><span className="field-label">Bán kính (km)</span><input type="number" min="1" max="200" value={radius} onChange={(event) => setRadius(Number(event.target.value) || 20)}/></label></div><button type="button" onClick={onFind} disabled={busy || !serviceType.trim()} className="btn-primary mt-3 w-full justify-center px-4 py-3 font-black text-white disabled:opacity-60"><Icon name="search" size={17}/>{busy ? "Đang tìm..." : existingOrder ? "Tìm đại lý để giao lệnh này" : "Tìm đại lý và tạo lệnh"}</button>{!!shortlist.length && <div className="mt-4 space-y-3"><p className="text-sm font-black text-slate-900">Đại lý/CTV phù hợp</p>{shortlist.map((dealer) => <article key={dealer.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words font-black text-slate-950">{dealer.dealerCode} · {dealer.name}</h4><p className="mt-1 text-xs leading-5 text-slate-500">{dealer.distanceKm.toFixed(1)} km · {dealer.phone} · {dealer.technicianCount || 0} KTV</p><p className="mt-1 break-words text-xs text-slate-500">{dealer.services || "Chưa khai báo năng lực"}</p></div><button type="button" onClick={() => onAssign(dealer)} disabled={busy} className="btn-secondary shrink-0 px-3 py-2 text-xs font-black"><Icon name="send" size={15}/> Giao lệnh</button></div></article>)}</div>}</div>;
}

function OrderDispatchPanel({ order, serviceType, setServiceType, radius, setRadius, busy, shortlist, onFind, onAssign }: { order: Order; serviceType: string; setServiceType: (value: string) => void; radius: number; setRadius: (value: number) => void; busy: boolean; shortlist: ShortlistDealer[]; onFind: () => void; onAssign: (dealer: ShortlistDealer) => void }) {
  return <div className="min-w-0"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="section-kicker">Lệnh được chọn</p><h2 className="mt-1 break-words text-xl font-black">{order.orderCode}</h2><p className="mt-1 break-words text-sm text-slate-500">{order.serviceType}</p></div><StatusBadge value={order.status}/></div>{order.sourceTicket && <div className="requirement-summary mt-4"><span className="summary-icon"><Icon name="alert" size={18}/></span><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.12em] text-violet-700">Tự động chuyển từ Ticket {order.sourceTicket.ticketCode}</p><p className="mt-1 break-words text-sm font-bold text-slate-800">{order.sourceTicket.subject}</p></div></div>}<div className="summary-grid mt-4"><Small label="Khách hàng" value={`${order.customerName} · ${order.customerPhone}`}/><Small label="Máy" value={`${order.machineId} · ${order.machine.model}`}/><Small label="Hạn xử lý" value={dateTime(order.dueDate)}/><Small label="Đại lý hiện tại" value={order.dealer ? `${order.dealer.dealerCode} · ${order.dealer.name}` : "Chưa giao"}/></div><div className="mt-4 flex flex-wrap gap-2"><Link href={`/admin/service-orders/${order.id}`} className="btn-secondary px-3 py-2 text-sm font-black"><Icon name="eye" size={16}/> Xem đầy đủ chi tiết</Link>{order.sourceTicket && <Link href={`/admin/tickets?ticket=${order.sourceTicket.id}`} className="btn-secondary px-3 py-2 text-sm font-black"><Icon name="alert" size={16}/> Mở Ticket</Link>}</div><DispatchControls serviceType={serviceType} setServiceType={setServiceType} radius={radius} setRadius={setRadius} busy={busy} shortlist={shortlist} onFind={onFind} onAssign={onAssign} existingOrder/></div>;
}

function MachineDispatchPanel({ machine, serviceType, setServiceType, radius, setRadius, busy, shortlist, onFind, onAssign }: { machine: Machine; serviceType: string; setServiceType: (value: string) => void; radius: number; setRadius: (value: number) => void; busy: boolean; shortlist: ShortlistDealer[]; onFind: () => void; onAssign: (dealer: ShortlistDealer) => void }) {
  const next = (machine.maintenanceSchedules || []).filter((schedule) => !["COMPLETED", "DISABLED", "SELF_SERVICE"].includes(schedule.status)).sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
  return <div className="min-w-0"><span className="status-pill status-green"><Icon name="droplet" size={14}/> Máy khách hàng</span><h2 className="mt-3 break-words text-xl font-black">{machine.id}</h2><p className="mt-1 text-sm text-slate-500">{machine.name || machine.model}{machine.serial ? ` · ${machine.serial}` : ""}</p><div className="summary-grid mt-4"><Small label="Khách hàng" value={machine.customer ? `${machine.customer.name} · ${machine.customer.phone}` : "Chưa gắn khách hàng"}/><Small label="Địa chỉ" value={machine.customer?.address || "Chưa cập nhật"}/><Small label="Trạng thái máy" value={machine.status}/><Small label="Lịch gần nhất" value={next ? `${next.title} · ${dateTime(next.dueDate)}` : "Chưa có lịch"}/></div><DispatchControls serviceType={serviceType} setServiceType={setServiceType} radius={radius} setRadius={setRadius} busy={busy} shortlist={shortlist} onFind={onFind} onAssign={onAssign} existingOrder={false}/></div>;
}

function DealerPanel({ dealer }: { dealer: Dealer }) {
  return <div><span className="status-pill status-blue"><Icon name="store" size={14}/> Đại lý/CTV</span><h2 className="mt-3 text-xl font-black">{dealer.name}</h2><p className="mt-1 text-sm text-slate-500">{dealer.dealerCode} · {dealer.phone}</p><div className="summary-grid mt-4"><Small label="Tỉnh" value={dealer.province || "—"}/><Small label="KTV" value={String(dealer.technicianCount || 0)}/><Small label="Đánh giá" value={`${dealer.rating || 5}/5`}/><Small label="Năng lực" value={dealer.services || "Chưa cập nhật"}/></div><Link href={`/admin/dealers/${dealer.id}`} className="btn-secondary mt-4 px-4 py-3 text-sm font-black"><Icon name="eye" size={17}/> Xem/sửa hồ sơ đại lý</Link></div>;
}

function EmptyPanel() {
  return <div className="empty-detail-state"><Icon name="map" size={32}/><strong>Chọn một lệnh, máy hoặc đại lý</strong><p>Lệnh tạo từ Ticket xuất hiện tự động trong hàng chờ. Chọn lệnh để xem đủ yêu cầu và phân công.</p></div>;
}

function Small({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-bold leading-5 text-slate-800">{value}</p></div>;
}
