# KOSOVOTA - logic vai trò, UI/UX và dịch vụ ngoài cần kết nối

## 1. Nguyên tắc phân quyền đã tách lại

### SUPER_ADMIN - khu ẩn
- Không hiển thị ở trang chủ.
- Không hiển thị ở màn `/login` thường.
- Đường vào riêng: `/super-admin/login`.
- Sau khi đăng nhập vào: `/super-admin`.
- Chỉ dùng để tạo/khóa tài khoản cấp dưới: `ADMIN`, `CSKH`, `DEALER`, `KTV`.
- Không tạo SUPER_ADMIN mới từ giao diện web để tránh chiếm quyền. SUPER_ADMIN gốc tạo bằng seed hoặc database khi bàn giao.

Tài khoản demo seed:
- SĐT: `0900000000`
- Mật khẩu: `<MẬT_KHẨU_SUPER_ADMIN_TỰ_ĐẶT>`

Có thể đổi bằng biến môi trường:
```env
SEED_SUPER_ADMIN_PHONE=09xxxxxxxx
SEED_SUPER_ADMIN_PASSWORD=MatKhauManhHon
```

### ADMIN
- Đăng nhập ở `/login`.
- Vào `/admin/reports`.
- Quản lý vận hành toàn quốc: báo cáo, import/export, duyệt đại lý, kho, thanh toán, tích hợp dịch vụ.
- Không được vào `/super-admin`.

### CSKH
- Đăng nhập ở `/login`.
- Vào `/csos`.
- Chỉ xem/chăm sóc theo `provinceScope`, ví dụ `01` hoặc `01,33`.
- Có quyền xem bản đồ khách hàng/đại lý trong phạm vi được giao, tạo lệnh, tìm đại lý gần nhất.
- Không quản lý tài khoản cấp dưới.

### DEALER - Đại lý
- Đăng nhập ở `/login`.
- Vào `/agent-portal`.
- Chỉ thấy lệnh, kho, thanh toán theo `dealerCode` của mình.
- Có thể quản lý đội KTV nội bộ ở phase sau.

### KTV
- Đăng nhập ở `/login`.
- Vào `/agent-portal`.
- Chỉ thấy lệnh thuộc `dealerCode` của mình.
- Được nhận lệnh, bắt đầu xử lý, gửi báo cáo ảnh/chữ ký.
- Không thấy kho vật tư, đối soát, doanh thu.

### CUSTOMER - Khách hàng
- Không dùng mật khẩu nội bộ.
- Vào `/customer-portal` bằng OTP SMS/Zalo.
- Xem máy, lịch bảo trì, lịch sử dịch vụ, gửi SOS.

---

## 2. Logic UI/UX theo luồng thật

### QR trên máy
Người quét QR vào `/qr/[machineId]`, sau đó chọn:
1. Kích hoạt máy.
2. Đăng ký đại lý/CTV.
3. Báo cáo dịch vụ.
4. Tra cứu máy của tôi.

### Kích hoạt máy
- Bước 1: thợ/KTV nhập nhanh tại nhà khách: GPS, tên khách, SĐT, ảnh mặt tiền, ảnh vị trí máy.
- Bước 2: bổ sung thông tin lắp đặt, đại lý, người lắp, ngân hàng nhận quà.

### CSOS
- CSKH xem lịch vạn niên.
- Hệ thống lọc việc quá hạn/hôm nay/tuần này.
- CSKH gọi khách, cập nhật trạng thái.
- Nếu khách đồng ý dịch vụ, CSKH bấm tìm đại lý gần nhất.
- Chọn đại lý, hệ thống tạo lệnh và gửi Zalo/SMS.

### Agent Portal
- Đại lý/KTV xem lệnh được giao.
- Đồng ý hoặc từ chối.
- Khi hoàn thành: chụp ảnh lõi cũ, lõi mới, toàn cảnh, nhập chữ ký khách.
- Đại lý thấy kho/đối soát; KTV không thấy.

### Admin Portal
- Admin xem toàn quốc.
- Duyệt đại lý.
- Import máy cũ từ Excel.
- Xuất CSV/Excel.
- Xem tích hợp dịch vụ ngoài.

---

## 3. Các file đã sửa/chèn

- `src/lib/auth.ts`: thêm logic SUPER_ADMIN kế thừa quyền ADMIN nhưng ADMIN không đi ngược vào SUPER_ADMIN.
- `src/proxy.ts`: bảo vệ route `/super-admin`, `/admin`, `/csos`, map, agent portal.
- `src/app/login/page.tsx`: thêm role KTV; không hiển thị SUPER_ADMIN.
- `src/app/api/auth/login/route.ts`: thêm redirect cho SUPER_ADMIN và KTV.
- `src/app/super-admin/login/page.tsx`: trang đăng nhập ẩn riêng cho SUPER_ADMIN.
- `src/app/super-admin/page.tsx`: màn tạo/khóa tài khoản cấp dưới.
- `src/app/api/super-admin/users/route.ts`: API quản lý tài khoản cấp dưới.
- `src/app/agent-portal/page.tsx`: KTV không thấy kho, thanh toán, doanh thu.
- `src/app/api/*`: bổ sung KTV ở các API lệnh/báo cáo/ticket, không cho KTV vào kho/thanh toán.
- `prisma/seed.ts`: thêm tài khoản SUPER_ADMIN và KTV demo.

---

## 4. Dịch vụ ngoài/API cần kết nối để chạy thật

### Bắt buộc cho bản đồ
1. `Map Tiles`
   - Phase 1: OpenStreetMap + Leaflet.
   - Phase 2: Mapbox hoặc Google Maps.
2. `Geocoding API`
   - Dùng để đổi địa chỉ Excel thành tọa độ GPS.
   - Gợi ý: Google Geocoding API hoặc Mapbox Geocoding.

### Bắt buộc cho OTP/thông báo
3. `SMS OTP`
   - Gợi ý Việt Nam: eSMS, FPT SMS, Viettel SMS.
   - Dùng cho khách hàng đăng nhập OTP và quên mật khẩu.
4. `Zalo OA / ZNS`
   - Gửi lệnh cho đại lý/KTV.
   - Gửi lịch thay lõi cho khách.

### Bắt buộc cho ảnh/video
5. `Object Storage`
   - Gợi ý: Cloudflare R2, AWS S3, MinIO.
   - Lưu ảnh mặt tiền, ảnh máy, ảnh lõi cũ/lõi mới, chữ ký, video đại lý.

### Bắt buộc cho chạy lịch tự động
6. `Queue/Cron`
   - Gợi ý: Redis + BullMQ, hoặc Vercel Cron, hoặc cron VPS.
   - Dùng để quét lịch đến hạn, gửi thông báo, retry tin nhắn lỗi.

### Nên có cho AI
7. `OpenAI API`
   - Chat CSKH, hỏi quy trình, RAG tài liệu kỹ thuật.
8. `Vector Database`
   - Gợi ý: pgvector nếu dùng PostgreSQL, hoặc Qdrant.
   - Dùng cho RAG tài liệu luật/quy trình/kỹ thuật.

### Nên có cho production
9. `PostgreSQL + PostGIS`
   - Bản hiện tại dùng PostgreSQL/Neon cho cả test và production.
   - PostGIS giúp tìm đại lý gần nhất tốt hơn.
10. `Email SMTP`
   - Gửi báo cáo, cảnh báo hệ thống.

---

## 5. Biến môi trường gợi ý

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/neondb?sslmode=require"
SESSION_SECRET="doi-chuoi-rat-dai-o-production"
OTP_SECRET="doi-chuoi-rat-dai-o-production"

# Super admin seed
SEED_SUPER_ADMIN_PHONE="0900000000"
SEED_SUPER_ADMIN_PASSWORD="<MẬT_KHẨU_SUPER_ADMIN_TỰ_ĐẶT>"

# Map / Geocoding
GEOCODING_PROVIDER="google"
GOOGLE_MAPS_API_KEY=""
MAPBOX_ACCESS_TOKEN=""

# SMS
SMS_PROVIDER="esms"
SMS_API_KEY=""
SMS_SECRET=""
SMS_BRANDNAME="KOSOVOTA"

# Zalo
ZALO_OA_ID=""
ZALO_APP_ID=""
ZALO_APP_SECRET=""
ZALO_ACCESS_TOKEN=""

# Storage
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID=""
R2_ACCESS_KEY_ID=""
R2_SECRET_ACCESS_KEY=""
R2_BUCKET="kosovota-uploads"
R2_PUBLIC_URL=""

# Cron/Queue
CRON_SECRET=""
REDIS_URL=""

# AI/RAG
OPENAI_API_KEY=""
VECTOR_DATABASE_URL=""
```

---

## 6. Cách chạy sau khi nhận file

```bash
npm install
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

Mở:
- Web thường: `http://localhost:3000`
- Đăng nhập thường: `http://localhost:3000/login`
- SUPER_ADMIN ẩn: `http://localhost:3000/super-admin/login`

Demo thường:
- ADMIN: `0900000001` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- CSKH: `0900000002` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- ĐẠI LÝ: `0900000003` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- KTV: `0900000004` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- SUPER_ADMIN: `0900000000` / `<MẬT_KHẨU_SUPER_ADMIN_TỰ_ĐẶT>`

---

## 7. Lưu ý bảo mật khi lên thật

- Không dùng mật khẩu demo.
- Đổi `SESSION_SECRET`, `OTP_SECRET`.
- Tắt `/api/dev/seed-demo` nếu deploy production.
- Bật HTTPS.
- Không để SUPER_ADMIN dùng hằng ngày; chỉ dùng khi tạo/khóa tài khoản.
- Admin vận hành không được biết đường/mật khẩu SUPER_ADMIN.
- Đại lý/KTV không được export dữ liệu khách hàng.
- CSKH phải luôn có `provinceScope` để không xem nhầm vùng.
