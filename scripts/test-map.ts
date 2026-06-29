import "dotenv/config";
import { geocodeAddress } from "../src/lib/maps/geocode";

async function main() {
  const address = process.argv.slice(2).join(" ").trim() || process.env.TEST_ADDRESS || "Hồ Hoàn Kiếm, Hà Nội";
  console.log(`Đang thử geocoding: ${address}`);
  const result = await geocodeAddress(address);
  if (!result) {
    console.error("Không tìm thấy địa chỉ.");
    process.exitCode = 1;
    return;
  }
  console.log("OK:", result);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
