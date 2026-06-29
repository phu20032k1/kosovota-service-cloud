# KOSOVOTA V19 — QR, MAP, SMS, ZALO

## Đã thêm

- Trang `/scan` quét QR bằng camera, quét từ ảnh và nhập mã thủ công.
- Bộ đọc QR chấp nhận URL `/qr/{machineId}`, JSON có `machineId` hoặc mã máy thuần.
- API `/api/qr/{machineId}` sinh QR SVG/PNG từ máy có thật trong Neon.
- Trang QR của máy có nút tải PNG, in, sao chép liên kết và mở máy quét.
- Liên kết Quét QR trên trang chủ và menu Admin/CSKH.
- API Admin kiểm thử Map, SMS, Zalo trực tiếp.
- Form test trong `Admin → Tích hợp`.
- Script:
  - `npm run test:map -- "địa chỉ"`
  - `npm run test:sms -- 09xxxxxxxx`
  - `npm run test:zalo -- 09xxxxxxxx`
- Biến cấu hình test Zalo template và số điện thoại test.
- Hướng dẫn tạo account, lấy API, điền `.env` và test từng dịch vụ trong `HUONG_DAN_QR_MAP_SMS_ZALO_V19.md`.

## Đã kiểm tra

- ESLint: đạt, không lỗi/cảnh báo.
- Next.js/Turbopack: biên dịch source thành công.
- QR parser: đạt.
- QR SVG generation: đạt.
- SMS dry-run: đạt.
- Zalo dry-run: đạt.

## Giới hạn môi trường kiểm tra

`prisma generate` không hoàn tất trong môi trường đóng gói vì không phân giải được `binaries.prisma.sh`. Vì Prisma Client không được sinh, bước typecheck cuối dừng ở import `PrismaClient`. Trên máy người dùng có Internet bình thường, chạy:

```powershell
npm install
npx prisma generate
npm run build
```

AI và deploy chưa làm trong V19 theo yêu cầu để cuối.
