# KOSOVOTA Service Cloud V4 — Phân quyền, kiểm thử và kết nối dịch vụ ngoài

## 1. Nguyên tắc phân quyền

Mỗi người dùng chỉ có **một vai trò nội bộ**. Giao diện, URL và API đều kiểm tra cùng vai trò; không chỉ ẩn nút ở frontend.

| Vai trò | Nơi đăng nhập | Trang chính | Chức năng chính | Không được truy cập |
|---|---|---|---|---|
| SUPER_ADMIN | `/super-admin/login` | `/super-admin` | Tạo Admin/CSKH, khóa mọi tài khoản cấp dưới, đặt lại mật khẩu | Toàn bộ `/admin`, `/csos`, `/agent-portal`, `/technician-portal` |
| ADMIN | `/login` | `/admin/executive` | Duyệt đại lý, CRM, kho, đối soát, báo cáo, import, bản đồ, cấu hình tích hợp, nhật ký | Khu SUPER_ADMIN, cổng Đại lý/KTV |
| CSKH | `/login` | `/csos` | Lịch chăm sóc, khách hàng/ticket theo tỉnh, bản đồ và điều phối | Kho, đối soát, cấu hình Admin, cổng Đại lý/KTV |
| DEALER | `/login` | `/agent-portal` | Nhận/từ chối lệnh, giao KTV, quản lý đội KTV, kho đại lý, đối soát | Dữ liệu đại lý khác, Admin/CSKH, khu SUPER_ADMIN |
| KTV | `/login` | `/technician-portal` | Chỉ xem lệnh được giao trực tiếp, nhận lệnh, bắt đầu, chụp ảnh và báo cáo | Doanh thu, đối soát, kho, quản lý KTV, lệnh KTV khác |
| KHÁCH HÀNG | OTP tại `/customer-portal` | `/customer-portal` | Xem máy của mình/được chia sẻ, lịch sử, lịch bảo trì, SOS, cài đặt thông báo | Mọi khu nội bộ |

### Ai tạo tài khoản?

1. SUPER_ADMIN được tạo bằng biến môi trường và seed, không có form đăng ký.
2. SUPER_ADMIN tạo ADMIN và CSKH.
3. Người ngoài đăng ký hồ sơ Đại lý/CTV tại `/dealer-register`; ADMIN duyệt tại `/admin/dealers`; hệ thống tự sinh tài khoản DEALER.
4. DEALER tạo KTV của chính đại lý tại `/agent-portal/team`.
5. Khách hàng không có mật khẩu nội bộ; số điện thoại gắn với máy và đăng nhập bằng OTP.

## 2. Luồng đăng nhập đã sửa

- Cookie phiên nội bộ dùng chung một nguồn: `kosovota_session`.
- Đăng nhập sai vai trò bị từ chối, không đổi sang giao diện khác.
- Mở URL sai vai trò bị chuyển đến `/khong-co-quyen`, không về trang chủ.
- Trang đăng nhập hiển thị phiên hiện tại và có nút đăng xuất trước khi đổi tài khoản.
- Mọi portal đều có nút đăng xuất.
- SUPER_ADMIN không xuất hiện trong trang đăng nhập thường, menu hoặc trang chủ.
- Quên mật khẩu công khai không xử lý tài khoản SUPER_ADMIN; reset SUPER_ADMIN bằng seed/biến môi trường trên máy chủ.

## 3. QR và kích hoạt

QR của từng máy mở tại:

```text
/qr/{MACHINE_ID}
```

Trang QR công khai chỉ hiển thị lựa chọn. Các thao tác nghiệp vụ được bảo vệ:

- Kích hoạt bước 1: `/activate/{MACHINE_ID}/step-1` — DEALER hoặc KTV.
- Kích hoạt bước 2: `/activate/{MACHINE_ID}/step-2` — DEALER hoặc KTV.
- Báo cáo dịch vụ: `/service-report/{MACHINE_ID}` — DEALER hoặc KTV.
- Tra cứu máy: `/customer-portal?machineId={MACHINE_ID}` — xác thực OTP của chủ máy/người được chia sẻ.

API kích hoạt công khai chỉ cho kiểm tra **một máy và một bước cụ thể**, không được tải danh sách kích hoạt toàn hệ thống.

## 4. Lệnh dịch vụ và KTV

- Lệnh luôn thuộc một Đại lý qua `dealerId`.
- Đại lý chọn KTV qua `technicianId`.
- KTV chỉ nhận dữ liệu khi `technicianId` đúng bằng ID tài khoản đang đăng nhập.
- Báo cáo có `orderId` bị kiểm tra đồng thời: đúng máy, đúng đại lý, đúng KTV, đúng trạng thái và chưa có báo cáo.
- Lệnh hoàn thành không thể gửi báo cáo lần hai.
- Đại lý bị đình chỉ sẽ khóa tài khoản DEALER và các KTV trực thuộc.

Migration mới:

```text
prisma/migrations/20260620123000_role_isolation_and_technician_assignment
```

## 5. Dữ liệu thật và dữ liệu kiểm thử

### Khởi tạo dữ liệu thật

`npm run db:seed` chỉ tạo hai tài khoản gốc từ `.env`:

```env
SEED_SUPER_ADMIN_PHONE="..."
SEED_SUPER_ADMIN_PASSWORD="..."
SEED_ADMIN_PHONE="..."
SEED_ADMIN_PASSWORD="..."
```

Lệnh này **không tạo máy, khách hàng, đại lý, ảnh hoặc dòng dữ liệu mẫu**.

### Dữ liệu kiểm thử riêng

Chỉ chạy trên database local/test:

```bash
npm run db:seed:test
```

Lệnh này xóa dữ liệu hiện có rồi tạo bộ dữ liệu kiểm thử. Tuyệt đối không chạy trên production.

### Import máy

Mẫu Excel:

```text
public/templates/import-may-cu-kosovota.xlsx
```

Màn import:

```text
/admin/reports
```

Các cột chính: ID máy, Model, Seri, Mã tỉnh, Trạng thái, Ngày lắp, Tên khách hàng, SĐT, Địa chỉ, Vĩ độ, Kinh độ.

## 6. Chạy local sạch

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Trên macOS/Linux dùng `cp` thay cho `copy`.

Sau khi sửa schema trong môi trường phát triển có thể dùng:

```bash
npx prisma migrate dev
```

Production chỉ dùng:

```bash
npm run db:migrate
```

## 7. Trình tự kiểm thử đầy đủ

1. Đăng nhập SUPER_ADMIN ở URL ẩn, tạo một ADMIN và một CSKH có `provinceScope`.
2. Đăng xuất; xác nhận SUPER_ADMIN không vào được `/admin/executive`.
3. Mở `/dealer-register`, gửi hồ sơ đại lý.
4. Đăng nhập ADMIN, vào `/admin/dealers`, duyệt hồ sơ.
5. Đăng nhập tài khoản DEALER vừa sinh, vào `/agent-portal/team`, tạo KTV.
6. ADMIN import máy hoặc tạo dữ liệu máy kiểm thử.
7. DEALER/KTV mở QR máy, hoàn thành bước 1 và bước 2.
8. CSKH mở `/csos` hoặc `/operations-map`, tạo/giao lệnh cho Đại lý.
9. DEALER giao lệnh cho KTV cụ thể.
10. Đăng nhập KTV; xác nhận chỉ thấy lệnh của mình; nhận lệnh, bắt đầu và gửi báo cáo.
11. Đăng nhập KTV khác; xác nhận không thấy/không sửa được lệnh trên.
12. Khách hàng vào `/customer-portal`, nhận OTP, xem máy, tạo SOS và kiểm tra lịch bảo trì.
13. ADMIN kiểm tra kho, đối soát, báo cáo, thông báo và nhật ký.
14. Thử nhập trực tiếp URL của vai trò khác; hệ thống phải hiện trang không có quyền, không về `/`.

## 8. Dịch vụ ngoài cần nối

### 8.1 Bản đồ nền

Hiện local có thể dùng OpenStreetMap. Production nên chọn MapTiler hoặc Google Maps và cấu hình:

```env
NEXT_PUBLIC_MAP_PROVIDER="maptiler" # hoặc google
NEXT_PUBLIC_MAPTILER_KEY="..."
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="..."
```

Khóa trình duyệt phải giới hạn theo domain.

### 8.2 Geocoding — đổi địa chỉ thành GPS

Điểm nối đã có tại:

```text
src/lib/maps/geocode.ts
src/app/api/maps/geocode/route.ts
src/app/api/admin/import-machines/route.ts
```

Cấu hình Google:

```env
GEOCODING_ENABLED="true"
GEOCODING_PROVIDER="google"
GOOGLE_MAPS_SERVER_API_KEY="..."
```

Hoặc MapTiler:

```env
GEOCODING_ENABLED="true"
GEOCODING_PROVIDER="maptiler"
MAPTILER_SERVER_API_KEY="..."
```

Khóa server không đưa vào biến `NEXT_PUBLIC_*`.

### 8.3 OTP và SMS

Code provider nằm tại:

```text
src/lib/notifications/providers.ts
src/lib/otp.ts
```

Cấu hình eSMS:

```env
NOTIFICATION_DRY_RUN="false"
SMS_PROVIDER="esms"
ESMS_API_KEY="..."
ESMS_SECRET_KEY="..."
ESMS_BRANDNAME="..."
ESMS_SANDBOX="false"
ESMS_CALLBACK_URL="https://domain/api/webhooks/esms"
```

Trước khi gửi thật, giữ `NOTIFICATION_DRY_RUN=true` và thử toàn bộ luồng.

### 8.4 Zalo ZNS/ZBS Template Message

Dùng để gửi OTP, lệnh dịch vụ và nhắc lịch:

```env
ZALO_ZBS_ACCESS_TOKEN="..."
ZALO_ZBS_OTP_TEMPLATE_ID="..."
ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID="..."
```

Cần tạo Official Account, ứng dụng Zalo, template được duyệt, cơ chế làm mới access token và webhook trạng thái gửi.

### 8.5 Lưu ảnh/video

Local hiện ghi vào:

```text
public/uploads
src/app/api/upload/route.ts
```

Cách này không phù hợp khi deploy nhiều máy chủ hoặc nền tảng serverless. Production nên thay bằng Cloudflare R2/Amazon S3. Biến nên thêm:

```env
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="kosovota-service-cloud"
R2_PUBLIC_BASE_URL="https://media.domain.vn"
```

Nên dùng URL ký tạm thời khi upload, kiểm tra MIME/kích thước, đổi tên ngẫu nhiên và không công khai ảnh CCCD/chữ ký.

### 8.6 Chạy hàng đợi thông báo

Endpoint:

```text
POST /api/notifications/process
```

Bảo vệ bằng:

```env
CRON_SECRET="..."
```

Có thể gọi mỗi phút bằng cron của máy chủ. Khi quy mô lớn, chuyển sang Redis + BullMQ để retry, chống gửi trùng và theo dõi lỗi.

### 8.7 Email

Code hiện hỗ trợ webhook chung:

```env
EMAIL_WEBHOOK_URL="..."
EMAIL_WEBHOOK_TOKEN="..."
```

Webhook có thể trỏ đến service riêng dùng Resend, SendGrid hoặc nhà cung cấp email doanh nghiệp.

## 9. Việc bắt buộc trước production

- Chuyển database từ SQLite sang PostgreSQL; dùng PostGIS khi cần truy vấn bán kính lớn.
- Mã hóa dữ liệu nhạy cảm: CCCD, tài khoản ngân hàng, chữ ký.
- R2/S3 cho ảnh; không lưu ảnh production trong `public/uploads`.
- Bật HTTPS, cookie secure, rate limit đăng nhập/OTP/upload.
- CAPTCHA cho đăng ký đại lý và form công khai.
- Backup database và object storage.
- Sentry/monitoring, log tập trung và cảnh báo lỗi cron.
- Cấu hình domain, CORS, CSP và hạn chế API key theo domain/IP.
- Thay toàn bộ secret mặc định; không commit `.env`.

## 10. Kiểm tra đã thực hiện trong bản bàn giao

- ESLint: không còn lỗi/cảnh báo.
- Chuỗi migration SQLite: chạy tuần tự thành công; có `technicianId` và index.
- Next.js production build: toàn bộ route được biên dịch và prerender thành công trong kiểm tra cấu trúc.
- Thư mục `public/uploads` đã được dọn sạch, chỉ giữ `.gitkeep`.
