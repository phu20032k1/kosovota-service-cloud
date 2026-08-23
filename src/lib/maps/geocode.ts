export type GeocodeResult = { lat: number; lng: number; formattedAddress?: string; provider: "google" | "maptiler" };

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

function addressTokens(value: string) {
  const ignored = new Set(["viet", "nam", "tp", "thanh", "pho", "quan", "huyen", "xa", "phuong", "thi", "tran"]);
  return normalizeAddress(value)
    .split(" ")
    .filter((token) => token && !ignored.has(token));
}

function candidateScore(query: string, candidate?: string) {
  if (!candidate) return 0;
  const normalizedQuery = normalizeAddress(query);
  const normalizedCandidate = normalizeAddress(candidate);
  if (!normalizedQuery || !normalizedCandidate) return 0;
  if (normalizedCandidate.includes(normalizedQuery)) return 2;

  const tokens = addressTokens(query);
  if (!tokens.length) return 0;
  const candidateTokens = new Set(addressTokens(candidate));
  const matched = tokens.filter((token) => candidateTokens.has(token)).length;
  return matched / tokens.length;
}

function bestCandidate<T>(query: string, items: T[], label: (item: T) => string | undefined) {
  if (!items.length) return null;
  const ranked = items
    .map((item) => ({ item, score: candidateScore(query, label(item)) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  const tokenCount = addressTokens(query).length;

  // Với địa chỉ có nhiều thành phần, ưu tiên không ghim còn hơn lấy một kết quả
  // chỉ khớp tên tỉnh/thành và khiến pin bị lệch sang khu vực khác.
  if (tokenCount >= 3 && best.score < 0.5) return null;
  return best.item;
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const value = address.trim();
  if (!value) return null;
  const provider = (process.env.GEOCODING_PROVIDER || process.env.NEXT_PUBLIC_MAP_PROVIDER || "maptiler").toLowerCase();
  if (provider === "google") {
    const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) throw new Error("Thiếu GOOGLE_MAPS_SERVER_API_KEY.");
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", value);
    url.searchParams.set("region", "vn");
    url.searchParams.set("language", "vi");
    url.searchParams.set("key", key);
    const response = await fetch(url, { cache: "no-store" });
    const result = await response.json() as {
      status?: string;
      error_message?: string;
      results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[];
    };
    if (!response.ok || (result.status !== "OK" && result.status !== "ZERO_RESULTS")) throw new Error(result.error_message || `Google Geocoding: ${result.status || response.status}`);
    const item = bestCandidate(value, result.results || [], (candidate) => candidate.formatted_address);
    if (!item?.geometry?.location) return null;
    return { ...item.geometry.location, formattedAddress: item.formatted_address, provider: "google" };
  }

  const key = process.env.MAPTILER_SERVER_API_KEY || process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("Thiếu MAPTILER_SERVER_API_KEY.");
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json`);
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "5");
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json() as { features?: { center?: [number, number]; place_name?: string }[]; message?: string };
  if (!response.ok) throw new Error(result.message || `MapTiler Geocoding HTTP ${response.status}`);
  const item = bestCandidate(value, result.features || [], (candidate) => candidate.place_name);
  if (!item?.center) return null;
  return { lng: item.center[0], lat: item.center[1], formattedAddress: item.place_name, provider: "maptiler" };
}
