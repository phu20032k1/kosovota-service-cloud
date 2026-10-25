"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { SuperAdminHeader } from "@/components/ui/SuperAdminHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";
import { readApiResponse } from "@/lib/client-api";

type Mode = "super" | "admin";
type UserRow = {
  id: string;
  phone: string;
  name: string;
  role: string;
  dealerCode?: string | null;
  provinceScope?: string | null;
  wardScope?: string | null;
  customerScope?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
type DealerOption = { dealerCode: string; name: string; phone: string; province?: string | null };

const ROLE_NOTE: Record<string, string> = {
  ADMIN: "Quản trị toàn bộ hoạt động vận hành.",
  CSKH: "Chỉ xem dữ liệu nằm trong tỉnh/xã/mã khách hàng được giao.",
  DEALER: "Quản lý lệnh, kho và đội KTV của một đại lý.",
  CTV: "Có thể hoạt động độc lập hoặc liên kết với một đại lý.",
  KTV: "Nhận lệnh và gửi báo cáo kỹ thuật của đại lý.",
};

function scopeLabel(user: UserRow) {
  if (user.role !== "CSKH") {
    if (user.role === "CTV" && (!user.dealerCode || user.dealerCode.startsWith("CTV-"))) return "CTV độc lập";
    if (["DEALER", "CTV", "KTV"].includes(user.role)) return `Đại lý: ${user.dealerCode || "—"}`;
    return "Toàn hệ thống";
  }
  const parts = [
    user.provinceScope ? `Tỉnh: ${user.provinceScope}` : "",
    user.wardScope ? `Xã/phường: ${user.wardScope}` : "",
    user.customerScope ? `Mã KH: ${user.customerScope}` : "",
  ].filter(Boolean);
  return parts.join(" · ") || "Chưa phân phạm vi";
}

function ScopeFields({ province, ward, customer, onProvince, onWard, onCustomer }: {
  province: string;
  ward: string;
  customer: string;
  onProvince: (value: string) => void;
  onWard: (value: string) => void;
  onCustomer: (value: string) => void;
}) {
  return <div className="mt-4 space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
    <div>
      <p className="text-sm font-black text-emerald-950">Phạm vi dữ liệu CSKH</p>
      <p className="mt-1 text-xs leading-5 text-emerald-800">Các phạm vi có nhập sẽ được áp dụng đồng thời. Xã/phường phải đi cùng tỉnh để tránh trùng tên địa bàn.</p>
    </div>
    <label className="block">
      <span className="mb-2 block text-sm font-bold">Tỉnh/Thành</span>
      <input value={province} onChange={(event) => onProvince(event.target.value)} placeholder="Hà Nội hoặc HN, HCM" />
      <span className="mt-1 block text-xs text-slate-500">Có thể nhập mã hoặc tên tỉnh, nhiều giá trị cách nhau bằng dấu phẩy.</span>
    </label>
    <label className="block">
      <span className="mb-2 block text-sm font-bold">Xã/Phường được phụ trách</span>
      <textarea value={ward} onChange={(event) => onWard(event.target.value)} rows={2} placeholder="Dịch Vọng, Mai Dịch" className="w-full" />
    </label>
    <label className="block">
      <span className="mb-2 block text-sm font-bold">Mã khách hàng cụ thể</span>
      <textarea value={customer} onChange={(event) => onCustomer(event.target.value)} rows={2} placeholder="cm123..., cm456..." className="w-full" />
      <span className="mt-1 block text-xs text-slate-500">Nhập ID/mã khách hàng chính xác; phân cách bằng dấu phẩy, chấm phẩy hoặc xuống dòng.</span>
    </label>
  </div>;
}

export function UserManagementConsole({ mode }: { mode: Mode }) {
  const endpoint = mode === "super" ? "/api/super-admin/users" : "/api/admin/users";
  const allowedRoles = useMemo(() => mode === "super" ? ["ADMIN", "CSKH", "DEALER", "CTV", "KTV"] : ["CSKH", "DEALER", "CTV", "KTV"], [mode]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState(allowedRoles[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [provinceScope, setProvinceScope] = useState("");
  const [wardScope, setWardScope] = useState("");
  const [customerScope, setCustomerScope] = useState("");
  const [dealerCode, setDealerCode] = useState("");
  const [dealerProvince, setDealerProvince] = useState("");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editProvinceScope, setEditProvinceScope] = useState("");
  const [editWardScope, setEditWardScope] = useState("");
  const [editCustomerScope, setEditCustomerScope] = useState("");
  const [editDealerCode, setEditDealerCode] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await readApiResponse<{ users: UserRow[]; dealers: DealerOption[] }>(response);
      if (!response.ok || !result.success || !result.data) throw new Error(result.message || "Không tải được dữ liệu.");
      setUsers(result.data.users || []);
      setDealers(result.data.dealers || []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không kết nối được máy chủ.");
    }
  }, [endpoint]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!editingUser) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [editingUser]);

  const stats = useMemo(() => allowedRoles.map((item) => ({ role: item, total: users.filter((user) => user.role === item).length })), [allowedRoles, users]);
  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = [user.name, user.phone, user.role, user.dealerCode, user.provinceScope, user.wardScope, user.customerScope, scopeLabel(user)].filter(Boolean).join(" ").toLowerCase();
      return (roleFilter === "ALL" || user.role === roleFilter)
        && (statusFilter === "ALL" || (statusFilter === "ACTIVE" ? user.active : !user.active))
        && (!keyword || haystack.includes(keyword));
    });
  }, [roleFilter, searchTerm, statusFilter, users]);

  function resetCreateForm() {
    setName(""); setPhone(""); setProvinceScope(""); setWardScope(""); setCustomerScope(""); setDealerCode(""); setDealerProvince("");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, name, phone, provinceScope, wardScope, customerScope, dealerCode, dealerProvince }) });
    const result = await readApiResponse<UserRow>(response);
    if (!response.ok || !result.success) { setError(result.message || "Không tạo được tài khoản."); return; }
    setMessage(`Đã tạo ${role}. Mật khẩu ban đầu: ${typeof result.initialPassword === "string" ? result.initialPassword : "(không nhận được)"}`);
    resetCreateForm(); await load();
  }

  async function patchUser(payload: Record<string, unknown>) {
    const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const result = await readApiResponse<UserRow>(response);
    if (!response.ok || !result.success) throw new Error(result.message || "Không cập nhật được tài khoản.");
    return result;
  }

  async function toggleUser(user: UserRow) {
    setError(""); setMessage("");
    try { await patchUser({ id: user.id, active: !user.active }); setMessage(user.active ? `Đã khóa ${user.name}.` : `Đã mở lại ${user.name}.`); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không cập nhật được tài khoản."); }
  }

  function openEditModal(user: UserRow) {
    setEditingUser(user); setEditRole(user.role); setEditName(user.name); setEditPhone(user.phone);
    setEditProvinceScope(user.provinceScope || ""); setEditWardScope(user.wardScope || ""); setEditCustomerScope(user.customerScope || "");
    setEditDealerCode(user.role === "CTV" && (!user.dealerCode || user.dealerCode.startsWith("CTV-")) ? "" : user.dealerCode || "");
    setEditPassword(""); setEditPasswordConfirm(""); setGeneratedPassword(""); setShowPassword(false); setError("");
  }

  function closeEditModal() { setEditingUser(null); setEditPassword(""); setEditPasswordConfirm(""); setGeneratedPassword(""); setShowPassword(false); }

  async function resetPassword(user: UserRow) {
    setError("");
    try {
      const result = await patchUser({ id: user.id, resetPassword: true });
      setGeneratedPassword(typeof result.initialPassword === "string" ? result.initialPassword : "");
      setMessage(`Đã tạo mật khẩu mới cho ${user.name}.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Không đặt lại được mật khẩu."); }
  }

  async function saveEdit() {
    if (!editingUser) return;
    if (!editName.trim()) { setError("Tên không được để trống."); return; }
    if ((editPassword || editPasswordConfirm) && editPassword !== editPasswordConfirm) { setError("Mật khẩu và xác nhận không trùng."); return; }
    if (editPassword && editPassword.length < 10) { setError("Mật khẩu mới phải có ít nhất 10 ký tự."); return; }
    const updates: Record<string, unknown> = { id: editingUser.id, name: editName.trim(), phone: editPhone.trim(), role: editRole };
    if (editRole === "CSKH") Object.assign(updates, { provinceScope: editProvinceScope.trim(), wardScope: editWardScope.trim(), customerScope: editCustomerScope.trim() });
    if (["DEALER", "CTV", "KTV"].includes(editRole)) updates.dealerCode = editRole === "CTV" && editDealerCode.startsWith("CTV-") ? "" : editDealerCode.trim();
    if (editPassword) updates.resetPassword = editPassword;
    setSaving(true); setError("");
    try { const result = await patchUser(updates); setMessage(`Đã cập nhật tài khoản ${result.data?.name || editName.trim()}.`); closeEditModal(); await load(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Không cập nhật được tài khoản."); }
    finally { setSaving(false); }
  }

  async function deleteUser(user: UserRow) {
    if (!window.confirm(`Xóa tài khoản ${user.name}? Nếu đã có dữ liệu liên kết, hệ thống sẽ yêu cầu khóa thay vì xóa.`)) return;
    const response = await fetch(endpoint, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id }) });
    const result = await readApiResponse<{ id: string }>(response);
    if (!response.ok || !result.success) { setError(result.message || "Không xóa được tài khoản."); return; }
    setMessage(`Đã xóa tài khoản ${user.name}.`); await load();
  }

  const content = <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
    <section className={`grid gap-3 ${allowedRoles.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
      {stats.map((item) => <div key={item.role} className="rounded-2xl bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-slate-500">{item.role}</p><p className="mt-2 text-3xl font-black">{item.total}</p><p className="mt-2 text-xs leading-5 text-slate-500">{ROLE_NOTE[item.role]}</p></div>)}
    </section>
    {error && <Notice kind="error">{error}</Notice>}
    {message && <Notice kind="success">{message}</Notice>}

    <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <form onSubmit={createUser} className="h-fit rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-black">Tạo tài khoản</h2>
        <label className="mt-5 block"><span className="mb-2 block text-sm font-bold">Vai trò</span><select value={role} onChange={(event) => { setRole(event.target.value); setDealerCode(""); }} className="w-full">{allowedRoles.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Họ tên</span><input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Nguyễn Văn A" /></label>
        <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Số điện thoại đăng nhập</span><input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} required placeholder="09xxxxxxxx" /></label>
        {role === "CSKH" && <ScopeFields province={provinceScope} ward={wardScope} customer={customerScope} onProvince={setProvinceScope} onWard={setWardScope} onCustomer={setCustomerScope} />}
        {role === "DEALER" && <><label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Mã đại lý</span><input value={dealerCode} onChange={(event) => setDealerCode(event.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="DL0001" required /></label><label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Tỉnh/Thành đại lý</span><input value={dealerProvince} onChange={(event) => setDealerProvince(event.target.value)} placeholder="Hà Nội" /></label></>}
        {role === "CTV" && <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Liên kết đại lý (không bắt buộc)</span><select value={dealerCode} onChange={(event) => setDealerCode(event.target.value)} className="w-full"><option value="">CTV độc lập</option>{dealers.map((dealer) => <option key={dealer.dealerCode} value={dealer.dealerCode}>{dealer.dealerCode} — {dealer.name}</option>)}</select></label>}
        {role === "KTV" && <label className="mt-4 block"><span className="mb-2 block text-sm font-bold">Thuộc đại lý</span><select value={dealerCode} onChange={(event) => setDealerCode(event.target.value)} required className="w-full"><option value="">Chọn đại lý đã duyệt</option>{dealers.map((dealer) => <option key={dealer.dealerCode} value={dealer.dealerCode}>{dealer.dealerCode} — {dealer.name}</option>)}</select></label>}
        <button className="btn-primary mt-6 w-full px-5 py-3 font-extrabold text-white"><Icon name="plus" size={17} /> Tạo tài khoản</button>
      </form>

      <section className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="ALL">Tất cả vai trò</option>{allowedRoles.map((item) => <option key={item}>{item}</option>)}</select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="ALL">Tất cả trạng thái</option><option value="ACTIVE">Đang hoạt động</option><option value="LOCKED">Đã khóa</option></select>
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Tên, SĐT, tỉnh, xã, mã KH..." />
          </div>
          <p className="mt-3 text-xs font-bold text-slate-500">Đang hiển thị {filteredUsers.length}/{users.length} tài khoản.</p>
        </div>
        <div className="account-table-scroll overflow-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-4 py-3">Vai trò</th><th className="px-4 py-3">Người dùng</th><th className="px-4 py-3">Phạm vi</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Hành động</th></tr></thead>
            <tbody>{filteredUsers.map((user) => <tr key={user.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-black">{user.role}</td><td className="px-4 py-3"><strong>{user.name}</strong><p className="text-xs text-slate-500">{user.phone}</p></td><td className="max-w-md px-4 py-3 text-slate-600">{scopeLabel(user)}</td><td className="px-4 py-3"><span className={`status-pill ${user.active ? "status-green" : "status-slate"}`}>{user.active ? "Đang hoạt động" : "Đã khóa"}</span></td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => openEditModal(user)} className="btn-secondary px-3 py-2">Xem / sửa</button><button type="button" onClick={() => void toggleUser(user)} className="btn-secondary px-3 py-2">{user.active ? "Khóa" : "Mở"}</button><button type="button" onClick={() => void deleteUser(user)} className="ghost-danger px-3 py-2">Xóa</button></div></td></tr>)}</tbody>
          </table>
        </div>
        {!users.length && <p className="p-8 text-center text-sm text-slate-500">Chưa có tài khoản nào trong phạm vi quản lý.</p>}
      </section>
    </section>
  </div>;

  return <main className="min-h-screen bg-slate-100">
    {mode === "super" ? <SuperAdminHeader /> : <OperationsHeader title="Tài khoản vận hành" subtitle="Tạo và phân quyền CSKH, Đại lý, CTV, KTV" />}
    {content}
    {editingUser && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeEditModal(); }}>
      <section className="modal-panel max-w-2xl" role="dialog" aria-modal="true">
        <header className="modal-header"><div><p className="eyebrow">Quản lý tài khoản</p><h2 className="mt-1 text-xl font-black">Chi tiết tài khoản</h2><p className="mt-2 text-sm text-slate-500">Phạm vi CSKH được kiểm tra ở backend, không chỉ ẩn ở giao diện.</p></div><button type="button" onClick={closeEditModal} disabled={saving} className="icon-button"><Icon name="x" size={18} /></button></header>
        <div className="modal-body space-y-4">
          {error && <Notice kind="error">{error}</Notice>}
          <label className="block"><span className="text-sm font-bold">Vai trò</span><select className="mt-2 w-full" value={editRole} onChange={(event) => setEditRole(event.target.value)}>{allowedRoles.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="block"><span className="text-sm font-bold">Họ tên</span><input className="mt-2 w-full" value={editName} onChange={(event) => setEditName(event.target.value)} /></label>
          <label className="block"><span className="text-sm font-bold">Số điện thoại</span><input className="mt-2 w-full" inputMode="numeric" value={editPhone} onChange={(event) => setEditPhone(event.target.value.replace(/\D/g, ""))} /></label>
          {editRole === "CSKH" && <ScopeFields province={editProvinceScope} ward={editWardScope} customer={editCustomerScope} onProvince={setEditProvinceScope} onWard={setEditWardScope} onCustomer={setEditCustomerScope} />}
          {["DEALER", "CTV", "KTV"].includes(editRole) && <label className="block"><span className="text-sm font-bold">{editRole === "CTV" ? "Liên kết đại lý (không bắt buộc)" : "Thuộc đại lý"}</span><select className="mt-2 w-full" value={editDealerCode} onChange={(event) => setEditDealerCode(event.target.value)}><option value="">{editRole === "CTV" ? "CTV độc lập" : "Chọn đại lý"}</option>{dealers.map((dealer) => <option key={dealer.dealerCode} value={dealer.dealerCode}>{dealer.dealerCode} — {dealer.name}</option>)}</select></label>}
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="font-black text-amber-900">Mật khẩu</p><p className="text-xs text-amber-800">Có thể tạo ngẫu nhiên hoặc đặt mật khẩu mới.</p></div><button type="button" onClick={() => void resetPassword(editingUser)} className="btn-secondary">Tạo mật khẩu ngẫu nhiên</button></div>{generatedPassword && <div className="mt-3 flex flex-wrap items-center gap-2"><code className="font-black text-emerald-700">{showPassword ? generatedPassword : "••••••••••"}</code><button type="button" onClick={() => setShowPassword((value) => !value)} className="btn-secondary">{showPassword ? "Ẩn" : "Xem"}</button><button type="button" onClick={() => void navigator.clipboard.writeText(generatedPassword)} className="btn-secondary">Sao chép</button></div>}</div>
          <label className="block"><span className="text-sm font-bold">Mật khẩu mới</span><input type={showPassword ? "text" : "password"} className="mt-2 w-full" value={editPassword} onChange={(event) => setEditPassword(event.target.value)} placeholder="Để trống nếu không đổi" /></label>
          <label className="block"><span className="text-sm font-bold">Xác nhận mật khẩu</span><input type={showPassword ? "text" : "password"} className="mt-2 w-full" value={editPasswordConfirm} onChange={(event) => setEditPasswordConfirm(event.target.value)} /></label>
        </div>
        <footer className="modal-footer"><button type="button" onClick={() => void toggleUser(editingUser)} disabled={saving} className={editingUser.active ? "ghost-danger mr-auto" : "btn-secondary mr-auto"}>{editingUser.active ? "Khóa tài khoản" : "Mở tài khoản"}</button><button type="button" onClick={closeEditModal} disabled={saving} className="btn-secondary">Hủy</button><button type="button" onClick={() => void saveEdit()} disabled={saving} className="btn-primary px-5 py-3 font-bold text-white"><Icon name="check" size={17} />{saving ? "Đang lưu..." : "Lưu thay đổi"}</button></footer>
      </section>
    </div>}
  </main>;
}
