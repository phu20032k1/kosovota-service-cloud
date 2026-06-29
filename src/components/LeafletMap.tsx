"use client";

import { useEffect, useRef } from "react";

type LeafletMapInstance = {
  remove: () => void;
  fitBounds: (bounds: [number, number][], options?: unknown) => void;
  setView: (center: [number, number], zoom: number) => void;
  flyTo: (center: unknown, zoom: number, options?: unknown) => void;
  getZoom: () => number;
  invalidateSize: () => void;
};

type CircleMarker = {
  remove: () => void;
  bindTooltip: (content: string, options?: unknown) => CircleMarker;
  on: (event: string, fn: () => void) => CircleMarker;
  addTo: (map: LeafletMapInstance) => CircleMarker;
  getLatLng: () => unknown;
  openTooltip: () => void;
};

type LeafletGlobal = {
  map: (element: HTMLElement, options?: unknown) => LeafletMapInstance;
  tileLayer: (url: string, options?: unknown) => { addTo: (map: LeafletMapInstance) => void };
  circleMarker: (latlng: [number, number], options?: unknown) => CircleMarker;
};

let leafletPromise: Promise<LeafletGlobal> | null = null;

function currentLeaflet() {
  return (window as unknown as { L?: LeafletGlobal }).L;
}

function loadLeaflet() {
  const existingLeaflet = currentLeaflet();
  if (existingLeaflet) return Promise.resolve(existingLeaflet);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise<LeafletGlobal>((resolve, reject) => {
    if (!document.querySelector('link[data-kosovota-leaflet="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css";
      link.dataset.kosovotaLeaflet = "true";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-kosovota-leaflet="true"]');
    if (existing) {
      existing.addEventListener("load", () => currentLeaflet() ? resolve(currentLeaflet()!) : reject(new Error("Leaflet không khởi tạo được.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.kosovotaLeaflet = "true";
    script.onload = () => currentLeaflet() ? resolve(currentLeaflet()!) : reject(new Error("Leaflet không khởi tạo được."));
    script.onerror = () => reject(new Error("Không tải được thư viện bản đồ."));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  description?: string;
  color: string;
  radius?: number;
};

type Props = {
  markers: MapMarker[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  emptyMessage?: string;
};

export default function LeafletMap({
  markers,
  selectedId,
  onSelect,
  className = "h-[650px]",
  emptyMessage = "Chưa có điểm GPS để hiển thị.",
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const markerRefs = useRef<Map<string, CircleMarker>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const markersForCleanup = markerRefs.current;

    async function setupMap() {
      if (!containerRef.current || mapRef.current) return;
      const L = await loadLeaflet();
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      map.setView([16.1, 106.1], 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 0);
    }

    setupMap();

    return () => {
      cancelled = true;
      markersForCleanup.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function renderMarkers() {
      const map = mapRef.current;
      if (!map) {
        window.setTimeout(renderMarkers, 50);
        return;
      }

      const L = await loadLeaflet();
      if (cancelled) return;

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current.clear();

      const bounds: [number, number][] = [];

      markers.forEach((item) => {
        const marker = L.circleMarker([item.lat, item.lng], {
          radius: item.radius ?? 10,
          color: "#ffffff",
          weight: 3,
          fillColor: item.color,
          fillOpacity: 1,
        });

        marker.bindTooltip(
          `<strong>${escapeHtml(item.label)}</strong>${item.description ? `<br>${escapeHtml(item.description)}` : ""}`,
          { direction: "top", offset: [0, -8] },
        );
        marker.on("click", () => onSelect?.(item.id));
        marker.addTo(map);
        markerRefs.current.set(item.id, marker);
        bounds.push([item.lat, item.lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 15);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [45, 45], maxZoom: 15 });
      }
    }

    renderMarkers();
    return () => {
      cancelled = true;
    };
  }, [markers, onSelect]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const marker = markerRefs.current.get(selectedId);
    if (!marker) return;
    mapRef.current.flyTo(marker.getLatLng(), Math.max(mapRef.current.getZoom(), 15), {
      duration: 0.5,
    });
    marker.openTooltip();
  }, [selectedId]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-lg">
      <div ref={containerRef} className={`w-full ${className}`} aria-label="Bản đồ KOSOVOTA" />
      {markers.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/75 p-6 text-center font-semibold text-slate-600">
          {emptyMessage}
        </div>
      )}
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#039;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}
