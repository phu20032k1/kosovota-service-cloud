export type Coordinates = { lat: number; lng: number };

export async function geocodeAddress(address: string): Promise<Coordinates | null> {
  if (process.env.GEOCODING_ENABLED !== "true" || !address.trim()) return null;

  const endpoint = process.env.GEOCODING_ENDPOINT || "https://nominatim.openstreetmap.org/search";
  const url = new URL(endpoint);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "vn");
  url.searchParams.set("q", address.trim());

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": process.env.GEOCODING_USER_AGENT || "KOSOVOTA-Service-Cloud/1.2",
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    const data = (await response.json()) as Array<{ lat?: string; lon?: string }>;
    const lat = Number(data[0]?.lat);
    const lng = Number(data[0]?.lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
