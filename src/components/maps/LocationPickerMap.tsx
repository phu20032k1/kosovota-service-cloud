"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

type Location = { lat: number; lng: number };
type Leaflet = {
  map: (element: HTMLElement, options?: Record<string, unknown>) => any;
  tileLayer: (url: string, options?: Record<string, unknown>) => { addTo: (map: any) => void };
  marker: (point: [number, number], options?: Record<string, unknown>) => any;
};

declare global {
  interface Window { L?: Leaflet }
}

let leafletPromise: Promise<Leaflet> | null = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<Leaflet>((resolve, reject) => {
    if (!document.querySelector('link[data-kosovota-leaflet="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.kosovotaLeaflet = "true";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-kosovota-leaflet="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.kosovotaLeaflet = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được."));
    script.onerror = () => reject(new Error("Không tải được bản đồ chọn vị trí."));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export default function LocationPickerMap({ value, onChange, height = 360 }: { value?: Location | null; onChange: (location: Location) => void; height?: number }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [error, setError] = useState("");

  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!elementRef.current) return;
      try {
        const L = await loadLeaflet();
        if (cancelled || !elementRef.current) return;
        const center: [number, number] = value ? [value.lat, value.lng] : [16.3, 106.8];
        const map = L.map(elementRef.current, { zoomControl: true, scrollWheelZoom: true }).setView(center, value ? 16 : 5);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: "&copy; OpenStreetMap contributors" }).addTo(map);
        mapRef.current = map;
        if (value) markerRef.current = L.marker([value.lat, value.lng]).addTo(map);
        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          const next = { lat: event.latlng.lat, lng: event.latlng.lng };
          if (markerRef.current) markerRef.current.setLatLng([next.lat, next.lng]);
          else markerRef.current = L.marker([next.lat, next.lng]).addTo(map);
          onChangeRef.current(next);
        });
        window.setTimeout(() => map.invalidateSize(), 0);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không tải được bản đồ.");
      }
    }
    void start();
    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!value || !mapRef.current || !window.L) return;
    if (markerRef.current) markerRef.current.setLatLng([value.lat, value.lng]);
    else markerRef.current = window.L.marker([value.lat, value.lng]).addTo(mapRef.current);
  }, [value?.lat, value?.lng]);

  return <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100" style={{ height }}>
    <div ref={elementRef} className="h-full w-full" />
    {error && <div className="absolute inset-0 grid place-items-center bg-white/95 p-6 text-center text-sm font-bold text-red-700"><span><Icon name="alert" size={22} className="mx-auto mb-2" />{error}</span></div>}
    <div className="pointer-events-none absolute left-3 top-3 rounded-xl bg-white/95 px-3 py-2 text-xs font-bold text-slate-700 shadow-sm">
      Bấm vào vị trí chính xác của máy
    </div>
  </div>;
}
