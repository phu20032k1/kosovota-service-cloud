"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { LoadingState } from "@/components/ui/LoadingState";

type Member = { id: string; name: string; phone: string; active: boolean; createdAt: string; _count?: { assignedServiceOrders: number } };

export default function DealerTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [form, setForm] = useState({ name: "", phone: "" });

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
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/dealer/team", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không tạo được KTV");
      setForm({ name: "", phone: "" });
      setNotice({ kind: "success", text: `${result.message} Mật khẩu ban đầu: ${result.initialPassword}` });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tạo được KTV" }); }
    finally { setBusy(false); }
  }

  async function update(id: string, payload: Record<string, unknown>) {
    setBusy(true); setNotice(null);
    try {
      const response = await fetch("/api/dealer/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...payload }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được KTV");
      setNotice({ kind: "success", text: result.initialPassword ? `${result.message} Mật khẩu mới: ${result.initialPassword}` : result.message });
      await load();
    } catch (error) { setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không cập nhật được KTV" }); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-slate-100"><PortalHeader title="Đội kỹ thuật viên" subtitle="Đại lý chỉ quản lý KTV thuộc mã đại lý của mình" homeHref="/agent-portal" homeLabel="Lệnh dịch vụ" onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}><Link href="/agent-portal/inventory" className="btn-secondary"><Icon name="package" size={16}/>Kho</Link><Link href="/agent-portal/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Đối soát</Link></PortalHeader><div className="mx-auto grid max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[360px_1fr]"> <form onSubmit={create} className="surface-card h-fit p-5"><h2 className="text-xl font-black">Thêm KTV</h2><p className="mt-1 text-sm text-slate-500">Tài khoản được gắn tự động vào đại lý đang đăng nhập.</p>{notice&&<div className="mt-4"><Notice kind={notice.kind}>{notice.text}</Notice></div>}<label className="mt-5 block"><span className="mb-1 block text-sm font-bold">Họ tên KTV</span><input value={form.name} onChange={(event)=>setForm({...form,name:event.target.value})} required/></label><label className="mt-4 block"><span className="mb-1 block text-sm font-bold">Số điện thoại</span><input type="tel" inputMode="numeric" value={form.phone} onChange={(event)=>setForm({...form,phone:event.target.value.replace(/\D/g,"")})} required/></label><button type="submit" disabled={busy} className="btn-primary mt-5 w-full p-3 font-black text-white disabled:opacity-50"><Icon name="plus" size={17}/>Tạo tài khoản KTV</button></form><section className="surface-card"><div className="border-b p-5"><h2 className="text-xl font-black">Danh sách KTV</h2><p className="text-sm text-slate-500">Khóa tài khoản khi KTV nghỉ việc; không xóa lịch sử lệnh.</p></div>{loading?<LoadingState label="Đang tải KTV..."/>:<div className="divide-y">{members.map((member)=><article key={member.id} className="flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="font-black">{member.name}</p><p className="text-sm text-slate-500">{member.phone} · {member._count?.assignedServiceOrders || 0} lệnh đã được giao</p><span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${member.active?"bg-emerald-100 text-emerald-700":"bg-slate-200 text-slate-600"}`}>{member.active?"Đang hoạt động":"Đã khóa"}</span></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>update(member.id,{action:"RESET_PASSWORD"})} className="btn-secondary text-sm"><Icon name="lock" size={16}/>Đặt lại mật khẩu</button><button type="button" disabled={busy} onClick={()=>update(member.id,{active:!member.active})} className={member.active?"rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white":"rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white"}>{member.active?"Khóa":"Mở lại"}</button></div></article>)}{!members.length&&<p className="p-10 text-center text-slate-500">Chưa có KTV.</p>}</div>}</section></div></main>;
}
