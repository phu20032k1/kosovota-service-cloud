"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";

type Member = { id: string; name: string; phone: string; email?: string | null; active: boolean; createdAt: string; _count?: { assignedServiceOrders: number } };

export default function DealerTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dealer/team", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đội KTV");
      setMembers(result.data || []);
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được đội KTV" }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setNotice(null); setTemporaryPassword("");
    try {
      const response = await fetch("/api/dealer/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tạo được KTV");
      setForm({ name: "", phone: "", email: "" }); setTemporaryPassword(result.initialPassword || "");
      setNotice({ kind: "success", text: "Đã tạo KTV. Gửi số điện thoại và mật khẩu tạm bên dưới cho KTV; lần đăng nhập đầu sẽ bắt buộc đổi mật khẩu." });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tạo được KTV" }); }
    finally { setBusy(false); }
  }

  async function update(id: string, payload: Record<string, unknown>) {
    setBusy(true); setNotice(null); setTemporaryPassword("");
    try {
      const response = await fetch("/api/dealer/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được KTV");
      if (result.initialPassword) setTemporaryPassword(result.initialPassword);
      setNotice({ kind: "success", text: result.message }); await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được KTV" }); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-100"><PortalHeader title="Kỹ thuật viên" subtitle="Thêm, đặt lại mật khẩu hoặc khóa KTV của đại lý" homeHref="/agent-portal" homeLabel="Lệnh của tôi" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}><Link href="/agent-portal/profile" className="btn-secondary"><Icon name="store" size={16}/>Hồ sơ</Link></PortalHeader><div className="mx-auto grid max-w-6xl gap-4 p-3 sm:p-6 lg:grid-cols-[350px_1fr]"><form onSubmit={create} className="surface-card h-fit p-5"><h2 className="text-xl font-black">Thêm KTV</h2><p className="mt-1 text-sm text-slate-500">Chỉ cần tên và số điện thoại. Email là tùy chọn.</p>{notice&&<div className="mt-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}{temporaryPassword&&<div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4"><p className="text-xs font-black uppercase tracking-wider text-emerald-700">Mật khẩu tạm</p><p className="mt-2 select-all break-all text-xl font-black text-slate-950">{temporaryPassword}</p><button type="button" onClick={()=>navigator.clipboard?.writeText(temporaryPassword)} className="btn-secondary mt-3 w-full">Sao chép mật khẩu</button></div>}<label className="mt-5 block"><span className="field-label">Họ tên KTV *</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required/></label><label className="mt-4 block"><span className="field-label">Số điện thoại *</span><input type="tel" inputMode="numeric" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value.replace(/\D/g,"")})} required/></label><label className="mt-4 block"><span className="field-label">Email (không bắt buộc)</span><input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} placeholder="ten@gmail.com"/></label><button type="submit" disabled={busy} className="btn-primary mt-5 w-full p-3 font-black text-white disabled:opacity-50"><Icon name="plus" size={17}/>Tạo tài khoản KTV</button></form><section className="surface-card overflow-hidden"><div className="border-b p-5"><h2 className="text-xl font-black">Danh sách KTV</h2><p className="text-sm text-slate-500">KTV nghỉ việc: bấm Khóa. Lịch sử lệnh vẫn được giữ.</p></div>{loading?<LoadingState label="Đang tải KTV..."/>:<div className="divide-y">{members.map((member)=><article key={member.id} className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">{member.name}</p><p className="mt-1 text-sm text-slate-500">{member.phone}{member.email ? ` · ${member.email}` : ""}</p><p className="mt-1 text-xs font-bold text-slate-400">{member._count?.assignedServiceOrders || 0} lệnh đã được giao</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${member.active?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{member.active?"Đang hoạt động":"Đã khóa"}</span></div><div className="grid grid-cols-2 gap-2 sm:flex"><button type="button" disabled={busy} onClick={()=>void update(member.id,{action:"RESET_PASSWORD"})} className="btn-secondary text-sm"><Icon name="lock" size={16}/>Đặt lại mật khẩu</button><button type="button" disabled={busy} onClick={()=>void update(member.id,{active:!member.active})} className={member.active?"rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white":"rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"}>{member.active?"Khóa":"Mở lại"}</button></div></div></article>)}{!members.length&&<p className="p-10 text-center text-slate-500">Chưa có KTV.</p>}</div>}</section></div></main>;
}
