"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PortalHeader } from "@/components/ui/PortalHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";
import { Icon } from "@/components/ui/Icon";
import { readApiResponse } from "@/lib/client-api";

type Data = {
  warehouses: {
    id: string;
    code: string;
    name: string;
    balances: {
      id: string;
      quantity: number;
      reserved: number;
      item: { sku: string; name: string; unit: string; minStock: number };
    }[];
  }[];
  movements: {
    id: string;
    movementCode: string;
    type: string;
    quantity: number;
    createdAt: string;
    item: { sku: string; name: string };
    fromWarehouse?: { name: string } | null;
    toWarehouse?: { name: string } | null;
  }[];
  totals: { quantity: number; reserved: number; value: number; lowStock: number };
};

const date = (value: string) =>
  new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));

export default function DealerInventoryPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/inventory", { cache: "no-store" });
      const result = await readApiResponse<Data>(response);
      if (!response.ok || !result.success || !result.data) {
        throw new Error(result.message || "Không tải được kho đại lý.");
      }
      setData(result.data);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : "Không tải được kho đại lý.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const balances = useMemo(
    () => data?.warehouses.flatMap((warehouse) => warehouse.balances.map((balance) => ({ ...balance, warehouse }))) || [],
    [data],
  );

  return (
    <main className="min-h-screen">
      <PortalHeader
        title="Kho vật tư đại lý"
        subtitle="Theo dõi tồn thực tế và lịch sử nhận/xuất vật tư"
        homeHref="/agent-portal"
        homeLabel="Lệnh dịch vụ"
        onLogout={() => fetch("/api/auth/logout", { method: "POST" }).then(() => location.assign("/login"))}
      >
        <Link href="/agent-portal" className="btn-secondary"><Icon name="wrench" size={16}/>Lệnh dịch vụ</Link>
        <Link href="/agent-portal/payments" className="btn-secondary"><Icon name="wallet" size={16}/>Đối soát</Link>
        <button type="button" onClick={() => void load()} disabled={loading} className="btn-secondary"><Icon name="refresh" size={16}/>Tải lại</button>
      </PortalHeader>

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        {error && <Notice kind="error">{error}</Notice>}

        {loading ? (
          <LoadingState label="Đang tải kho đại lý..." />
        ) : data ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Tổng tồn" value={data.totals.quantity} icon="package" tone="emerald"/>
              <MetricCard label="Đang giữ chỗ" value={data.totals.reserved} icon="lock" tone="blue"/>
              <MetricCard label="Cảnh báo thấp" value={data.totals.lowStock} icon="alert" tone="rose"/>
              <MetricCard label="Kho đang quản lý" value={data.warehouses.length} icon="store" tone="violet"/>
            </section>

            {!data.warehouses.length && (
              <Notice kind="warning">Đại lý này chưa được gắn kho vật tư. Admin cần tạo một kho loại “Kho đại lý” và chọn đúng đại lý sở hữu.</Notice>
            )}

            <section className="surface-card">
              <div className="data-toolbar">
                <div>
                  <h2 className="page-section-title">Tồn vật tư</h2>
                  <p className="page-section-subtitle">Vui lòng liên hệ điều phối khi cần bổ sung hàng</p>
                </div>
              </div>
              <div className="admin-data-scroll overflow-auto">
                <table className="min-w-[720px] w-full text-sm">
                  <thead><tr>{["Kho","Mã","Vật tư","Tồn","Giữ chỗ","Khả dụng","Đơn vị"].map((header) => <th key={header} className="p-3 text-left">{header}</th>)}</tr></thead>
                  <tbody>
                    {balances.map((balance) => (
                      <tr key={balance.id}>
                        <td className="p-3 font-bold">{balance.warehouse.name}</td>
                        <td className="p-3 font-black">{balance.item.sku}</td>
                        <td className="p-3">{balance.item.name}</td>
                        <td className="p-3 font-black">{balance.quantity}</td>
                        <td className="p-3">{balance.reserved}</td>
                        <td className="p-3 font-black text-emerald-700">{Math.max(0, balance.quantity - balance.reserved)}</td>
                        <td className="p-3">{balance.item.unit}</td>
                      </tr>
                    ))}
                    {!balances.length && <tr><td colSpan={7} className="p-10 text-center text-slate-500">Kho chưa có vật tư. Admin cần lập phiếu nhập hoặc điều chuyển hàng vào kho đại lý.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="surface-card">
              <div className="data-toolbar"><h2 className="page-section-title">Giao dịch gần đây</h2></div>
              <div className="max-h-[60dvh] divide-y overflow-y-auto">
                {data.movements.slice(0, 20).map((movement) => (
                  <div key={movement.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-black">{movement.movementCode} · {movement.item.name}</p>
                      <p className="text-xs text-slate-500">{movement.fromWarehouse?.name || "Nguồn ngoài"} → {movement.toWarehouse?.name || "Đã xuất sử dụng"}</p>
                    </div>
                    <div className="sm:text-right">
                      <strong>{movement.type} · {movement.quantity}</strong>
                      <p className="text-xs text-slate-500">{date(movement.createdAt)}</p>
                    </div>
                  </div>
                ))}
                {!data.movements.length && <p className="p-8 text-center text-slate-500">Chưa có giao dịch kho.</p>}
              </div>
            </section>
          </>
        ) : (
          <div className="surface-card p-8 text-center">
            <p className="font-bold text-slate-700">Không thể tải dữ liệu kho.</p>
            <button type="button" onClick={() => void load()} className="btn-primary mt-4 px-5 py-3 font-black text-white">Thử lại</button>
          </div>
        )}
      </div>
    </main>
  );
}
