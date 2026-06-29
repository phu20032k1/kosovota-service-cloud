# Bản sửa đăng nhập + giao diện chính

## Đã sửa
- Sửa lỗi API `/api/auth/session` đang import `authenticatedUser` không tồn tại, gây lỗi khi kiểm tra đăng nhập/session.
- Nâng cấp API `/api/auth/login`: nhận thêm `role`, kiểm tra role hợp lệ và chặn đăng nhập sai vị trí.
- Làm lại trang `/login`: hỏi người dùng là Khách hàng, Admin, CSKH hay Đại lý trước; Khách hàng đi qua cổng OTP, các vị trí nội bộ nhập số điện thoại + mật khẩu.
- Điều hướng sau đăng nhập theo vai trò: Admin `/admin/reports`, CSKH `/csos`, Đại lý `/agent-portal`, Khách hàng `/customer-portal`.
- Sắp xếp trang chủ ưu tiên phần chính: đăng nhập theo vị trí, cổng khách hàng, đăng ký đại lý, tư vấn nhanh; phần giới thiệu/sản phẩm lùi xuống dưới.
- Sửa `LeafletMap` để không phụ thuộc package `leaflet` lúc build; bản đồ tải Leaflet bằng CDN ở client, tránh lỗi thiếu dependency khi build.

## Cách chạy lại
```bash
npm install
npx prisma generate
npm run db:seed
npm run dev
```

Tài khoản demo sau seed:
- Admin: `0900000001` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- CSKH: `0900000002` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`
- Đại lý: `0900000003` / `<MẬT_KHẨU_MẠNH_TỰ_ĐẶT>`

Nếu Prisma báo lỗi tải engine, hãy chạy lại khi có mạng ổn định vì Prisma cần tải engine từ máy chủ của họ.
