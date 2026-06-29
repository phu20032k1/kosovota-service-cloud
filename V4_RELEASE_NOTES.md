# KOSOVOTA Service Cloud V4 — Ghi chú bàn giao

## Đã sửa

- Chặn tuyệt đối giao diện và URL theo vai trò bằng proxy trung tâm.
- Đăng nhập sai vai trò không còn mở nhầm portal.
- Thêm nhận diện phiên hiện tại và đăng xuất để đổi tài khoản.
- Thêm đăng xuất cho Admin, CSKH, Đại lý, KTV, Khách hàng và SUPER_ADMIN.
- Không còn nút sai quyền dẫn CSKH sang trang Admin.
- Nút thao tác không còn submit form ngoài ý muốn; báo cáo mới không reload cả trang.
- Thêm trang không có quyền thay cho việc đẩy người dùng về trang chủ.
- Dọn ảnh/dữ liệu kiểm thử khỏi runtime production.
- Sửa chuỗi Prisma migration cũ bị lỗi drop index hai lần.

## Phân quyền mới

- SUPER_ADMIN ở `/super-admin/login`, không xuất hiện ở đăng nhập thường.
- SUPER_ADMIN tạo ADMIN/CSKH, khóa tài khoản, reset mật khẩu.
- ADMIN duyệt hồ sơ và sinh tài khoản DEALER.
- DEALER tạo/khóa/reset KTV của chính mình.
- KTV có portal riêng và chỉ thấy lệnh có `technicianId` đúng tài khoản.
- Khách hàng dùng cookie/OTP riêng, không dùng tài khoản nội bộ.

## Nâng cấp nghiệp vụ

- Trang duyệt/đình chỉ đại lý riêng.
- Trang quản lý đội KTV của Đại lý.
- Giao KTV cụ thể cho từng lệnh.
- KTV nhận lệnh, bắt đầu và báo cáo tại portal riêng.
- Kiểm tra báo cáo chống gửi sai máy/sai đại lý/sai KTV/lặp báo cáo.
- Trang kích hoạt bước 2 có màn thành công, không chuyển nhầm sang cổng khách hàng.
- QR chỉ được kiểm tra trạng thái kích hoạt của chính máy đang mở.
- QR vào cổng khách hàng sẽ ưu tiên đúng máy sau khi xác thực OTP.
- Seed production không tạo dữ liệu nghiệp vụ giả; seed test tách thành lệnh riêng.

## Tệp quan trọng

- `HUONG_DAN_V4_PHAN_QUYEN_TEST_API.md`
- `src/lib/access-control.ts`
- `src/proxy.ts`
- `src/app/technician-portal/page.tsx`
- `src/app/agent-portal/team/page.tsx`
- `src/app/admin/dealers/page.tsx`
- `prisma/migrations/20260620123000_role_isolation_and_technician_assignment/migration.sql`
