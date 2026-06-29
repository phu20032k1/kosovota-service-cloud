export type GeocodeResult = { lat: number; lng: number; formattedAddress?: string; provider: "google" | "maptiler" };

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
    const result = await response.json() as { status?: string; error_message?: string; results?: { formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }[] };
    if (!response.ok || (result.status !== "OK" && result.status !== "ZERO_RESULTS")) throw new Error(result.error_message || `Google Geocoding: ${result.status || response.status}`);
    const item = result.results?.[0];
    if (!item?.geometry?.location) return null;
    return { ...item.geometry.location, formattedAddress: item.formatted_address, provider: "google" };
  }
  const key = process.env.MAPTILER_SERVER_API_KEY || process.env.NEXT_PUBLIC_MAPTILER_KEY;
  if (!key) throw new Error("Thiếu MAPTILER_SERVER_API_KEY.");
  const url = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(value)}.json`);
  url.searchParams.set("key", key);
  url.searchParams.set("limit", "1");
  url.searchParams.set("country", "vn");
  url.searchParams.set("language", "vi");
  const response = await fetch(url, { cache: "no-store" });
  const result = await response.json() as { features?: { center?: [number, number]; place_name?: string }[]; message?: string };
  if (!response.ok) throw new Error(result.message || `MapTiler Geocoding HTTP ${response.status}`);
  const item = result.features?.[0];
  if (!item?.center) return null;
  return { lng: item.center[0], lat: item.center[1], formattedAddress: item.place_name, provider: "maptiler" };
}
