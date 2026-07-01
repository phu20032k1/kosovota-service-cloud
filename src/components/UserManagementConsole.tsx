"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { SuperAdminHeader } from "@/components/ui/SuperAdminHeader";
import { Icon } from "@/components/ui/Icon";
import { Notice } from "@/components/ui/Notice";

type Mode = "super" | "admin";
type UserRow = {
  id: string;
  phone: string;
  name: string;
  role: string;
  dealerCode?: string | null;
  provinceScope?: string | null;
  active: boolean;
  createdAt: string;
};
type DealerOption = {
  dealerCode: string;
  name: string;
  phone: string;
  province?: string | null;
};

const ROLE_NOTE: Record<string, string> = {
  ADMIN: "Quản trị toàn bộ hoạt động vận hành.",
  CSKH: "Chăm sóc dữ liệu trong phạm vi tỉnh được giao.",
  DEALER: "Quản lý lệnh, kho và đội KTV của một đại lý.",
  KTV: "Nhận lệnh và gửi báo cáo kỹ thuật của đại lý.",
};

export function UserManagementConsole({ mode }: { mode: Mode }) {
  const endpoint =
    mode === "super" ? "/api/super-admin/users" : "/api/admin/users";
  const allowedRoles = useMemo(
    () =>
      mode === "super"
        ? ["ADMIN", "CSKH", "DEALER", "KTV"]
        : ["CSKH", "DEALER", "KTV"],
    [mode],
  );
  const [users, setUsers] = useState<UserRow[]>([]);
  const [dealers, setDealers] = useState<DealerOption[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState(allowedRoles[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [provinceScope, setProvinceScope] = useState("");
  const [dealerCode, setDealerCode] = useState("");
  const [dealerProvince, setDealerProvince] = useState("");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editProvinceScope, setEditProvinceScope] = useState("");
  const [editDealerCode, setEditDealerCode] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scopeFilter, setScopeFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.message || "Không tải được dữ liệu.");
        return;
      }
      setUsers(result.data.users || []);
      setDealers(result.data.dealers || []);
    } catch {
      setError("Không kết nối được máy chủ.");
    }
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () =>
      allowedRoles.map((item) => ({
        role: item,
        total: users.filter((user) => user.role === item).length,
      })),
    [allowedRoles, users],
  );

  const scopeOptions = useMemo(() => {
    const values = new Set<string>();
    users.forEach((user) => {
      if (user.role === "CSKH" && user.provinceScope)
        values.add(`Tỉnh: ${user.provinceScope}`);
      if (["DEALER", "KTV"].includes(user.role) && user.dealerCode)
        values.add(`Đại lý: ${user.dealerCode}`);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const scopeText =
        user.role === "CSKH"
          ? `Tỉnh: ${user.provinceScope || ""}`
          : ["DEALER", "KTV"].includes(user.role)
            ? `Đại lý: ${user.dealerCode || ""}`
            : "Toàn hệ thống";
      const matchesRole = roleFilter === "ALL" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" ? user.active : !user.active);
      const matchesScope = scopeFilter === "ALL" || scopeText === scopeFilter;
      const matchesKeyword =
        !keyword ||
        [
          user.name,
          user.phone,
          user.role,
          user.dealerCode || "",
          user.provinceScope || "",
          scopeText,
        ]
          .join(" ")
          .toLowerCase()
          .includes(keyword);
      return matchesRole && matchesStatus && matchesScope && matchesKeyword;
    });
  }, [roleFilter, scopeFilter, searchTerm, statusFilter, users]);

  function resetFilters() {
    setRoleFilter("ALL");
    setStatusFilter("ALL");
    setScopeFilter("ALL");
    setSearchTerm("");
  }

  function resetCreateForm() {
    setName("");
    setPhone("");
    setProvinceScope("");
    setDealerCode("");
    setDealerProvince("");
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        name,
        phone,
        provinceScope,
        dealerCode,
        dealerProvince,
      }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message || "Không tạo được tài khoản.");
      return;
    }
    setMessage(`Đã tạo ${role}. Mật khẩu ban đầu: ${result.initialPassword}`);
    resetCreateForm();
    await load();
  }

  async function patchUser(payload: Record<string, unknown>) {
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || !result.success)
      throw new Error(result.message || "Không cập nhật được tài khoản.");
    return result;
  }

  async function toggleUser(user: UserRow) {
    setError("");
    setMessage("");
    try {
      await patchUser({ id: user.id, active: !user.active });
      setMessage(
        user.active ? `Đã khóa ${user.name}.` : `Đã mở lại ${user.name}.`,
      );
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không cập nhật được tài khoản.",
      );
    }
  }

  async function resetPassword(user: UserRow) {
    setError("");
    setMessage("");
    try {
      const result = await patchUser({ id: user.id, resetPassword: true });
      setMessage(`Mật khẩu mới của ${user.name}: ${result.initialPassword}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không đặt lại được mật khẩu.",
      );
    }
  }

  function openEditModal(user: UserRow) {
    setError("");
    setMessage("");
    setEditingUser(user);
    setEditName(user.name);
    setEditPhone(user.phone);
    setEditProvinceScope(user.provinceScope || "");
    setEditDealerCode(user.dealerCode || "");
    setEditPassword("");
    setEditPasswordConfirm("");
  }

  function closeEditModal() {
    setEditingUser(null);
    setEditPassword("");
    setEditPasswordConfirm("");
  }

  async function saveEdit() {
    if (!editingUser) return;
    setError("");
    setMessage("");
    if (!editName.trim()) {
      setError("Tên không được để trống.");
      return;
    }
    if (
      (editPassword || editPasswordConfirm) &&
      editPassword !== editPasswordConfirm
    ) {
      setError("Mật khẩu và xác nhận không trùng.");
      return;
    }
    if (editPassword && editPassword.length < 10) {
      setError("Mật khẩu mới phải có ít nhất 10 ký tự.");
      return;
    }

    const updates: Record<string, unknown> = {
      id: editingUser.id,
      name: editName.trim(),
      phone: editPhone.trim(),
    };
    if (editingUser.role === "CSKH")
      updates.provinceScope = editProvinceScope.trim();
    if (editingUser.role === "KTV") updates.dealerCode = editDealerCode.trim();
    if (editPassword) updates.resetPassword = editPassword;

    setSaving(true);
    try {
      const result = await patchUser(updates);
      setMessage(`Đã cập nhật tài khoản ${result.data.name}.`);
      closeEditModal();
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Không cập nhật được tài khoản.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: UserRow) {
    setError("");
    setMessage("");
    if (
      !window.confirm(
        `Xóa tài khoản ${user.name}? Nếu đã có dữ liệu liên kết, hệ thống sẽ yêu cầu khóa thay vì xóa.`,
      )
    )
      return;
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id }),
    });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setError(result.message || "Không xóa được tài khoản.");
      return;
    }
    setMessage(`Đã xóa tài khoản ${user.name}.`);
    await load();
  }

  const content = (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <section
        className={`grid gap-3 ${allowedRoles.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
      >
        {stats.map((item) => (
          <div key={item.role} className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-wider text-slate-500">
              {item.role}
            </p>
            <p className="mt-2 text-3xl font-black">{item.total}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {ROLE_NOTE[item.role]}
            </p>
          </div>
        ))}
      </section>

      {error && <Notice kind="error">{error}</Notice>}
      {message && <Notice kind="success">{message}</Notice>}

      <section className="grid gap-6 lg:grid-cols-[420px_minmax(0,1fr)]">
        <form
          onSubmit={createUser}
          className="h-fit rounded-2xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-lg font-black">Tạo tài khoản</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {mode === "super"
              ? "Super Admin tạo được Admin, CSKH, Đại lý và KTV."
              : "Admin tạo được CSKH, Đại lý và KTV."}
          </p>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm font-bold">Vai trò</span>
            <select
              value={role}
              onChange={(event) => {
                setRole(event.target.value);
                setDealerCode("");
              }}
              className="w-full"
            >
              {allowedRoles.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold">Họ tên</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Nguyễn Văn A"
            />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 block text-sm font-bold">
              Số điện thoại đăng nhập
            </span>
            <input
              value={phone}
              onChange={(event) =>
                setPhone(event.target.value.replace(/\D/g, ""))
              }
              required
              placeholder="09xxxxxxxx"
            />
          </label>

          {role === "CSKH" && (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold">Phạm vi tỉnh</span>
              <input
                value={provinceScope}
                onChange={(event) => setProvinceScope(event.target.value)}
                placeholder="01 hoặc 01,33"
                required
              />
              <span className="mt-1 block text-xs text-slate-500">
                Nhập mã tỉnh, nhiều mã cách nhau bằng dấu phẩy.
              </span>
            </label>
          )}

          {role === "DEALER" && (
            <>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold">Mã đại lý</span>
                <input
                  value={dealerCode}
                  onChange={(event) =>
                    setDealerCode(
                      event.target.value.toUpperCase().replace(/\s/g, ""),
                    )
                  }
                  placeholder="DL0001"
                  required
                />
              </label>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold">
                  Tỉnh/Thành đại lý
                </span>
                <input
                  value={dealerProvince}
                  onChange={(event) => setDealerProvince(event.target.value)}
                  placeholder="Hà Nội"
                />
              </label>
              <span className="mt-2 block text-xs leading-5 text-slate-500">
                Nếu mã chưa tồn tại, hệ thống tự tạo hồ sơ đại lý đã duyệt và
                liên kết tài khoản.
              </span>
            </>
          )}

          {role === "KTV" && (
            <label className="mt-4 block">
              <span className="mb-2 block text-sm font-bold">Thuộc đại lý</span>
              <select
                value={dealerCode}
                onChange={(event) => setDealerCode(event.target.value)}
                required
                className="w-full"
              >
                <option value="">Chọn đại lý đã duyệt</option>
                {dealers.map((dealer) => (
                  <option key={dealer.dealerCode} value={dealer.dealerCode}>
                    {dealer.dealerCode} — {dealer.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <button className="btn-primary mt-6 w-full px-5 py-3 font-extrabold text-white">
            <Icon name="plus" size={17} /> Tạo tài khoản
          </button>
        </form>

        <section className="min-w-0 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-lg font-black">Danh sách tài khoản</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Lọc theo bộ phận/vai trò, phạm vi, trạng thái, tên hoặc số
                  điện thoại.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[150px_180px_160px_minmax(220px,1fr)_auto]">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">
                    Bộ phận
                  </span>
                  <select
                    value={roleFilter}
                    onChange={(event) => setRoleFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                  >
                    <option value="ALL">Tất cả</option>
                    {allowedRoles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">
                    Phạm vi
                  </span>
                  <select
                    value={scopeFilter}
                    onChange={(event) => setScopeFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                  >
                    <option value="ALL">Tất cả phạm vi</option>
                    {scopeOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">
                    Trạng thái
                  </span>
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                  >
                    <option value="ALL">Tất cả</option>
                    <option value="ACTIVE">Đang hoạt động</option>
                    <option value="LOCKED">Đã khóa</option>
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase text-slate-500">
                    Tìm kiếm
                  </span>
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Tên, SĐT, đại lý, tỉnh..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold"
                  />
                </label>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-[46px] self-end rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black hover:bg-slate-50"
                >
                  Bỏ lọc
                </button>
              </div>
            </div>
            <p className="mt-3 text-xs font-bold text-slate-500">
              Đang hiển thị {filteredUsers.length}/{users.length} tài khoản.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">Vai trò</th>
                  <th className="px-4 py-3">Người dùng</th>
                  <th className="px-4 py-3">Phạm vi</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-t border-slate-100 align-top"
                  >
                    <td className="px-4 py-3 font-black">{user.role}</td>
                    <td className="px-4 py-3">
                      <strong>{user.name}</strong>
                      <p className="text-xs text-slate-500">{user.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {user.role === "CSKH"
                        ? `Tỉnh: ${user.provinceScope || "—"}`
                        : ["DEALER", "KTV"].includes(user.role)
                          ? `Đại lý: ${user.dealerCode || "—"}`
                          : "Toàn hệ thống"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${user.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
                      >
                        {user.active ? "Đang hoạt động" : "Đã khóa"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleUser(user)}
                          className="rounded-xl border border-slate-200 px-3 py-2 font-bold hover:bg-slate-50"
                        >
                          {user.active ? "Khóa" : "Mở"}
                        </button>
                        <button
                          type="button"
                          onClick={() => resetPassword(user)}
                          className="rounded-xl border border-slate-200 px-3 py-2 font-bold hover:bg-slate-50"
                        >
                          Đổi mật khẩu
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(user)}
                          className="rounded-xl border border-slate-200 px-3 py-2 font-bold hover:bg-slate-50"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteUser(user)}
                          className="rounded-xl border border-red-200 px-3 py-2 font-bold text-red-700 hover:bg-red-50"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                Chưa có tài khoản nào trong phạm vi quản lý.
              </p>
            )}
            {Boolean(users.length) && !filteredUsers.length && (
              <p className="p-8 text-center text-sm text-slate-500">
                Không có tài khoản nào khớp bộ lọc.
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  );

  return (
    <main className="min-h-screen bg-slate-100">
      {mode === "super" ? (
        <SuperAdminHeader />
      ) : (
        <OperationsHeader
          title="Tài khoản vận hành"
          subtitle="Tạo và quản lý CSKH, Đại lý, KTV"
        />
      )}
      {content}

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Sửa tài khoản</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Vai trò: {editingUser.role}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold"
              >
                Đóng
              </button>
            </div>
            <div className="mt-6 grid gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-700">Họ tên</span>
                <input
                  className="mt-2 w-full"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Số điện thoại
                </span>
                <input
                  className="mt-2 w-full"
                  value={editPhone}
                  onChange={(event) =>
                    setEditPhone(event.target.value.replace(/\D/g, ""))
                  }
                />
              </label>
              {editingUser.role === "CSKH" && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Phạm vi tỉnh
                  </span>
                  <input
                    className="mt-2 w-full"
                    value={editProvinceScope}
                    onChange={(event) =>
                      setEditProvinceScope(event.target.value)
                    }
                  />
                </label>
              )}
              {editingUser.role === "KTV" && (
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">
                    Thuộc đại lý
                  </span>
                  <select
                    className="mt-2 w-full"
                    value={editDealerCode}
                    onChange={(event) => setEditDealerCode(event.target.value)}
                  >
                    {dealers.map((dealer) => (
                      <option key={dealer.dealerCode} value={dealer.dealerCode}>
                        {dealer.dealerCode} — {dealer.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {editingUser.role === "DEALER" && (
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  Mã đại lý: <strong>{editingUser.dealerCode || "—"}</strong>.
                  Đổi mã tại hồ sơ đại lý để tránh lệch dữ liệu.
                </p>
              )}
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Mật khẩu mới
                </span>
                <input
                  type="password"
                  className="mt-2 w-full"
                  value={editPassword}
                  onChange={(event) => setEditPassword(event.target.value)}
                  placeholder="Để trống nếu không đổi"
                />
              </label>
              <label className="block">
                <span className="text-sm font-bold text-slate-700">
                  Xác nhận mật khẩu
                </span>
                <input
                  type="password"
                  className="mt-2 w-full"
                  value={editPasswordConfirm}
                  onChange={(event) =>
                    setEditPasswordConfirm(event.target.value)
                  }
                />
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-2xl border border-slate-200 px-5 py-3 font-bold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={saving}
                className="rounded-2xl bg-emerald-700 px-5 py-3 font-bold text-white disabled:opacity-60"
              >
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
