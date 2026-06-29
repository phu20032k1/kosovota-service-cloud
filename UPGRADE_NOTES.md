# KOSOVOTA Service Cloud v1.2 — Biên bản nâng cấp

Ngày hoàn thiện: 17/06/2026

## 1. Đăng nhập và bảo mật tài khoản

- Thay đăng nhập mô phỏng bằng API đăng nhập sử dụng database.
- Session được ký HMAC SHA-256 và lưu trong cookie `HttpOnly`, `SameSite=Lax`.
- Cookie production chỉ truyền qua HTTPS.
- Mật khẩu mới băm bằng `scrypt` với salt riêng.
- Tài khoản cũ lưu mật khẩu thường được tự nâng cấp sang `scrypt` sau lần đăng nhập đúng đầu tiên.
- Sau 5 lần nhập sai, tài khoản bị khóa 15 phút.
- Có `sessionVersion` để vô hiệu hóa toàn bộ phiên cũ khi đổi mật khẩu.
- Thêm đăng xuất server-side và API kiểm tra phiên.
- Chặn trang/API theo vai trò ở lớp Proxy; các API gắn dữ liệu cá nhân kiểm tra lại quyền ở route.

## 2. Quên mật khẩu bằng OTP

- Sinh OTP ngẫu nhiên 6 chữ số, chỉ lưu bản băm.
- OTP hết hạn sau 10 phút và tối đa 5 lần nhập sai.
- Phản hồi yêu cầu không tiết lộ số điện thoại có tồn tại trong hệ thống hay không.
- Sau khi đổi mật khẩu, reset khóa đăng nhập và vô hiệu hóa các phiên cũ.
- Production không trả OTP về trình duyệt; môi trường phát triển hiển thị OTP để kiểm thử khi chưa nối SMS.

## 3. Customer Portal

- Bỏ tra cứu bằng số điện thoại truyền từ phía trình duyệt.
- Hồ sơ và danh sách máy lấy trực tiếp từ tài khoản khách hàng đang đăng nhập.
- Xem thông tin máy, bảo hành, ảnh xác thực, lịch sử dịch vụ và lịch bảo trì.
- Gửi SOS chỉ cho máy thuộc hồ sơ của chính khách hàng.
- Không tạo trùng SOS đang mở cho cùng một máy.
- Cập nhật kênh nhận thông báo và khung giờ được phép gọi.
- Chia sẻ máy cho người thân bằng OTP; OTP có hết hạn và giới hạn lần thử.
- Tự tạo/liên kết tài khoản khi máy được kích hoạt cho khách hàng mới.

## 4. Agent Portal

- Bỏ `dealerCode` khỏi query string; đại lý được xác định từ session.
- Chỉ hiển thị lệnh thuộc đúng đại lý đang đăng nhập.
- Chỉ cho phép nhận/từ chối lệnh đang ở trạng thái `ASSIGNED`.
- Khi từ chối, lệnh trở về hàng chờ và xóa liên kết đại lý cũ để CSKH điều phối lại.
- Chỉ cho phép nộp báo cáo khi lệnh thuộc đại lý và đang `IN_PROGRESS`.
- Báo cáo bắt buộc ảnh lõi cũ, ảnh lõi mới và chữ ký khách hàng.
- Chữ ký hỗ trợ vẽ trực tiếp bằng ngón tay trên điện thoại.
- Thống kê lệnh mới, đang xử lý, hoàn thành và doanh thu dự kiến từ dữ liệu thật.
- Tự tạo/liên kết tài khoản khi Admin duyệt đại lý.

## 5. Phân quyền nghiệp vụ

- Admin: toàn quyền quản trị, báo cáo, duyệt đại lý.
- CSKH: CSOS, bản đồ, máy, lịch và điều phối dịch vụ.
- Đại lý: chỉ lệnh và báo cáo thuộc đại lý của mình.
- Khách hàng: chỉ máy, SOS, cài đặt và chia sẻ thuộc hồ sơ của mình.
- Các endpoint không khai báo công khai mặc định yêu cầu Admin/CSKH.
- API duyệt trạng thái đại lý yêu cầu riêng vai trò Admin.

## 6. Giao diện mobile

- Thiết kế lại trang đăng nhập với trạng thái tải/lỗi rõ ràng.
- Customer Portal và Agent Portal dùng thẻ responsive thay cho bảng quá rộng trên màn hình nhỏ.
- Nút thao tác lớn, input tối thiểu 16px để tránh trình duyệt điện thoại tự phóng to.
- Header cố định có thông tin vai trò và nút đăng xuất.
- Modal SOS, chia sẻ máy, từ chối lệnh và báo cáo tối ưu thao tác cảm ứng.

## 7. Dữ liệu và migration

- Mở rộng bảng `User` với trạng thái hoạt động, lần đăng nhập cuối, số lần sai, thời gian khóa, phiên bản session và liên kết Customer/Dealer.
- Thêm `MachineShareRequest` và `PasswordResetRequest`.
- Bổ sung phí dịch vụ và các mốc giao/nhận/hoàn thành cho `ServiceOrder`.
- Migration giữ lại tài khoản cũ, thêm chỉ mục và ràng buộc quan hệ.
- Seed tạo đủ bốn tài khoản demo, hồ sơ liên kết, máy, lịch và lệnh mẫu.

## 8. Kiểm tra đã thực hiện

- TypeScript: đạt với bộ type adapter offline.
- ESLint: đạt, không có lỗi.
- Kiểm thử băm/xác minh mật khẩu: đạt.
- Kiểm thử ký, đọc và chống sửa session token: đạt.
- Chạy toàn bộ migration trên database mới: integrity `ok`, không lỗi khóa ngoại.
- Nâng migration trên bản sao database v1.1: integrity `ok`, không lỗi khóa ngoại.
- Kiểm tra cấu trúc package và loại bỏ `node_modules`, `.next`, `.env` khỏi file bàn giao.

Môi trường đóng gói không truy cập được máy chủ tải Prisma Engine, vì vậy cần chạy `npm install` và `npm run db:generate` trên máy có Internet trước lần chạy đầu tiên.

## 9. Hạng mục cần dịch vụ ngoài

- Nhà cung cấp SMS/Zalo và webhook trạng thái gửi.
- Object storage riêng tư cho ảnh/video.
- PostgreSQL và backup production.
- Rate limiting tập trung/CAPTCHA cho form công khai.
- Phân quyền CSKH chi tiết theo tỉnh, xã và tập khách hàng được giao.
