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

type LeafletMarker = {
  remove: () => void;
  on: (event: string, fn: () => void) => LeafletMarker;
  bindTooltip: (content: string, options?: unknown) => LeafletMarker;
  addTo: (map: LeafletMap) => LeafletMarker;
};

type LeafletGlobal = {
  map: (element: HTMLElement, options?: unknown) => LeafletMap;
  tileLayer: (url: string, options?: unknown) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: unknown) => LeafletMarker;
  divIcon: (options: unknown) => unknown;
  latLngBounds: (points: [number, number][]) => unknown;
};

type GoogleMapInstance = {
  fitBounds: (bounds: unknown, padding?: number) => void;
  setCenter: (center: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
};

type GoogleMarkerInstance = { setMap: (map: null) => void };

type GoogleMapsGlobal = {
  Map: new (element: HTMLElement, options: unknown) => GoogleMapInstance;
  Marker: new (options: unknown) => GoogleMarkerInstance & { addListener: (event: string, fn: () => void) => void };
  LatLngBounds: new (...args: unknown[]) => { extend: (point: { lat: number; lng: number }) => void };
  Size: new (width: number, height: number) => unknown;
  Point: new (x: number, y: number) => unknown;
};

type MapTilerStyleLayer = { id: string; type?: string };
type MapTilerMap = {
  remove: () => void;
  on: (event: string, fn: (event?: unknown) => void) => void;
  getStyle: () => { layers?: MapTilerStyleLayer[] };
  getFilter: (layerId: string) => unknown;
  setFilter: (layerId: string, filter: unknown) => void;
  setLanguage: (language: string) => void;
  fitBounds: (bounds: [[number, number], [number, number]], options?: { padding?: number; maxZoom?: number }) => void;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
};

type MapTilerMarkerInstance = {
  setLngLat: (position: [number, number]) => MapTilerMarkerInstance;
  addTo: (map: MapTilerMap) => MapTilerMarkerInstance;
  remove: () => void;
};

type MapTilerGlobal = {
  config: { apiKey: string };
  MapStyle: { STREETS: unknown };
  Map: new (options: unknown) => MapTilerMap;
  Marker: new (options?: { element?: HTMLElement; anchor?: string }) => MapTilerMarkerInstance;
};

declare global {
  interface Window {
    L?: LeafletGlobal;
    google?: { maps: GoogleMapsGlobal };
    maptilersdk?: MapTilerGlobal;
  }
}

const VIETNAM_CENTER = { lat: 16.3, lng: 106.8 };
const VIETNAM_ZOOM = 6;
const VIETNAM_BOUNDS = { north: 23.55, south: 8.18, west: 102.1, east: 109.7 };
const VIETNAM_BOUNDS_POINTS: [number, number][] = [
  [VIETNAM_BOUNDS.south, VIETNAM_BOUNDS.west],
  [VIETNAM_BOUNDS.north, VIETNAM_BOUNDS.east],
];
const MAPTILER_VERSION = "4.1.0";
const HIDDEN_LABEL_TERMS = ["tam sa", "nam sa", "sansha", "nansha", "三沙", "南沙"];
const LABEL_NAME_FIELDS = ["name", "name:vi", "name:en", "name:latin", "name_int", "name:zh", "name:zh-Hans", "name:zh-Hant"];

let leafletPromise: Promise<LeafletGlobal> | null = null;
let googlePromise: Promise<GoogleMapsGlobal> | null = null;
let mapTilerPromise: Promise<MapTilerGlobal> | null = null;

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
      existing.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được."))), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.kosovotaLeaflet = "true";
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("Leaflet không khởi tạo được.")));
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

function loadMapTiler() {
  if (window.maptilersdk) return Promise.resolve(window.maptilersdk);
  if (mapTilerPromise) return mapTilerPromise;
  mapTilerPromise = new Promise<MapTilerGlobal>((resolve, reject) => {
    if (!document.querySelector('link[data-kosovota-maptiler="true"]')) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.css`;
      link.dataset.kosovotaMaptiler = "true";
      document.head.appendChild(link);
    }
    const existing = document.querySelector<HTMLScriptElement>('script[data-kosovota-maptiler="true"]');
    if (existing) {
      existing.addEventListener("load", () => (window.maptilersdk ? resolve(window.maptilersdk) : reject(new Error("MapTiler SDK không khởi tạo được."))), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = `https://cdn.maptiler.com/maptiler-sdk-js/v${MAPTILER_VERSION}/maptiler-sdk.umd.min.js`;
    script.async = true;
    script.dataset.kosovotaMaptiler = "true";
    script.onload = () => (window.maptilersdk ? resolve(window.maptilersdk) : reject(new Error("MapTiler SDK không khởi tạo được.")));
    script.onerror = () => reject(new Error("Không tải được MapTiler SDK."));
    document.head.appendChild(script);
  });
  return mapTilerPromise;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56"><filter id="s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".24"/></filter><path filter="url(#s)" d="M24 2C12.4 2 3 11.4 3 23c0 15 21 31 21 31s21-16 21-31C45 11.4 35.6 2 24 2Z" fill="${color}" stroke="white" stroke-width="${active ? 4 : 3}"/><circle cx="24" cy="23" r="11" fill="white"/><text x="24" y="28" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="800" fill="${color}">${glyph}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createMapTilerMarkerElement(marker: MapMarker, active: boolean) {
  const element = document.createElement("button");
  element.type = "button";
  element.className = "kosovota-map-marker-wrap";
  element.title = marker.subtitle ? `${marker.title} · ${marker.subtitle}` : marker.title;
  element.setAttribute("aria-label", element.title);
  element.innerHTML = `<div class="kosovota-map-marker ${active ? "is-active" : ""}" style="--marker-color:${safeMarkerColor(marker.color)}"><span>${markerGlyph(marker.glyph)}</span></div>`;
  return element;
}

function sensitiveLabelFilterForField(field: string) {
  const normalized = ["downcase", ["to-string", ["coalesce", ["get", field], ""]]];
  return ["all", ...HIDDEN_LABEL_TERMS.map((term) => ["==", ["index-of", term, normalized], -1])];
}

function hideSensitiveMapLabels(map: MapTilerMap) {
  for (const layer of map.getStyle().layers || []) {
    if (layer.type !== "symbol") continue;
    try {
      const existing = map.getFilter(layer.id);
      const privacyFilter = ["all", ...LABEL_NAME_FIELDS.map(sensitiveLabelFilterForField)];
      map.setFilter(layer.id, existing ? ["all", existing, privacyFilter] : privacyFilter);
    } catch {
      // Một vài style layer đặc biệt không hỗ trợ filter runtime.
    }
  }
}

export default function InteractiveMap({ markers, activeId, onSelect, className = "", height = 650, center = VIETNAM_CENTER, zoom = VIETNAM_ZOOM }: InteractiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<LeafletMap | null>(null);
  const leafletMarkersRef = useRef<LeafletMarker[]>([]);
  const googleMapRef = useRef<GoogleMapInstance | null>(null);
  const googleMarkersRef = useRef<GoogleMarkerInstance[]>([]);
  const mapTilerMapRef = useRef<MapTilerMap | null>(null);
  const mapTilerMarkersRef = useRef<MapTilerMarkerInstance[]>([]);
  const initialViewportAppliedRef = useRef(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const provider = (process.env.NEXT_PUBLIC_MAP_PROVIDER || "osm").toLowerCase();
  const googleKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
  const maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY || "";
  const maptilerStyle = process.env.NEXT_PUBLIC_MAPTILER_STYLE_URL || "";
  const normalizedMarkers = useMemo(() => markers.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)), [markers]);

  useEffect(() => {
    let cancelled = false;
    initialViewportAppliedRef.current = false;
    async function initialize() {
      if (!containerRef.current) return;
      setError("");
      setReady(false);
      try {
        if (maptilerKey) {
          const sdk = await loadMapTiler();
          if (cancelled || !containerRef.current) return;
          sdk.config.apiKey = maptilerKey;
          const map = new sdk.Map({
            container: containerRef.current,
            style: maptilerStyle || sdk.MapStyle.STREETS,
            center: [center.lng, center.lat],
            zoom,
            language: "vi",
            minZoom: 5,
            scrollZoom: true,
            maxBounds: [[VIETNAM_BOUNDS.west, VIETNAM_BOUNDS.south], [VIETNAM_BOUNDS.east, VIETNAM_BOUNDS.north]],
            attributionControl: true,
          });
          mapTilerMapRef.current = map;
          map.on("load", () => {
            if (cancelled) return;
            map.setLanguage("vi");
            hideSensitiveMapLabels(map);
            map.fitBounds([[VIETNAM_BOUNDS.west, VIETNAM_BOUNDS.south], [VIETNAM_BOUNDS.east, VIETNAM_BOUNDS.north]], { padding: 36, maxZoom: VIETNAM_ZOOM });
            initialViewportAppliedRef.current = true;
            setReady(true);
          });
          return;
        }

        if (provider === "google" && googleKey) {
          const maps = await loadGoogleMaps(googleKey);
          if (cancelled || !containerRef.current) return;
          const map = new maps.Map(containerRef.current, {
            center: { lat: center.lat, lng: center.lng },
            zoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
            restriction: { latLngBounds: VIETNAM_BOUNDS, strictBounds: false },
            minZoom: 5,
            styles: [
              { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
              { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
            ],
          });
          googleMapRef.current = map;
          map.fitBounds(new maps.LatLngBounds({ lat: VIETNAM_BOUNDS.south, lng: VIETNAM_BOUNDS.west }, { lat: VIETNAM_BOUNDS.north, lng: VIETNAM_BOUNDS.east }), 36);
          initialViewportAppliedRef.current = true;
          setReady(true);
          return;
        }

        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;
        const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true, preferCanvas: true, minZoom: 5, scrollWheelZoom: true, maxBounds: VIETNAM_BOUNDS_POINTS, maxBoundsViscosity: 0.95 });
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 20, attribution: '&copy; OpenStreetMap contributors' }).addTo(map);
        map.fitBounds(L.latLngBounds(VIETNAM_BOUNDS_POINTS), { padding: [36, 36], maxZoom: VIETNAM_ZOOM });
        leafletMapRef.current = map;
        initialViewportAppliedRef.current = true;
        window.setTimeout(() => map.invalidateSize(), 100);
        setReady(true);
      } catch (value) {
        if (!cancelled) setError(value instanceof Error ? value.message : "Không tải được bản đồ.");
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      mapTilerMarkersRef.current.forEach((marker) => marker.remove());
      mapTilerMarkersRef.current = [];
      mapTilerMapRef.current?.remove();
      mapTilerMapRef.current = null;
      leafletMarkersRef.current.forEach((marker) => marker.remove());
      leafletMarkersRef.current = [];
      leafletMapRef.current?.remove();
      leafletMapRef.current = null;
      googleMarkersRef.current.forEach((marker) => marker.setMap(null));
      googleMarkersRef.current = [];
      googleMapRef.current = null;
    };
  }, [provider, googleKey, maptilerKey, maptilerStyle, center.lat, center.lng, zoom]);

  useEffect(() => {
    if (!ready) return;
    const activeMarker = normalizedMarkers.find((marker) => marker.id === activeId) || null;

    if (mapTilerMapRef.current && window.maptilersdk) {
      const map = mapTilerMapRef.current;
      const sdk = window.maptilersdk;
      mapTilerMarkersRef.current.forEach((marker) => marker.remove());
      mapTilerMarkersRef.current = normalizedMarkers.map((marker) => {
        const element = createMapTilerMarkerElement(marker, marker.id === activeId);
        element.addEventListener("click", () => onSelect?.(marker.id));
        return new sdk.Marker({ element, anchor: "bottom" }).setLngLat([marker.lng, marker.lat]).addTo(map);
      });
      if (activeMarker) {
        map.setCenter([activeMarker.lng, activeMarker.lat]);
        map.setZoom(15);
      }
      return;
    }

    if (googleMapRef.current && window.google?.maps) {
      const maps = window.google.maps;
      googleMarkersRef.current.forEach((marker) => marker.setMap(null));
      googleMarkersRef.current = normalizedMarkers.map((marker) => {
        const active = marker.id === activeId;
        const instance = new maps.Marker({
          map: googleMapRef.current,
          position: { lat: marker.lat, lng: marker.lng },
          title: marker.title,
          icon: { url: markerSvg(marker, active), scaledSize: new maps.Size(active ? 56 : 44, active ? 65 : 52), anchor: new maps.Point(active ? 28 : 22, active ? 60 : 48) },
          optimized: true,
        });
        instance.addListener("click", () => onSelect?.(marker.id));
        return instance;
      });
      if (activeMarker) {
        googleMapRef.current.setCenter({ lat: activeMarker.lat, lng: activeMarker.lng });
        googleMapRef.current.setZoom(15);
      }
      return;
    }

    if (leafletMapRef.current && window.L) {
      const L = window.L;
      leafletMarkersRef.current.forEach((marker) => marker.remove());
      leafletMarkersRef.current = normalizedMarkers.map((marker) => {
        const color = safeMarkerColor(marker.color);
        const glyph = markerGlyph(marker.glyph);
        const active = marker.id === activeId;
        const html = `<div class="kosovota-map-marker ${active ? "is-active" : ""}" style="--marker-color:${color}"><span>${glyph}</span></div>`;
        return L.marker([marker.lat, marker.lng], { icon: L.divIcon({ className: "kosovota-map-marker-wrap", html, iconSize: [active ? 52 : 44, active ? 60 : 52], iconAnchor: [active ? 26 : 22, active ? 57 : 49] }), title: marker.title })
          .bindTooltip(`<strong>${escapeHtml(marker.title)}</strong>${marker.subtitle ? `<br/><span>${escapeHtml(marker.subtitle)}</span>` : ""}`, { direction: "top", offset: [0, -40] })
          .on("click", () => onSelect?.(marker.id))
          .addTo(leafletMapRef.current!);
      });
      if (activeMarker) leafletMapRef.current.setView([activeMarker.lat, activeMarker.lng], 15);
    }
  }, [normalizedMarkers, activeId, onSelect, ready]);

  const providerLabel = maptilerKey ? "MapTiler · Tiếng Việt" : provider === "google" && googleKey ? "Google Maps" : "OpenStreetMap";

  return (
    <div className={`map-frame ${className}`} style={{ height }}>
      <div ref={containerRef} className="h-full w-full" aria-label="Bản đồ KOSOVOTA" />
      {!ready && !error && <div className="map-overlay"><span className="animate-spin"><Icon name="refresh" size={22}/></span><span>Đang tải bản đồ...</span></div>}
      {error && <div className="map-overlay map-error"><Icon name="alert" size={24}/><strong>{error}</strong><span>Kiểm tra Internet hoặc khóa API trong Environment Variables.</span></div>}
      <div className="map-provider-badge"><Icon name="map" size={14}/><span>Việt Nam · {providerLabel}</span></div>
    </div>
  );
}
