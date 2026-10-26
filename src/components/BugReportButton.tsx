"use client";

import { ChangeEvent, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

type User = { role: string };
const ALLOWED = new Set(["SUPER_ADMIN", "ADMIN", "CSKH", "SALES_MANAGER", "DIRECTOR", "DEALER", "CTV", "KTV"]);

export default function BugReportButton() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState("");
  const [form, setForm] = useState({ category: "Lỗi", action: "", expected: "", actual: "" });

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => {
      if (response.ok && data.success && ALLOWED.has(data.user?.role)) setUser(data.user);
    }).catch(() => undefined);
  }, []);

  async function upload(file: File) {
    setBusy(true); setMessage("");
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("purpose", "bug-report");
      const response = await fetch("/api/upload", { method: "POST", body: data });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "Không tải được ảnh");
      setScreenshot(result.url);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Không tải được ảnh"); }
    finally { setBusy(false); }
  }

  async function submit() {
    setBusy(true); setMessage("");
    try {
      const pageUrl = typeof window === "undefined" ? pathname : `${pathname}${window.location.search}`;
      const response = await fetch("/api/bug-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, screenshot, pageUrl }) });
      const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được báo lỗi");
      setMessage(result.message); setForm({ category: "Lỗi", action: "", expected: "", actual: "" }); setScreenshot("");
      window.setTimeout(() => { setOpen(false); setMessage(""); }, 1200);
    } catch (e) { setMessage(e instanceof Error ? e.message : "Không gửi được báo lỗi"); }
    finally { setBusy(false); }
  }

  if (!user || pathname === "/login" || pathname === "/change-password") return null;
  return <><button type="button" onClick={()=>setOpen(true)} className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-rose-600 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-rose-700" title="Báo lỗi tại trang này"><Icon name="alert" size={17}/>Báo lỗi</button>{open&&<div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-3"><div className="max-h-[94vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-black uppercase tracking-wider text-rose-600">Trang hiện tại</p><h2 className="text-xl font-black">Báo lỗi / góp ý</h2></div><button type="button" onClick={()=>setOpen(false)} className="icon-button"><Icon name="x" size={18}/></button></div><p className="mt-2 break-all text-xs text-slate-400">{pathname}</p><div className="mt-5 space-y-4"><label><span className="field-label">Loại *</span><select value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} className="w-full"><option>Lỗi</option><option>Khó dùng, khó hiểu</option><option>Góp ý thêm chức năng</option></select></label><label><span className="field-label">Đã bấm / đã làm gì? *</span><textarea rows={2} value={form.action} onChange={(e)=>setForm({...form,action:e.target.value})} className="w-full"/></label><label><span className="field-label">Mong đợi gì? *</span><textarea rows={2} value={form.expected} onChange={(e)=>setForm({...form,expected:e.target.value})} className="w-full"/></label><label><span className="field-label">Thực tế thấy gì? *</span><textarea rows={3} value={form.actual} onChange={(e)=>setForm({...form,actual:e.target.value})} className="w-full"/></label><label><span className="field-label">Ảnh chụp màn hình (không bắt buộc)</span><input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>)=>{const file=e.target.files?.[0];if(file)void upload(file);}}/></label>{screenshot&&<a href={screenshot} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border bg-slate-50"><img src={screenshot} alt="Ảnh báo lỗi" className="max-h-48 w-full object-contain"/><span className="block p-2 text-center text-xs font-bold text-emerald-700">Mở ảnh gốc</span></a>}{message&&<div className={`rounded-xl p-3 text-sm font-bold ${message.startsWith("Đã gửi")?"bg-emerald-50 text-emerald-700":"bg-rose-50 text-rose-700"}`}>{message}</div>}<button type="button" disabled={busy} onClick={()=>void submit()} className="w-full rounded-xl bg-rose-600 p-3 font-black text-white disabled:opacity-50">{busy?"Đang xử lý...":"Gửi báo lỗi"}</button></div></div></div>}</>;
}
