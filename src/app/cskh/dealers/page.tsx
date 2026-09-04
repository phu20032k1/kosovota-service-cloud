"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OperationsHeader } from "@/components/ui/OperationsHeader";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type Dealer = {
  id: string;
  dealerCode: string;
  name: string;
  phone: string;
  province?: string | null;
  address?: string | null;
  services?: string | null;
  technicianCount?: number | null;
  status: string;
  lat?: number | null;
  lng?: number | null;
};

export default function CskhDealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("q", query.trim());
        const response = await fetch(`/api/dealers?${params}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "Không tải được đại lý.");
        setDealers(result.data || []);
      } catch (value) {
        if (value instanceof DOMException && value.name === "AbortError") return;
        setError(value instanceof Error ? value.message : "Không tải được đại lý.");
      } finally {
        if (controllerRef.current === controller) setLoading(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controllerRef.current?.abort();
    };
  }, [query]);

  const approved = useMemo(() => dealers.filter((dealer) => dealer.status === "APPROVED"), [dealers]);

  return (
    <main className="min-h-screen bg-slate-100">
      <OperationsHeader
        title="Đại lý trong phạm vi CSKH"
        subtitle="Chỉ đọc · tự động giới hạn theo tỉnh được phân quyền"
      />
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <Notice kind="info">Màn hình này không có quyền duyệt, sửa hoặc xóa đại lý. Dữ liệu được lọc ở API theo phạm vi tỉnh của tài khoản CSKH.</Notice>
        {error && <Notice kind="error">{error}</Notice>}

        <section className="surface-card p-4">
          <label className="relative block">
            <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm mã đại lý, tên, SĐT, địa chỉ hoặc dịch vụ..."
              className="pl-11"
            />
          </label>
        </section>

        {loading ? <LoadingState label="Đang tìm đại lý trong phạm vi được giao..." /> : (
          <section className="surface-card overflow-hidden">
            <div className="border-b p-4 text-sm font-bold text-slate-600">Hiển thị {approved.length} đại lý đã duyệt</div>
            <div className="overflow-x-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead><tr><th className="p-3 text-left">Mã</th><th className="p-3 text-left">Đại lý</th><th className="p-3 text-left">Tỉnh / địa chỉ</th><th className="p-3 text-left">Dịch vụ</th><th className="p-3 text-left">Kỹ thuật viên</th><th className="p-3 text-left">GPS</th></tr></thead>
                <tbody>
                  {approved.map((dealer) => (
                    <tr key={dealer.id} className="border-t border-slate-100">
                      <td className="p-3 font-black text-emerald-700">{dealer.dealerCode}</td>
                      <td className="p-3"><strong>{dealer.name}</strong><div><a href={`tel:${dealer.phone}`} className="text-blue-700">{dealer.phone}</a></div></td>
                      <td className="p-3"><strong>{dealer.province || "—"}</strong><div className="max-w-sm text-xs text-slate-500">{dealer.address || "Chưa có địa chỉ"}</div></td>
                      <td className="p-3">{dealer.services || "—"}</td>
                      <td className="p-3 font-bold">{dealer.technicianCount ?? "—"}</td>
                      <td className="p-3">{dealer.lat != null && dealer.lng != null ? <span className="status-pill status-emerald">Đã ghim</span> : <span className="status-pill status-slate">Chưa ghim</span>}</td>
                    </tr>
                  ))}
                  {!approved.length && <tr><td colSpan={6} className="p-10 text-center text-slate-500">Không có đại lý phù hợp trong phạm vi tỉnh được giao.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
