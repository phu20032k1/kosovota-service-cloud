"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

type RepairMessage = { id: string; attachment?: string | null };
type RepairTicket = {
  id: string;
  ticketCode: string;
  subject: string;
  status: string;
  createdAt: string;
  messages?: RepairMessage[];
};
type Machine = {
  id: string;
  serial?: string | null;
  model: string;
  supportTickets?: RepairTicket[];
};

const MAX_IMAGES = 4;

function displayMachine(machine: Machine) {
  return `${machine.serial || machine.id} · ${machine.model}`;
}

export default function CustomerRepairRequestButton() {
  const pathname = usePathname();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineId, setMachineId] = useState("");
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = useMemo(
    () => machines.find((machine) => machine.id === machineId) || machines[0] || null,
    [machineId, machines],
  );

  const load = useCallback(async () => {
    if (pathname !== "/customer-portal") return;
    try {
      const response = await fetch("/api/customer-portal", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.success) return;
      const rows = (result.machines || []) as Machine[];
      setMachines(rows);
      setMachineId((current) => current && rows.some((item) => item.id === current) ? current : rows[0]?.id || "");
    } catch {
      // Customer portal itself handles authentication/network errors.
    }
  }, [pathname]);

  useEffect(() => { void load(); }, [load]);

  async function uploadOne(file: File) {
    if (!file.type.startsWith("image/")) throw new Error("Chỉ được chọn tệp ảnh.");
    if (file.size > 8 * 1024 * 1024) throw new Error("Mỗi ảnh tối đa 8 MB.");
    const data = new FormData();
    data.append("file", file);
    data.append("purpose", "customer-repair");
    const response = await fetch("/api/upload", { method: "POST", body: data });
    const result = await response.json();
    if (!response.ok || !result.success || !result.url) throw new Error(result.message || "Không tải được ảnh.");
    return String(result.url);
  }

  async function chooseImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    const remaining = MAX_IMAGES - imageUrls.length;
    if (remaining <= 0) {
      setMessage({ ok: false, text: `Tối đa ${MAX_IMAGES} ảnh cho một yêu cầu.` });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const uploaded: string[] = [];
      for (const file of files.slice(0, remaining)) uploaded.push(await uploadOne(file));
      setImageUrls((current) => [...current, ...uploaded].slice(0, MAX_IMAGES));
      if (files.length > remaining) setMessage({ ok: false, text: `Chỉ nhận tối đa ${MAX_IMAGES} ảnh.` });
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Không tải được ảnh." });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!selected) return;
    if (description.trim().length < 5) {
      setMessage({ ok: false, text: "Hãy mô tả tình trạng máy rõ hơn." });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/customer-portal/repair-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineId: selected.id, description, imageUrls }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không gửi được yêu cầu sửa chữa.");
      const code = result.data?.ticketCode ? ` Mã yêu cầu: ${result.data.ticketCode}.` : "";
      setMessage({ ok: true, text: `${result.message || "Đã gửi yêu cầu."}${code}` });
      setDescription("");
      setImageUrls([]);
      await load();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : "Không gửi được yêu cầu sửa chữa." });
    } finally {
      setBusy(false);
    }
  }

  if (pathname !== "/customer-portal" || !machines.length) return null;

  const recent = selected?.supportTickets || [];
  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen(true); setMessage(null); }}
        className="fixed bottom-4 left-4 z-40 inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-3 text-sm font-black text-white shadow-xl hover:bg-red-700"
      >
        <Icon name="alert" size={17} /> Yêu cầu sửa chữa
      </button>

      {open && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/60 p-3">
          <section className="max-h-[94vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-red-600">Sửa chữa / bảo hành</p>
                <h2 className="mt-1 text-xl font-black">Gửi yêu cầu cho CSKH</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="icon-button"><Icon name="x" size={18} /></button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="field-label">Máy cần kiểm tra *</span>
                <select value={selected?.id || ""} onChange={(event) => setMachineId(event.target.value)} className="w-full">
                  {machines.map((machine) => <option key={machine.id} value={machine.id}>{displayMachine(machine)}</option>)}
                </select>
              </label>

              <label className="block">
                <span className="field-label">Mô tả sự cố *</span>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="w-full"
                  maxLength={2000}
                  placeholder="Ví dụ: máy không ra nước, rò nước, có tiếng kêu bất thường..."
                />
              </label>

              <label className="block rounded-2xl border border-dashed border-slate-300 p-4">
                <span className="block text-sm font-black">📷 Chụp hoặc chọn ảnh</span>
                <span className="mt-1 block text-xs text-slate-500">Tối đa {MAX_IMAGES} ảnh, mỗi ảnh tối đa 8 MB.</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={busy || imageUrls.length >= MAX_IMAGES}
                  onChange={(event) => void chooseImages(event)}
                  className="mt-3 block w-full text-sm"
                />
              </label>

              {imageUrls.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {imageUrls.map((url, index) => (
                    <div key={url} className="relative overflow-hidden rounded-xl border bg-slate-50">
                      <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Ảnh sự cố ${index + 1}`} className="h-28 w-full object-cover" /></a>
                      <button
                        type="button"
                        onClick={() => setImageUrls((current) => current.filter((item) => item !== url))}
                        className="absolute right-1 top-1 rounded-full bg-black/70 px-2 py-1 text-xs font-black text-white"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {message && <div className={`rounded-xl p-3 text-sm font-bold ${message.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{message.text}</div>}

              <button type="button" onClick={() => void submit()} disabled={busy || !selected} className="w-full rounded-xl bg-red-600 p-3 font-black text-white disabled:opacity-50">
                {busy ? "Đang xử lý..." : "Gửi yêu cầu sửa chữa"}
              </button>
            </div>

            {recent.length > 0 && (
              <div className="mt-6 border-t pt-5">
                <h3 className="font-black">Yêu cầu gần đây của máy này</h3>
                <div className="mt-3 space-y-2">
                  {recent.slice(0, 5).map((ticket) => (
                    <div key={ticket.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong>{ticket.ticketCode}</strong>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-black">{ticket.status}</span>
                      </div>
                      <p className="mt-1 text-slate-600">{ticket.subject}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
