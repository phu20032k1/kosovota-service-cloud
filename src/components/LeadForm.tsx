"use client";

import { FormEvent, useState } from "react";
import { PRODUCTS } from "@/data/products";

export default function LeadForm({ initialProduct }: { initialProduct?: string }) {
  const [productSlug, setProductSlug] = useState(initialProduct || "");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [province, setProvince] = useState("");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSlug, fullName, phone, province, note }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được yêu cầu.");

      setStatus({ type: "success", message: result.message });
      setFullName("");
      setPhone("");
      setProvince("");
      setNote("");
    } catch (error) {
      setStatus({ type: "error", message: error instanceof Error ? error.message : "Không gửi được yêu cầu." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-bold">Sản phẩm quan tâm</span>
          <select value={productSlug} onChange={(event) => setProductSlug(event.target.value)} className="form-input">
            <option value="">Tư vấn chung</option>
            {PRODUCTS.map((product) => <option key={product.slug} value={product.slug}>{product.name}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Họ và tên *</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="form-input" placeholder="Nhập họ và tên" required />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-bold">Số điện thoại *</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))} className="form-input" inputMode="numeric" placeholder="Nhập số điện thoại" required />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-bold">Tỉnh / thành phố</span>
          <input value={province} onChange={(event) => setProvince(event.target.value)} className="form-input" placeholder="Khu vực cần lắp đặt" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-2 block text-sm font-bold">Nhu cầu</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} className="form-input min-h-32" placeholder="Nguồn nước, số người sử dụng hoặc yêu cầu cần tư vấn" />
        </label>
      </div>

      {status && (
        <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-bold ${status.type === "success" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
          {status.message}
        </div>
      )}

      <button disabled={loading} className="mt-6 w-full rounded-xl bg-emerald-600 px-5 py-4 font-black text-white hover:bg-emerald-700 disabled:opacity-60">
        {loading ? "ĐANG GỬI..." : "GỬI YÊU CẦU TƯ VẤN"}
      </button>
    </form>
  );
}
