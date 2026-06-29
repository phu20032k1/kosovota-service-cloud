# Hướng dẫn kết nối Map, SMS và Zalo cho KOSOVOTA

Tài liệu này áp dụng cho bản nâng cấp có bản đồ tương tác, geocoding địa chỉ và hàng đợi thông báo. Hãy cấu hình trên môi trường thử nghiệm trước, sau đó mới bật gửi thật.

## 1. Chuẩn bị file môi trường

Trên Windows PowerShell, tại thư mục dự án:

```powershell
Copy-Item .env.example .env
notepad .env
```

Không đưa file `.env` lên Git hoặc gửi cho người khác. Sau mỗi lần đổi `.env`, hãy dừng và chạy lại `npm run dev` hoặc tiến trình production.

---

## 2. Chọn dịch vụ bản đồ

Dự án hỗ trợ ba chế độ:

- `osm`: chạy thử nhanh, không cần API key.
- `maptiler`: dùng Leaflet + lớp nền MapTiler, cấu hình đơn giản.
- `google`: dùng Google Maps JavaScript API.

### Cách A — MapTiler, phù hợp giai đoạn pilot

1. Tạo tài khoản MapTiler Cloud tại trang chính thức.
2. Mở mục API keys và tạo hai key:
   - Key trình duyệt: giới hạn theo domain, ví dụ `http://localhost:3000` và domain triển khai.
   - Key server: dùng cho geocoding; giới hạn theo IP máy chủ khi có thể.
3. Điền `.env`:

```env
NEXT_PUBLIC_MAP_PROVIDER="maptiler"
NEXT_PUBLIC_MAPTILER_KEY="KEY_TRINH_DUYET"
MAPTILER_SERVER_API_KEY="KEY_SERVER"
GEOCODING_PROVIDER="maptiler"
GEOCODING_ENABLED="true"
```

4. Khởi động lại dự án và mở:
   - `/customer-map`
   - `/dealer-map`
   - `/operations-map`
   - `/admin/integrations`

### Cách B — Google Maps

1. Tạo Google Cloud project.
2. Bật thanh toán cho project.
3. Bật tối thiểu:
   - Maps JavaScript API
   - Geocoding API
4. Tạo hai API key riêng:
   - Browser key: giới hạn theo HTTP referrer và chỉ cho Maps JavaScript API.
   - Server key: giới hạn theo IP máy chủ và chỉ cho Geocoding API.
5. Điền `.env`:

```env
NEXT_PUBLIC_MAP_PROVIDER="google"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="BROWSER_KEY"
GOOGLE_MAPS_SERVER_API_KEY="SERVER_KEY"
GEOCODING_PROVIDER="google"
GEOCODING_ENABLED="true"
```

6. Khởi động lại dự án. Không dùng server key trong biến có tiền tố `NEXT_PUBLIC_` vì biến này được gửi xuống trình duyệt.

### Geocoding khi import Excel

Khi `GEOCODING_ENABLED="true"`, các dòng Excel không có `Vĩ độ/Kinh độ` nhưng có `Địa chỉ` sẽ được thử chuyển thành tọa độ. Nên nhập địa chỉ đủ số nhà, đường, xã/phường, tỉnh để tăng độ chính xác. Sau khi import, kiểm tra lại marker trên bản đồ điều phối.

---

## 3. Kết nối SMS bằng eSMS

Phần code hiện tích hợp provider eSMS và gọi API gửi Brandname SMS.

### Đăng ký và lấy thông tin

1. Tạo tài khoản doanh nghiệp eSMS.
2. Trong trang quản trị, lấy `ApiKey` và `SecretKey`.
3. Đăng ký/tạo Brandname. Brandname phải được nhà cung cấp chấp thuận trước khi gửi thật.
4. Ban đầu để sandbox và dry-run bật:

```env
NOTIFICATION_DRY_RUN="true"
OTP_CHANNEL="SMS"
SMS_PROVIDER="esms"
ESMS_API_KEY="API_KEY"
ESMS_SECRET_KEY="SECRET_KEY"
ESMS_BRANDNAME="KOSOVOTA"
ESMS_SANDBOX="true"
ESMS_CALLBACK_URL=""
```

### Kiểm thử theo ba bước

1. **Dry run**: tạo OTP hoặc lệnh, rồi chạy:

```powershell
npm run notifications:process
```

Bản ghi phải chuyển sang `SENT` với mã bắt đầu bằng `dry_`, nhưng chưa gửi ra ngoài.

2. **Sandbox của eSMS**:

```env
NOTIFICATION_DRY_RUN="false"
ESMS_SANDBOX="true"
```

Tạo thông báo mới và xử lý hàng đợi. Kiểm tra phản hồi trong `/admin/notifications`.

3. **Gửi thật** sau khi Brandname và nội dung đã được duyệt:

```env
NOTIFICATION_DRY_RUN="false"
ESMS_SANDBOX="false"
```

Không dùng OTP cố định trên production. Đảm bảo `OTP_DEBUG="false"` và xóa `OTP_FIXED_CODE` nếu từng dùng khi test.

---

## 4. Kết nối Zalo Business Solutions Template Message

Trong năm 2026, luồng thông báo doanh nghiệp của Zalo được quản lý trong Zalo Business Solutions và gửi theo template đã được duyệt. Code dự án dùng endpoint Template Message và số điện thoại người nhận.

### Các bước chuẩn bị

1. Tạo và xác thực Zalo Official Account của KOSOVOTA.
2. Tạo ứng dụng trên Zalo Developers và liên kết/ủy quyền OA theo hướng dẫn trong tài khoản doanh nghiệp.
3. Mở Zalo Business Solutions, hoàn tất hồ sơ doanh nghiệp và phương thức thanh toán nếu được yêu cầu.
4. Tạo tối thiểu hai template:
   - OTP đăng nhập/xác nhận.
   - Giao lệnh dịch vụ cho đại lý.
5. Gửi template để duyệt.
6. Lấy access token và ID từng template.

### Tên biến template mà code đang gửi

Template OTP nên hỗ trợ các biến:

```text
otp
code
expire_time
message
```

Template giao lệnh nên hỗ trợ:

```text
order_code
customer_name
customer_phone
address
service_name
detail_url
```

Nếu template được duyệt dùng tên khác, sửa `templateData` trong:

- `src/lib/otp.ts`
- `src/app/api/service-orders/assign-dealer/route.ts`

### Điền `.env`

```env
NOTIFICATION_DRY_RUN="true"
OTP_CHANNEL="ZALO"
ZALO_PROVIDER="zbs"
ZALO_ZBS_ACCESS_TOKEN="ACCESS_TOKEN"
ZALO_ZBS_TEMPLATE_ID="TEMPLATE_MAC_DINH"
ZALO_ZBS_OTP_TEMPLATE_ID="TEMPLATE_OTP"
ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID="TEMPLATE_GIAO_LENH"
```

Sau khi chạy dry-run thành công, đặt:

```env
NOTIFICATION_DRY_RUN="false"
```

Access token không nên ghi trực tiếp trong source code. Khi Zalo cấp token mới hoặc token hết hiệu lực, chỉ cập nhật secret trên máy chủ và khởi động lại tiến trình.

---

## 5. Chạy hàng đợi thông báo tự động

### Chạy thủ công

```powershell
npm run notifications:process
```

Mặc định tiến trình lấy một nhóm thông báo đang `PENDING` hoặc đủ điều kiện thử lại, gửi qua provider và cập nhật `SENT`/`FAILED`.

### Gọi qua HTTP cron

Đặt secret mạnh:

```env
CRON_SECRET="CHUOI_NGAU_NHIEN_DAI"
```

Ví dụ PowerShell:

```powershell
$headers = @{ Authorization = "Bearer CHUOI_NGAU_NHIEN_DAI" }
Invoke-RestMethod -Method Post -Uri "https://ten-mien-cua-ban/api/notifications/process" -Headers $headers -ContentType "application/json" -Body '{"limit":50}'
```

Có thể cấu hình Windows Task Scheduler, cron của VPS hoặc scheduler của nền tảng hosting gọi lệnh này mỗi 1–5 phút. Không công khai `CRON_SECRET` ở frontend.

---

## 6. Kiểm tra trạng thái ngay trong hệ thống

Đăng nhập Admin và mở:

- `/admin/integrations`: kiểm tra dịch vụ nào đã đủ cấu hình.
- `/admin/notifications`: xem hàng đợi, lỗi nhà cung cấp, số lần thử và gửi lại.
- `/operations-map`: kiểm tra hai lớp máy/đại lý và giao lệnh.

Trình tự an toàn:

1. Chạy `osm` + `NOTIFICATION_DRY_RUN=true`.
2. Kết nối MapTiler hoặc Google Maps.
3. Bật geocoding và thử một file Excel nhỏ.
4. Kết nối eSMS sandbox.
5. Kết nối Zalo bằng template đã duyệt.
6. Chỉ tắt dry-run khi đã kiểm tra số nhận, nội dung, template và chi phí.

---

## 7. Xử lý lỗi thường gặp

### Bản đồ trắng

- Kiểm tra key có đúng domain hiện tại không.
- Kiểm tra API tương ứng đã bật.
- Mở Console của trình duyệt để xem lỗi referrer/API/billing.
- Sau khi sửa `.env`, khởi động lại Next.js.

### Import không ra tọa độ

- Kiểm tra `GEOCODING_ENABLED=true`.
- Kiểm tra server key đúng provider.
- Địa chỉ cần đủ tỉnh/thành phố.
- Xem báo cáo dòng lỗi sau import.

### SMS không gửi

- Kiểm tra `NOTIFICATION_DRY_RUN=false`.
- Kiểm tra `ESMS_SANDBOX` và trạng thái Brandname.
- Kiểm tra số điện thoại, số dư và lỗi trong `/admin/notifications`.

### Zalo báo lỗi template

- Kiểm tra template đã được duyệt và còn hoạt động.
- Kiểm tra `template_id`, access token và tên biến truyền vào.
- Số điện thoại cần đúng định dạng Việt Nam và thuộc trường hợp được phép gửi theo chính sách của Zalo.
