import {
  findProvince,
  isVietnamCoordinates,
  provinceFromAddress,
} from "@/lib/province";

export type GeocodeResult = {
  lat: number;
  lng: number;
  formattedAddress?: string;
  provinceCode?: string;
  provinceName?: string;
  provider: "google" | "maptiler";
};

type GoogleComponent = { long_name?: string; short_name?: string; types?: string[] };
type GoogleResult = {
  formatted_address?: string;
  address_components?: GoogleComponent[];
  geometry?: { location?: { lat: number; lng: number } };
};
type MapTilerFeature = {
  center?: [number, number];
  text?: string;
  text_vi?: string;
  place_name?: string;
  context?: Array<{ id?: string; text?: string; text_vi?: string; place_name?: string }>;
};

function normalizeAddress(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const IGNORED = new Set(["viet", "nam", "vn", "tp", "thanh", "pho", "quan", "huyen", "xa", "phuong", "thi", "tran"]);

function addressTokens(value: string) {
  return normalizeAddress(value).split(" ").filter((token) => token && !IGNORED.has(token));
}

function candidateScore(query: string, candidate?: string) {
  if (!candidate) return 0;
  const queryTokens = addressTokens(query);
  const candidateTokens = new Set(addressTokens(candidate));
  if (!queryTokens.length) return 0;
  const matched = queryTokens.filter((token) => candidateTokens.has(token)).length;
  return matched / queryTokens.length;
}

function hasHouseNumber(value: string) {
  return addressTokens(value).find((token) => /^\d+[a-z]?$/.test(token)) || null;
}

function isConfidentMatch(query: string, candidate: string | undefined, score: number) {
  if (!candidate) return false;
  const tokenCount = addressTokens(query).length;
  const houseNumber = hasHouseNumber(query);
  if (houseNumber && !addressTokens(candidate).includes(houseNumber) && score < 0.6) return false;
  if (tokenCount >= 6) return score >= 0.52;
  if (tokenCount >= 4) return score >= 0.48;
  if (tokenCount >= 3) return score >= 0.45;
  return score >= 0.5;
}

function bestCandidate<T>(
  query: string,
  items: T[],
  label: (item: T) => string | undefined,
  coordinates: (item: T) => { lat: number; lng: number } | null,
) {
  const ranked = items
    .map((item) => ({ item, score: candidateScore(query, label(item)), location: coordinates(item) }))
    .filter((entry) => entry.location && isVietnamCoordinates(entry.location.lat, entry.location.lng))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || !isConfidentMatch(query, label(best.item), best.score)) return null;
  const second = ranked[1];
  if (second && best.score < 0.65 && best.score - second.score < 0.05) return null;
  return best.item;
}

function provinceMetadata(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const row = findProvince(value) || provinceFromAddress(value);
    if (row) return { provinceCode: row[1], provinceName: row[2] };
  }
  return {};
}

function googleProvince(item: GoogleResult) {
  const administrative = item.address_components?.find((component) =>
    component.types?.includes("administrative_area_level_1"),
  );
  return provinceMetadata(administrative?.long_name, administrative?.short_name, item.formatted_address);
}

function mapTilerProvince(item: MapTilerFeature) {
  const context = item.context || [];
  const region = context.find((entry) => entry.id?.startsWith("region."));
  const values = [
    region?.text_vi,
    region?.text,
    region?.place_name,
    item.text_vi,
    item.text,
    item.place_name,
    ...context.flatMap((entry) => [entry.text_vi, entry.text, entry.place_name]),
  ];
  return provinceMetadata(...values);
}

function providerName() {
  return (process.env.GEOCODING_PROVIDER || process.env.NEXT_PUBLIC_MAP_PROVIDER || "maptiler").toLowerCase();
}

function googleKey() {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) throw new Error("Thiếu GOOGLE_MAPS_SERVER_API_KEY.");
  return key;
}

function mapTilerKey() {
  const key = process.env.MAPTILER_SERVER_API_KEY || process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("Thiếu MAPTILER_SERVER_API_KEY.");
  return key;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const value = address.trim();
  if (!value) return null;
  const provider = providerName();

  if (provider === "google") {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", value);
    url.searchParams.set("region", "vn");
    url.searchParams.set("components", "country:VN");
    url.searchParams.set("language", "vi");
    url.searchParams.set("key", googleKey());
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json() as { status?: string; error_message?: string; results?: GoogleResult[] };
    if (!response.ok || (result.status !== "OK" && result.status !== "ZERO_RESULTS")) {
      throw new Error(result.error_message || `Google Geocoding: ${result.status || response.status}`);
    }
    const item = bestCandidate(
      value,
      result.results || [],
      (candidate) => candidate.formatted_address,
      (candidate) => candidate.geometry?.location || null,
    );
    if (!item?.geometry?.location) return null;
    return {
      ...item.geometry.location,
      formattedAddress: item.formatted_address,
      ...googleProvince(item),
      provider: "google",
    };
  }

  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json`);
  url.searchParams.set("key", mapTilerKey());
  url.searchParams.set("limit", "10");
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  url.searchParams.set("autocomplete", "false");
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json() as { features?: MapTilerFeature[]; message?: string };
  if (!response.ok) throw new Error(result.message || `MapTiler Geocoding HTTP ${response.status}`);
  const item = bestCandidate(
    value,
    result.features || [],
    (candidate) => candidate.place_name,
    (candidate) => candidate.center ? { lng: candidate.center[0], lat: candidate.center[1] } : null,
  );
  if (!item?.center) return null;
  return {
    lng: item.center[0],
    lat: item.center[1],
    formattedAddress: item.place_name,
    ...mapTilerProvince(item),
    provider: "maptiler",
  };
}

export async function reverseGeocodeCoordinates(lat: number, lng: number): Promise<GeocodeResult | null> {
  if (!isVietnamCoordinates(lat, lng)) return null;
  const provider = providerName();

  if (provider === "google") {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("language", "vi");
    url.searchParams.set("key", googleKey());
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json() as { status?: string; error_message?: string; results?: GoogleResult[] };
    if (!response.ok || (result.status !== "OK" && result.status !== "ZERO_RESULTS")) {
      throw new Error(result.error_message || `Google Reverse Geocoding: ${result.status || response.status}`);
    }
    const item = (result.results || []).find((candidate) => {
      const metadata = googleProvince(candidate);
      return Boolean(metadata.provinceCode);
    });
    return item ? { lat, lng, formattedAddress: item.formatted_address, ...googleProvince(item), provider: "google" } : null;
  }

  const url = new URL(`https://api.maptiler.com/geocoding/${lng},${lat}.json`);
  url.searchParams.set("key", mapTilerKey());
  url.searchParams.set("limit", "10");
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json() as { features?: MapTilerFeature[]; message?: string };
  if (!response.ok) throw new Error(result.message || `MapTiler Reverse Geocoding HTTP ${response.status}`);
  const item = (result.features || []).find((candidate) => Boolean(mapTilerProvince(candidate).provinceCode));
  return item ? { lat, lng, formattedAddress: item.place_name, ...mapTilerProvince(item), provider: "maptiler" } : null;
}
