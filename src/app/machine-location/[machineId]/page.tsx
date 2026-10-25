"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import LocationPickerMap from "@/components/maps/LocationPickerMap";
import { ActionSessionBar } from "@/components/ActionSessionBar";
import { Icon } from "@/components/ui/Icon";
import { LoadingState } from "@/components/ui/LoadingState";
import { Notice } from "@/components/ui/Notice";

type Location = { lat: number; lng: number };
type Machine = { id: string; model: string; name?: string | null; serial?: string | null; lat?: number | null; lng?: number | null };

export default function MachineLocationPage() {
  const params = useParams<{ machineId: string }>();
  const machineId = params.machineId;
  const [machine, setMachine] = useState<Machine | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/machines/${encodeURIComponent(machineId)}`, { cache: "no-store" })
      .then(async (response) => ({ response, result: await response.json() }))
      .then(({ response, result }) => {
        if (cancelled) return;
        if (!response.ok || !result.success) throw new Error(result.message || "Không tải được máy.");
        setMachine(result.data);
        if (result.data.lat != null && result.data.lng != null) setLocation({ lat: result.data.lat, lng: result.data.lng });
      })
      .catch((error) => { if (!cancelled) setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không tải được máy." }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [machineId]);

  function useCurrentGps() {
    if (!navigator.geolocation) {
      setNotice({ kind: "error", text: "Trình duyệt không hỗ trợ định vị GPS." });
      return;
    }
    setNotice({ kind: "info", text: "Đang lấy vị trí hiện tại..." });
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        setNotice({ kind: "info", text: "Đã lấy GPS hiện tại. Kiểm tra marker rồi bấm Lưu vị trí." });
      },
      () => setNotice({ kind: "error", text: "Không lấy được GPS. Hãy bật quyền vị trí hoặc bấm trực tiếp trên bản đồ." }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  async function saveLocation() {
    if (!location || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(`/api/machines/${encodeURIComponent(machineId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...location, source: "MANUAL_FIELD_PIN" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "Không lưu được vị trí.");
      setMachine((current) => current ? { ...current, lat: location.lat, lng: location.lng } : current);
      setNotice({ kind: "success", text: "Đã cập nhật vị trí máy. Tọa độ mới sẽ được dùng cho điều phối đại lý gần nhất." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Không lưu được vị trí." });
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-slate-100">
    <ActionSessionBar title="Ghim vị trí máy" />
    <section className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      {notice && <Notice kind={notice.kind}>{notice.text}</Notice>}
      {loading ? <LoadingState label="Đang tải vị trí máy..." /> : !machine ? <Notice kind="error">Không tìm thấy máy.</Notice> : <>
        <div className="surface-card p-5">
          <p className="eyebrow">Chỉnh vị trí thực địa</p>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{machine.name || machine.model}</h1>
          <p className="mt-2 text-sm text-slate-500">ID: <strong>{machine.id}</strong>{machine.serial ? ` · Seri: ${machine.serial}` : ""}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">Bấm đúng vị trí của máy trên bản đồ hoặc dùng GPS hiện tại. Đại lý/CTV/KTV chỉ có thể sửa khi đang được giao lệnh của máy này.</p>
        </div>

        <LocationPickerMap value={location} onChange={setLocation} height={480} />

        <div className="surface-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-600">
            <strong className="block text-slate-900">Tọa độ đang chọn</strong>
            {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "Chưa chọn vị trí"}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={useCurrentGps} className="btn-secondary"><Icon name="navigation" size={17} /> Dùng GPS hiện tại</button>
            <button type="button" onClick={() => void saveLocation()} disabled={!location || saving} className="btn-primary px-5 py-3 font-black text-white disabled:opacity-50"><Icon name="map-pin" size={17} /> {saving ? "Đang lưu..." : "Lưu vị trí"}</button>
          </div>
        </div>

        <Link href={`/qr/${encodeURIComponent(machineId)}`} className="btn-secondary inline-flex">Quay về QR</Link>
      </>}
    </section>
  </main>;
}
