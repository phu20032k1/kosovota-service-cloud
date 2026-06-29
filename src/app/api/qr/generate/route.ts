import QRCode from "qrcode";

export async function POST(req: Request) {
  const { machineId } = await req.json();

  const payload = {
    machineId,
    type: "KOSOVOTA_MACHINE",
  };

  const qr = await QRCode.toDataURL(JSON.stringify(payload));

  return Response.json({ qr });
}