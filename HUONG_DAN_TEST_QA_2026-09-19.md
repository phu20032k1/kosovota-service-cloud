# Hướng dẫn kiểm thử bản sửa QA 19/09/2026

## 1. Chạy kiểm tra kỹ thuật trước

```bash
npm ci
npm run db:generate
npm run test:regression
npm run typecheck
npm run lint
npm run build
```

Chạy local:

```bash
cp .env.example .env
# Điền DATABASE_URL, SESSION_SECRET và các khóa cần dùng
npm run dev
```

Mở `http://localhost:3000`.

## 2. Test các lỗi quan trọng trước

### A. Lịch chăm sóc / bảo trì

1. Đăng nhập Admin, mở **Lịch thay lõi**.
2. Bấm **Sinh lịch máy bị thiếu** một lần.
3. Kết quả phải báo số máy và số lịch đã sinh; tải lại không được sinh trùng.
4. Máy có model chưa cấu hình vẫn phải có 6 mốc mặc định: quà kích hoạt, chăm sóc 1 tháng và bảo trì 3/6/12/24 tháng.
5. Đổi ngày ở ô **Điều chỉnh ngày đến hạn**, bấm **Lưu hạn mới**.
6. Ngày mới phải xuất hiện đúng trong nhóm đến hạn/sắp đến hạn. Cron nhắc lịch sẽ dùng chính ngày mới này.

### B. Khóa tài khoản đại lý

1. Admin mở **Quản lý tài khoản**, chọn một tài khoản đại lý test và bấm khóa.
2. Trạng thái phải chuyển sang **Đã khóa**, kể cả hồ sơ đại lý cũ đã mất/chưa duyệt.
3. Mở cửa sổ ẩn danh và đăng nhập tài khoản đó: hệ thống phải từ chối.
4. Nếu tài khoản đang đăng nhập ở trình duyệt khác, tải lại hoặc mở API có bảo vệ: phiên phải mất quyền ngay.
5. Mở khóa, đăng nhập lại và kiểm tra hoạt động bình thường.

### C. Kích hoạt máy và chống tạo trùng

1. Mở luồng quét QR/kích hoạt máy.
2. Bỏ trống thông tin người nhận quà hoặc ảnh bắt buộc rồi gửi: lỗi phải hiện ngay trên form.
3. Điền đủ, bấm gửi liên tục hai lần: nút phải chuyển sang **Đang lưu…** và chỉ tạo một bản kích hoạt/lịch bảo trì.
4. Kiểm tra máy vừa kích hoạt có tỉnh được suy ra từ địa chỉ và có lịch chăm sóc.

### D. Báo cáo dịch vụ của thợ

1. Với lệnh đang xử lý, mở **Gửi báo cáo**.
2. Không tải ảnh lõi cũ/mới hoặc bỏ xác nhận khách hàng rồi gửi: phải hiện lỗi, các trường bắt buộc có dấu `*`.
3. Điền đủ và bấm nhanh hai lần: nút phải bị khóa trong lúc gửi, chỉ có một báo cáo.
4. Gửi lại cùng lệnh: API phải trả thông báo lệnh đã có báo cáo hoàn thành.

## 3. Test bản đồ và tỉnh/thành

### A. Địa chỉ đơn lẻ

1. Admin mở **Tích hợp dịch vụ**.
2. Thử `1 Tràng Tiền, Hoàn Kiếm, Hà Nội`, sau đó thử địa chỉ ở Hải Phòng và Cần Thơ.
3. Kết quả phải trả tọa độ tại Việt Nam, địa chỉ chuẩn hóa và tỉnh tương ứng.

### B. Đồng bộ dữ liệu cũ

1. Admin mở **Dashboard điều hành** → **Phân bổ máy theo tỉnh**.
2. Bấm **Nhận diện tỉnh/GPS**.
3. Hệ thống lấy tỉnh từ địa chỉ; nếu chỉ có tọa độ thì reverse-geocode tọa độ.
4. Tải lại. Số lượng **Chưa xác định** phải giảm; các máy không đủ địa chỉ/GPS vẫn được giữ và báo lỗi để xử lý tay.

### C. Danh mục tỉnh

Mở form đăng ký đại lý và xác nhận có Hải Phòng, Cần Thơ, Đà Nẵng cùng đầy đủ danh mục 63 tỉnh/thành lịch sử để tương thích dữ liệu hiện có.

## 4. Test CTV độc lập và CTV liên kết

1. Tạo CTV, để trống **Liên kết đại lý**: tạo thành công và hiển thị **CTV độc lập**.
2. Đăng nhập CTV độc lập: được dùng cổng tác nghiệp và kích hoạt máy.
3. Tạo CTV khác, chọn một đại lý đã duyệt: tài khoản phải hiện đúng mã đại lý.
4. Sửa CTV từ liên kết sang độc lập và ngược lại, đăng nhập lại để xác nhận phạm vi dữ liệu.

## 5. Test OTP, SMS và Zalo

### Local an toàn (không gửi thật)

Trong `.env`:

```env
NOTIFICATION_DRY_RUN="true"
OTP_DEBUG="true"
OTP_FIXED_CODE="123456"
```

Khởi động lại app, yêu cầu OTP. API phải trả trạng thái DRY RUN và mã debug; nhập `123456` phải đăng nhập được.

### Gửi thật

1. Điền cấu hình eSMS/Zalo trong `.env` hoặc Vercel Environment Variables.
2. Đặt `NOTIFICATION_DRY_RUN="false"`, `OTP_DEBUG="false"`, xóa `OTP_FIXED_CODE`.
3. Với SMS đặt `OTP_CHANNEL="SMS"`; với Zalo đặt `OTP_CHANNEL="ZALO"`.
4. Chạy:

```bash
npm run check:production
npm run test:sms -- 09xxxxxxxx
npm run test:zalo -- 09xxxxxxxx
```

OTP hiện được gửi ngay khi bấm nút; nếu nhà cung cấp từ chối, người dùng nhận lỗi ngay thay vì phải chờ cron.

Nội dung Zalo là template đã duyệt trên Zalo Business Solution. Biến test lấy từ `ZALO_ZBS_TEST_TEMPLATE_DATA`; OTP dùng `ZALO_ZBS_OTP_TEMPLATE_ID`; giao lệnh dùng `ZALO_ZBS_SERVICE_ORDER_TEMPLATE_ID`.

## 6. Sau khi các mục trên đạt

- Test phân quyền Admin/CSKH/Đại lý/CTV/KTV trên cả desktop và điện thoại.
- Kiểm tra email, đối soát, kho vật tư và lịch sử thông báo.
- Kiểm tra các máy không có địa chỉ hoặc GPS và bổ sung tay; hệ thống không nên tự gán tỉnh khi thiếu bằng chứng.
