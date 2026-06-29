"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  color?: string;
  glyph?: "droplet" | "store" | "wrench" | "star" | "user";
};

type InteractiveMapProps = {
  markers: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  height?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
};

type LeafletMap = {
  remove: () => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  setView: (center: [number, number], zoom: number) => void;
  invalidateSize: () => void;
};
type LeafletMarker = { remove: () => void; on: (event: string, fn: () => void) => LeafletMarker; bindTooltip: (content: string, options?: unknown) => LeafletMarker; addTo: (map: LeafletMap) => LeafletMarker };
type LeafletGlobal = {
  map: (element: HTMLElement, options?: unknown) => LeafletMap;
  tileLayer: (url: string, options?: unknown) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: unknown) => LeafletMarker;
  divIcon: (options: unknown) => unknown;
  latLngBounds: (points: [number, number][]) => unknown;
};

type GoogleMapInstance = { fitBounds: (bounds: unknown, padding?: number) => void; setCenter: (center: { lat: number; lng: number }) => void; setZoom: (zoom: number) => void };
type GoogleMarkerInstance = { setMap: (map: null) => void };
type GoogleMapsGlobal = {
  Map: new (element: HTMLElement, options: unknown) => GoogleMapInstance;
  Marker: new (options: unknown) => GoogleMarkerInstance & { addListener: (event: string, fn: () => void) => void };
  LatLngBounds: new () => { extend: (point: { lat: number; lng: number }) => void };
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
    google?: { maps: GoogleMapsGlobal };
  }
}

let leafletPromise: Promise<LeafletGlobal> | null = null;
let googlePromise: Promise<GoogleMapsGlobal> | null = null;

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
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
      existing.addEventListener("load", () => window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.kosovotaLeaflet = "true";
    script.onload = () => window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được."));
    script.onerror = () => reject(new Error("Không tải được thư viện bản đồ."));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

function loadGoogleMaps(key: string) {
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googlePromise) return googlePromise;
  googlePromise = new Promise<GoogleMapsGlobal>((resolve, reject) => {
    const callback = `__kosovotaMapsReady_${Date.now()}`;
    (window as unknown as Record<string, unknown>)[callback] = () => {
      delete (window as unknown as Record<string, unknown>)[callback];
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps không khởi tạo được."));
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=${callback}`;
    script.async = true;
    script.defer = true;
    script.onerror = () => reject(new Error("Không tải được Google Maps."));
    document.head.appendChild(script);
  });
  return googlePromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function safeMarkerColor(value?: string) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#059669";
}

function markerGlyph(glyph: MapMarker["glyph"]) {
  if (glyph === "store") return "S";
  if (glyph === "wrench") return "K";
  if (glyph === "star") return "★";
  if (glyph === "user") return "N";
  return "●";
}

function markerSvg(marker: MapMarker, active: boolean) {
  const color = safeMarkerColor(marker.color);
  const glyph = markerGlyph(marker.glyph);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56"><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".24"/></filter><path filter="url(#s)" d="M24 2C12.4 2 3 11.4 3 23c0 15 21 31 21 31s21-16 21-31C45 11.4 35.6 2 24 2Z" fill="${color}" stroke="white" stroke-width="${active ? 4 : 3}"/><circle cx="24" cy="23" r="11" fill="white" fill-opacity=".98"/><text x="24" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="${glyph === "★" ? 15 : 13}" font-weight="800" fill="${color}">${glyph}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function InteractiveMap({ markers, activeId, onSelect, className = "", height = 650, center = { lat: 16.05, lng: 107.85 }, zoom = 5 }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletMarkersRef = useRef<LeafletMarker[]>([]);
  const googleMapRef = useRef<GoogleMapInstance | null>(null);
  const googleMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const provider = (process.env.NEXT_PUBLIC_MAP_PROVIDER || "osm").toLowerCase();
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
  const normalizedMarkers = useMemo(() => markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)), [markers]);
  const centerLat = center.lat;
  const centerLng = center.lng;

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!containerRef.current) return;
      setError("");
      try {
        if (provider === "google" && googleKey) {
          const maps = await loadGoogleMaps(googleKey);
          if (cancelled || !containerRef.current) return;
          googleMapRef.current = new maps.Map(containerRef.current, {
            center: { lat: centerLat, lng: centerLng }, zoom, mapTypeControl: false, streetViewControl: false, fullscreenControl: true,
            clickableIcons: false, gestureHandling: "greedy",
            styles: [
              { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
              { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
            ],
          });
        } else {
          const L = await loadLeaflet();
          if (cancelled || !containerRef.current) return;
          const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, preferCanvas: true });
          map.setView([centerLat, centerLng], zoom);
          const tileUrl = maptilerKey
            ? `https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}.png?key=${encodeURIComponent(maptilerKey)}`
            : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
          L.tileLayer(tileUrl, {
            maxZoom: 20,
            attribution: maptilerKey ? '&copy; MapTiler &copy; OpenStreetMap contributors' : '&copy; OpenStreetMap contributors',
          }).addTo(map);
          leafletMapRef.current = map;
          window.setTimeout(() => map.invalidateSize(), 100);
        }
        if (!cancelled) setReady(true);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không tải được bản đồ.");
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      leafletMarkersRef.current.forEach((marker) => marker.remove());
      leafletMarkersRef.current = [];
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      googleMarkersRef.current.forEach((marker) => marker.setMap(null));
      googleMarkersRef.current = [];
      googleMapRef.current = null;
    };
  }, [provider, googleKey, maptilerKey, centerLat, centerLng, zoom]);

  useEffect(() => {
    if (!ready) return;
    if (googleMapRef.current && window.google?.maps) {
      const maps = window.google.maps;
      googleMarkersRef.current.forEach((marker) => marker.setMap(null));
      googleMarkersRef.current = [];
      const bounds = new maps.LatLngBounds();
      normalizedMarkers.forEach((marker) => {
        const instance = new maps.Marker({
          map: googleMapRef.current,
          position: { lat: marker.lat, lng: marker.lng },
          title: marker.title,
          icon: {
            url: markerSvg(marker, marker.id === activeId),
            scaledSize: new maps.Size(marker.id === activeId ? 52 : 44, marker.id === activeId ? 61 : 52),
            anchor: new maps.Point(marker.id === activeId ? 26 : 22, marker.id === activeId ? 57 : 48),
          },
          optimized: true,
        });
        instance.addListener("click", () => onSelect?.(marker.id));
        googleMarkersRef.current.push(instance);
        bounds.extend({ lat: marker.lat, lng: marker.lng });
      });
      if (normalizedMarkers.length > 1) googleMapRef.current.fitBounds(bounds, 72);
      else if (normalizedMarkers.length === 1) { googleMapRef.current.setCenter({ lat: normalizedMarkers[0].lat, lng: normalizedMarkers[0].lng }); googleMapRef.current.setZoom(14); }
    }

    if (leafletMapRef.current && window.L) {
      const L = window.L;
      leafletMarkersRef.current.forEach((marker) => marker.remove());
      leafletMarkersRef.current = normalizedMarkers.map((marker) => {
        const color = safeMarkerColor(marker.color);
        const glyph = markerGlyph(marker.glyph);
        const active = marker.id === activeId;
        const html = `<div class="kosovota-map-marker ${active ? "is-active" : ""}" style="--marker-color:${color}"><span>${glyph}</span></div>`;
        return L.marker([marker.lat, marker.lng], {
          icon: L.divIcon({ className: "kosovota-map-marker-wrap", html, iconSize: [active ? 50 : 44, active ? 58 : 52], iconAnchor: [active ? 25 : 22, active ? 55 : 49] }),
          title: marker.title,
        }).bindTooltip(`<strong>${escapeHtml(marker.title)}</strong>${marker.subtitle ? `<br/><span>${escapeHtml(marker.subtitle)}</span>` : ""}`, { direction: "top", offset: [0, -40] }).on("click", () => onSelect?.(marker.id)).addTo(leafletMapRef.current!);
      });
      if (normalizedMarkers.length > 1) leafletMapRef.current.fitBounds(L.latLngBounds(normalizedMarkers.map((m) => [m.lat, m.lng])), { padding: [56, 56], maxZoom: 14 });
      else if (normalizedMarkers.length === 1) leafletMapRef.current.setView([normalizedMarkers[0].lat, normalizedMarkers[0].lng], 14);
    }
  }, [normalizedMarkers, activeId, onSelect, ready]);

  return (
    <div className={`map-frame ${className}`} style={{ height }}>
      <div ref={containerRef} className="h-full w-full" aria-label="Bản đồ KOSOVOTA" />
      {!ready && !error && <div className="map-overlay"><span className="animate-spin"><Icon name="refresh" size={22}/></span><span>Đang tải bản đồ...</span></div>}
      {error && <div className="map-overlay map-error"><Icon name="alert" size={24}/><strong>{error}</strong><span>Kiểm tra Internet hoặc khóa API trong file .env.</span></div>}
      <div className="map-provider-badge"><Icon name="map" size={14}/><span>{provider === "google" && googleKey ? "Google Maps" : maptilerKey ? "MapTiler" : "OpenStreetMap"}</span></div>
    </div>
  );
}
