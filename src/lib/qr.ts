export function extractMachineIdFromQr(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as { machineId?: unknown; id?: unknown };
    const candidate = typeof parsed.machineId === "string"
      ? parsed.machineId
      : typeof parsed.id === "string"
        ? parsed.id
        : "";
    if (candidate.trim()) return candidate.trim();
  } catch {
    // QR có thể là URL hoặc mã máy thuần, không nhất thiết là JSON.
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split("/").filter(Boolean);
    const qrIndex = parts.findIndex((part) => part.toLowerCase() === "qr");
    if (qrIndex >= 0 && parts[qrIndex + 1]) return decodeURIComponent(parts[qrIndex + 1]);
    const machineId = url.searchParams.get("machineId");
    if (machineId?.trim()) return machineId.trim();
  } catch {
    // Không phải URL.
  }

  if (/^[a-zA-Z0-9._:-]{3,120}$/.test(value)) return value;
  return null;
}

export function qrLandingUrl(machineId: string, origin?: string) {
  const base = (origin || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}/qr/${encodeURIComponent(machineId)}`;
}
