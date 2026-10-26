"use client";

import { useCallback, useEffect, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";

type Report = { id: string; createdAt: string; category: string; action: string; expected: string; actual: string; pageUrl: string; screenshot?: string; status: string; reporterName?: string; reporterRole?: string; reporterPhone?: string };
const STATUS: Record<string,string> = { NEW: "Mới", FIXING: "Đang sửa", FIXED: "Đã sửa" };

export default function AdminBugReportsPage() {
  const [rows, setRows] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    const response = await fetch("/api/bug-reports", { cache: "no-store" });
    const result = await response.json();
    if (response.ok && result.success) setRows(result.data || []); else setNotice(result.message || "Không tải được báo lỗi");
  }, []);
  useEffect(()=>{void load();},[load]);
  async function setStatus(id:string,status:string){setBusy(true);setNotice("");try{const response=await fetch("/api/bug-reports",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});const result=await response.json();if(!response.ok||!result.success)throw new Error(result.message||"Không cập nhật được");await load();}catch(e){setNotice(e instanceof Error?e.message:"Không cập nhật được");}finally{setBusy(false);}}
  return <main className="min-h-screen"><OperationsHeader title="Báo lỗi từ nhân viên" subtitle="Theo dõi lỗi, khó dùng và góp ý được gửi ngay tại từng trang"/><div className="page-container space-y-4">{notice&&<Notice kind="error">{notice}</Notice>}<section className="grid gap-3 sm:grid-cols-3"><div className="surface-card p-4"><p className="text-sm font-bold text-slate-500">Mới</p><p className="text-3xl font-black">{rows.filter(r=>r.status==="NEW").length}</p></div><div className="surface-card p-4"><p className="text-sm font-bold text-slate-500">Đang sửa</p><p className="text-3xl font-black">{rows.filter(r=>r.status==="FIXING").length}</p></div><div className="surface-card p-4"><p className="text-sm font-bold text-slate-500">Đã sửa</p><p className="text-3xl font-black">{rows.filter(r=>r.status==="FIXED").length}</p></div></section><section className="space-y-3">{rows.map(row=><article key={row.id} className="surface-card p-4 sm:p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-black text-rose-700">{row.category}</span><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black">{STATUS[row.status]||row.status}</span></div><h2 className="mt-3 font-black">{row.reporterName||"Nhân viên"} · {row.reporterRole||""}</h2><p className="mt-1 text-xs text-slate-400">{new Date(row.createdAt).toLocaleString("vi-VN")} · {row.pageUrl}</p></div><select disabled={busy} value={row.status} onChange={(e)=>void setStatus(row.id,e.target.value)} className="rounded-xl border p-2 text-sm font-bold"><option value="NEW">Mới</option><option value="FIXING">Đang sửa</option><option value="FIXED">Đã sửa</option></select></div><div className="mt-4 grid gap-3 lg:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-400">Đã bấm gì</p><p className="mt-1 text-sm">{row.action}</p></div><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-xs font-black uppercase text-emerald-700">Mong đợi</p><p className="mt-1 text-sm">{row.expected}</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-xs font-black uppercase text-rose-700">Thực tế</p><p className="mt-1 text-sm">{row.actual}</p></div></div>{row.screenshot&&<a href={row.screenshot} target="_blank" className="btn-secondary mt-4 inline-flex"><Icon name="eye" size={16}/>Xem ảnh chụp màn hình</a>}</article>)}{!rows.length&&<div className="surface-card p-12 text-center text-slate-500"><Icon name="check" size={34} className="mx-auto mb-2"/><p className="font-bold">Chưa có báo lỗi nào.</p></div>}</section></div></main>;
}
