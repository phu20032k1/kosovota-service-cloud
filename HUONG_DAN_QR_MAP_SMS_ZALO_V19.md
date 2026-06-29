# KOSOVOTA V19 — CẦM TAY CHỈ VIỆC QR, MAP, SMS, ZALO

> AI và Deploy để giai đoạn cuối theo yêu cầu. Bản V19 tập trung hoàn thiện QR, bản đồ, SMS OTP và Zalo.

## 0. Chạy bản V19 lần đầu

Mở PowerShell trong thư mục dự án:

```powershell
npm install
npx prisma generate
npm run dev
```

Mở trình duyệt:

- Trang chủ: `http://localhost:3000`
- Quét QR: `http://localhost:3000/scan`
- Admin kiểm tra tích hợp: `http://localhost:3000/admin/integrations`

Nếu Prisma không tải được engine do mạng, thử lại bằng mạng khác hoặc tắt VPN/proxy rồi chạy `npx prisma generate`.

---

# PHẦN A — QR CODE (KHÔNG CẦN TẠO ACCOUNT, KHÔNG CẦN API)

## A1. QR trong bản này làm được gì?

- Sinh QR PNG/SVG cho từng máy đã có trong Neon.
- QR chứa đường dẫn `/qr/MÃ-MÁY`.
- Quét bằng camera điện thoại/laptop.
- Chọn ảnh QR từ thư viện nếu camera không dùng được.
- Nhập mã máy thủ công.
- Sau khi quét, mở đúng hồ sơ máy và luồng kích hoạt/bảo hành.

## A2. Test QR từ đầu

### Bước 1: Đảm bảo Neon có một máy

Đăng nhập Admin → **Dữ liệu**. Nhìn cột `ID/Seri`, ví dụ:

```text
KSV-HT250-00001
```

Nếu chưa có máy, import danh sách máy hoặc dùng dữ liệu seed.

### Bước 2: Mở trang QR của máy

```text
http://localhost:3000/qr/KSV-HT250-00001
```

Trang sẽ hiện tem QR. Bấm **Tải PNG** để tải tem.

### Bước 3: Test quét

Mở:

```text
http://localhost:3000/scan
```

- Bấm **Cho phép camera**.
- Đưa QR vào giữa khung.
- Hoặc chọn ảnh QR đã tải.
- Hệ thống phải chuyển sang `/qr/KSV-HT250-00001`.

### Bước 4: Test bằng điện thoại khi chạy local

Camera trình duyệt chỉ hoạt động trên `localhost` hoặc HTTPS. Điện thoại mở địa chỉ IP kiểu `http://192.168...` thường sẽ bị chặn camera. Vì vậy:

- Test camera trên chính máy tính bằng `localhost`, hoặc
- Đợi deploy HTTPS rồi test trên điện thoại, hoặc
- Dùng tunnel HTTPS trong thời gian thử nghiệm.

### Bước 5: Trước khi in tem thật

Mở `.env` và kiểm tra:

```env
NEXT_PUBLIC_APP_URL="https://ten-mien-that-cua-cau.vn"
```

Khởi động lại app rồi mới tải/in QR hàng loạt. Không in tem production khi URL vẫn là localhost.

---

# PHẦN B — MAP

## B1. Cách dễ nhất: OpenStreetMap, không cần account

Trong `.env`:

```env
NEXT_PUBLIC_MAP_PROVIDER="osm"
GEOCODING_ENABLED="false"
```

Chạy lại:

```powershell
npm run dev
```

Test các trang:

- `/customer-map`
- `/dealer-map`
- `/operations-map`

Cách này hiển thị marker có sẵn trong database nhưng không tự đổi địa chỉ chữ thành tọa độ.

## B2. Khuyên dùng để hoàn thiện: MapTiler

### Bước 1: Tạo tài khoản

Vào `https://cloud.maptiler.com/` → **Sign up** → xác minh email → đăng nhập.

### Bước 2: Lấy key test

Trong MapTiler Cloud → **Account / API keys** → sao chép default key để test.

### Bước 3: Điền `.env`

```env
NEXT_PUBLIC_MAP_PROVIDER="maptiler"
NEXT_PUBLIC_MAPTILER_KEY="KEY_MAPTILER_CUA_CAU"

GEOCODING_ENABLED="true"
GEOCODING_PROVIDER="maptiler"
MAPTILER_SERVER_API_KEY="KEY_MAPTILER_CUA_CAU"
```

Khởi động lại:

```powershell
npm run dev
```

### Bước 4: Test trong giao diện

1. Đăng nhập Admin.
2. Vào **Tích hợp**.
3. Nhập: `Hồ Hoàn Kiếm, Hà Nội`.
4. Bấm **Kiểm tra Map**.
5. Phải nhận được latitude/longitude và dòng báo provider `maptiler`.

Hoặc test lệnh:

```powershell
npm run test:map -- "Hồ Hoàn Kiếm, Hà Nội"
```

### Bước 5: Tạo key production an toàn

Trong trang API keys của MapTiler → **New key** → giới hạn origin theo domain production. Không dùng default key công khai lâu dài.

## B3. Tùy chọn Google Maps

Google yêu cầu Google Cloud project, API key và billing. Bật:

- Maps JavaScript API
- Geocoding API

Điền:

```env
NEXT_PUBLIC_MAP_PROVIDER="google"
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="KEY_DUNG_TREN_TRINH_DUYET"
GEOCODING_ENABLED="true"
GEOCODING_PROVIDER="google"
GOOGLE_MAPS_SERVER_API_KEY="KEY_DUNG_O_SERVER"
```

Nên tạo hai key riêng:

- Browser key: giới hạn HTTP referrer/domain.
- Server key: giới hạn API và IP/server nếu có thể.

---

# PHẦN C — SMS OTP QUA eSMS

## C1. Tạo account eSMS

1. Vào `https://esms.vn/`.
2. Chọn đăng ký tài khoản.
3. Xác minh số điện thoại/email.
4. Đăng nhập.
5. Vào menu **Quản lý API**.
6. Tạo hoặc sao chép `ApiKey` và `SecretKey`.

## C2. Đăng ký Brandname và template

Để gửi thật, chỉ có ApiKey/SecretKey là chưa đủ. Cần:

- Brandname chăm sóc khách hàng, ví dụ `KOSOVOTA`.
- Mẫu OTP được nhà mạng/eSMS duyệt.

Mẫu đề xuất để gửi đăng ký:

```text
KOSOVOTA: Ma OTP cua ban la {P}. Ma co hieu luc 5 phut. Khong cung cap ma nay cho nguoi khac.
```

Tên biến/mẫu cuối cùng phải theo hướng dẫn của eSMS. Có thể test sandbox trước khi Brandname hoàn tất.

## C3. Điền `.env` ở chế độ sandbox

```env
NOTIFICATION_DRY_RUN="false"
OTP_CHANNEL="SMS"
SMS_PROVIDER="esms"
ESMS_API_KEY="API_KEY_CUA_CAU"
ESMS_SECRET_KEY="SECRET_KEY_CUA_CAU"
ESMS_BRANDNAME="TEN_BRANDNAME_DA_DUYET"
ESMS_SANDBOX="true"
TEST_PHONE="SO_DIEN_THOAI_CUA_CAU"
```

Lưu file và khởi động lại app.

## C4. Test sandbox

### Cách 1: Giao diện

Admin → **Tích hợp** → nhập số của cậu → **Test SMS**.

- Nếu trả mã thành công: khóa API và request hợp lệ.
- Sandbox không gửi tin tới điện thoại.

### Cách 2: PowerShell

```powershell
npm run test:sms -- 09xxxxxxxx
```

## C5. Bật gửi thật

Sau khi Brandname/template đã duyệt và tài khoản có số dư:

```env
NOTIFICATION_DRY_RUN="false"
ESMS_SANDBOX="false"
OTP_DEBUG="false"
# Xóa hoặc comment OTP_FIXED_CODE nếu đang có
```

Khởi động lại app. Test:

1. Mở `/customer-portal`.
2. Nhập số khách hàng đã có trong Neon.
3. Bấm gửi OTP.
4. Admin vào **Thông báo** và bấm xử lý hàng đợi nếu chưa có cron.
5. Kiểm tra SMS trên điện thoại.

Lưu ý: OTP được đưa vào bảng Notification. Khi chưa deploy cron, phải chạy bộ xử lý:

```powershell
npm run notifications:process
```

Hoặc Admin vào trung tâm thông báo và bấm xử lý.

## C6. Một số lỗi thường gặp

- `Authorize Failed` / mã 101: sai ApiKey hoặc SecretKey.
- Mã 103: tài khoản không đủ số dư.
- Mã 104: Brandname sai/chưa được kích hoạt.
- Request thành công nhưng không nhận SMS: kiểm tra sandbox, mẫu tin đã duyệt và trạng thái tin trên eSMS.

---

# PHẦN D — ZALO OA / ZBS TEMPLATE MESSAGE

> Từ ngày 01/01/2026, Zalo Cloud Account được đổi tên thành Zalo Business Solutions Account (ZBS Account).

## D1. Cậu cần chuẩn bị

- Tài khoản Zalo cá nhân dùng số Việt Nam đã xác thực.
- Giấy đăng ký doanh nghiệp/hộ kinh doanh hoặc hồ sơ phù hợp để xác thực OA.
- Một Zalo Official Account doanh nghiệp.
- Một ZBS Account để thanh toán.
- Một Zalo App dành cho tích hợp API.
- Template message đã được duyệt.

## D2. Tạo Zalo Official Account

1. Vào `https://oa.zalo.me/`.
2. Đăng nhập bằng QR Zalo cá nhân.
3. Chọn **Tạo Official Account**.
4. Chọn loại **Doanh nghiệp**.
5. Điền tên, ngành nghề, ảnh đại diện, ảnh bìa.
6. Vào **Quản lý → Quản lý tài khoản → Xác thực OA**.
7. Nộp giấy tờ và chờ duyệt.

## D3. Tạo và liên kết ZBS Account

Trong trang quản lý OA:

1. **Quản lý → Quản lý tài khoản → Quản lý liên kết**.
2. Chọn tạo ZBS Account.
3. Điền thông tin doanh nghiệp.
4. Liên kết ZBS Account với OA.
5. Nạp tiền khi chuẩn bị gửi tin thật.

## D4. Tạo Zalo App và cấp quyền OA

1. Vào `https://developers.zalo.me/`.
2. Đăng nhập.
3. Tạo ứng dụng mới.
4. Điền thông tin ứng dụng và domain/callback theo yêu cầu.
5. Liên kết/cấp quyền ứng dụng cho OA.
6. Trong **Công cụ & Hỗ trợ → API Explorer**:
   - Chọn ứng dụng.
   - Chọn loại token `OA Access Token`.
   - Chọn OA KOSOVOTA.
   - Cấp quyền và lấy token để test.

Token lấy thủ công phù hợp cho thử nghiệm. Khi deploy production cần làm quy trình refresh token tự động; phần này để giai đoạn deploy cuối.

## D5. Tạo template OTP

Trong hệ thống Zalo/ZBS Template Message, tạo mẫu có các biến, ví dụ:

```text
KOSOVOTA: Mã OTP của bạn là <otp>. Mã có hiệu lực <expire_time>. Không cung cấp mã cho người khác.
```

Các tên biến nên dùng trong project:

- `otp`
- `code`
- `expire_time`
- `message`

Sau khi template được duyệt, sao chép Template ID.

## D6. Điền `.env`

```env
NOTIFICATION_DRY_RUN="false"
OTP_CHANNEL="ZALO"
ZALO_PROVIDER="zbs"
ZALO_ZBS_ACCESS_TOKEN="OA_ACCESS_TOKEN_CUA_CAU"
ZALO_ZBS_TEMPLATE_ID="TEMPLATE_ID_MAC_DINH"
ZALO_ZBS_OTP_TEMPLATE_ID="TEMPLATE_ID_OTP"
ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID=""
ZALO_ZBS_TEST_TEMPLATE_DATA='{"otp":"123456","code":"123456","expire_time":"5 phút","message":"KOSOVOTA kiểm tra kết nối"}'
TEST_PHONE="SO_DIEN_THOAI_ZALO_CUA_CAU"
```

`ZALO_ZBS_TEST_TEMPLATE_DATA` phải khớp chính xác với biến trong template đã được duyệt. Nếu template chỉ có `otp` và `expire_time`, hãy sửa JSON chỉ còn hai trường đó.

## D7. Test Zalo

### Giao diện

Admin → **Tích hợp** → nhập số có dùng Zalo → **Test Zalo**.

### PowerShell

```powershell
npm run test:zalo -- 09xxxxxxxx
```

Nếu lỗi:

- Access token invalid: lấy token OA mới hoặc kiểm tra OA đã cấp quyền cho App.
- Template invalid/no permission: Template ID không thuộc đúng OA/App hoặc chưa duyệt.
- Data invalid: tên trường trong `ZALO_ZBS_TEST_TEMPLATE_DATA` không khớp template.
- Số điện thoại không nhận: kiểm tra điều kiện gửi của template, số có Zalo và số dư ZBS.

---

# PHẦN E — CHECKLIST TEST HOÀN CHỈNH

## QR

- [ ] `/scan` mở camera trên localhost/HTTPS.
- [ ] Quét đúng QR chuyển tới `/qr/{machineId}`.
- [ ] Chọn ảnh QR cũng quét được.
- [ ] QR của mã không tồn tại báo lỗi.
- [ ] Tải PNG và mở được.

## Map

- [ ] `customer-map` hiển thị máy có lat/lng.
- [ ] `dealer-map` hiển thị đại lý có lat/lng.
- [ ] `operations-map` xếp điểm điều phối.
- [ ] Admin → Tích hợp → Test Map trả tọa độ.

## SMS

- [ ] eSMS sandbox trả thành công.
- [ ] Brandname/template đã duyệt.
- [ ] Tắt sandbox và nhận được SMS thật.
- [ ] OTP đăng nhập khách hàng dùng được.
- [ ] OTP đặt lại mật khẩu dùng được.

## Zalo

- [ ] OA doanh nghiệp đã xác thực.
- [ ] ZBS Account đã liên kết.
- [ ] Zalo App đã được OA cấp quyền.
- [ ] Template đã duyệt.
- [ ] Test Zalo thành công.
- [ ] OTP qua Zalo dùng được khi `OTP_CHANNEL=ZALO`.

---

# PHẦN F — THỨ TỰ CẬU NÊN LÀM

1. Test QR ngay, không cần account.
2. Giữ Map OSM để kiểm tra giao diện.
3. Tạo MapTiler và bật geocoding.
4. Tạo eSMS, chạy sandbox, đăng ký Brandname/template, gửi SMS thật.
5. Tạo và xác thực Zalo OA.
6. Tạo ZBS Account + Zalo App + template.
7. Test Zalo.
8. Sau khi bốn phần trên ổn mới làm AI.
9. Deploy và tự động refresh Zalo token/cron notification ở bước cuối.
