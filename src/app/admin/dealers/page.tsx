"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";
import { MetricCard } from "@/components/ui/MetricCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

type Dealer = { id: string; dealerCode: string; name: string; representativeName?: string | null; phone: string; province?: string | null; address?: string | null; services?: string | null; status: string; technicianCount?: number | null; portraitPhoto?: string | null; storePhoto?: string | null; warehousePhoto?: string | null; createdAt: string; serviceOrders?: { id: string; status: string }[] };

export default function AdminDealersPage() {
  const [items, setItems] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dealers", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý");
      setItems(result.data || []);
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được đại lý" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function update(dealerCode: string, nextStatus: string) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/dealers", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dealerCode, status: nextStatus }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được hồ sơ");
      setNotice({ kind: "success", text: result.message });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được hồ sơ" }); }
    finally { setBusy(false); }
  }

  const filtered = useMemo(() => items.filter((item) => {
    const text = `${item.dealerCode} ${item.name} ${item.representativeName || ""} ${item.phone} ${item.province || ""}`.toLowerCase();
    return (status === "ALL" || item.status === status) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }), [items, query, status]);

  return <main className="min-h-screen bg-slate-100"><OperationsHeader title="Hồ sơ đại lý và CTV" subtitle="Admin là cấp duyệt cuối; CSKH không có quyền phê duyệt" actions={<button type="button" onClick={load} className="icon-button" title="Tải lại"><Icon name="refresh" size={18}/></button>}/><div className="page-container space-y-6">{notice&&<Notice kind={notice.kind}>{notice.text}</Notice>}<section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="Tổng hồ sơ" value={items.length} icon="store"/><MetricCard label="Chờ duyệt" value={items.filter((item)=>item.status==="PENDING").length} icon="clock" tone="amber"/><MetricCard label="Đã duyệt" value={items.filter((item)=>item.status==="APPROVED").length} icon="check" tone="emerald"/><MetricCard label="Tạm khóa/Từ chối" value={items.filter((item)=>["SUSPENDED","REJECTED"].includes(item.status)).length} icon="alert" tone="rose"/></section><section className="surface-card"><div className="data-toolbar"><div className="relative min-w-[260px] flex-1 max-w-xl"><Icon name="search" size={18} className="pointer-events-none absolute left-3 top-3.5 text-slate-400"/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Tìm mã, tên, số điện thoại hoặc tỉnh" className="pl-10"/></div><select value={status} onChange={(event)=>setStatus(event.target.value)} className="max-w-48"><option value="ALL">Tất cả trạng thái</option><option value="PENDING">Chờ duyệt</option><option value="APPROVED">Đã duyệt</option><option value="REJECTED">Từ chối</option><option value="SUSPENDED">Tạm khóa</option></select></div>{loading?<LoadingState label="Đang tải hồ sơ đại lý..."/>:<div className="divide-y">{filtered.map((dealer)=><article key={dealer.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{dealer.dealerCode} · {dealer.name}</h2><StatusBadge value={dealer.status}/></div><p className="mt-1 text-sm text-slate-600">{dealer.representativeName || "Chưa có người đại diện"} · <a href={`tel:${dealer.phone}`} className="text-emerald-700">{dealer.phone}</a></p><p className="mt-1 text-sm text-slate-600">{dealer.address || "Chưa có địa chỉ"} · {dealer.province || "Chưa có tỉnh"}</p><p className="mt-2 text-sm"><strong>Năng lực:</strong> {dealer.services || "Chưa khai báo"}</p><div className="mt-3 flex flex-wrap gap-3 text-sm">{dealer.portraitPhoto&&<a href={dealer.portraitPhoto} target="_blank" className="font-bold text-blue-700">Ảnh chân dung</a>}{dealer.storePhoto&&<a href={dealer.storePhoto} target="_blank" className="font-bold text-blue-700">Ảnh cửa hàng</a>}{dealer.warehousePhoto&&<a href={dealer.warehousePhoto} target="_blank" className="font-bold text-blue-700">Ảnh kho</a>}</div></div><div className="flex flex-wrap gap-2">{dealer.status!=="APPROVED"&&<button type="button" disabled={busy} onClick={()=>void update(dealer.dealerCode,"APPROVED")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">Duyệt</button>}{dealer.status==="PENDING"&&<button type="button" disabled={busy} onClick={()=>void update(dealer.dealerCode,"REJECTED")} className="rounded-xl bg-rose-600 px-4 py-2 font-bold text-white">Từ chối</button>}{dealer.status==="APPROVED"&&<button type="button" disabled={busy} onClick={()=>void update(dealer.dealerCode,"SUSPENDED")} className="rounded-xl bg-amber-600 px-4 py-2 font-bold text-white">Tạm khóa</button>}{dealer.status==="SUSPENDED"&&<button type="button" disabled={busy} onClick={()=>void update(dealer.dealerCode,"APPROVED")} className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">Mở lại</button>}</div></div></article>)}{!filtered.length&&<p className="p-10 text-center text-slate-500">Không có hồ sơ phù hợp.</p>}</div>}</section></div></main>;
}
