import "dotenv/config";
import { storeUpload } from "../src/lib/storage";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nksAAAAASUVORK5CYII=",
  "base64",
);

async function main() {
  if ((process.env.STORAGE_PROVIDER || "").toLowerCase() !== "r2") {
    throw new Error('STORAGE_PROVIDER phải là "r2" trước khi test.');
  }
  const url = await storeUpload({
    buffer: ONE_PIXEL_PNG,
    contentType: "image/png",
    purpose: "system-check",
  });
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Đã upload nhưng URL công khai trả về HTTP ${response.status}: ${url}`);
  console.log("OK: Upload Cloudflare R2 thành công và URL công khai truy cập được.");
  console.log(url);
}

main().catch((error) => {
  console.error("LỖI: Kiểm tra R2 thất bại.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
