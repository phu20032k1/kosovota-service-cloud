# KOSOVOTA Service Cloud V30

Nền tảng quản lý vòng đời máy lọc nước, khách hàng, đại lý, KTV, chăm sóc sau bán hàng, kho và đối soát.

## Phân hệ

- QR máy, kích hoạt hai bước, GPS và ảnh xác thực.
- Cổng khách hàng OTP, lịch sử, lịch bảo trì, chia sẻ máy và SOS.
- CSOS cho CSKH theo phạm vi tỉnh.
- Bản đồ máy, đại lý và điều phối.
- Đại lý/CTV: lệnh, kích hoạt QR, báo cáo dịch vụ, đội KTV, kho và đối soát.
- KTV: chỉ lệnh được giao và báo cáo hoàn thành.
- Admin: CRM 360°, Ticket tự liên kết Điều phối, Dashboard trực quan, kho, đối soát, import/export, thông báo, tích hợp và nhật ký.
- SUPER_ADMIN tách riêng: tạo Admin/CSKH, khóa tài khoản, đặt lại mật khẩu.

## Chạy dự án

Yêu cầu Node.js 20+.

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Trên Windows PowerShell dùng `copy .env.example .env`.

`npm run db:seed` chỉ tạo SUPER_ADMIN và ADMIN từ biến môi trường; không tạo dữ liệu nghiệp vụ giả.

Bộ dữ liệu kiểm thử riêng, chỉ chạy ở local/test:

```bash
npm run db:seed:test
```

## Đường dẫn

| Vai trò/phân hệ | URL |
|---|---|
| SUPER_ADMIN ẩn | `/super-admin/login` |
| Đăng nhập nội bộ | `/login` |
| Admin | `/admin/executive` |
| CSKH | `/csos` |
| Đại lý / CTV | `/agent-portal` |
| KTV | `/technician-portal` |
| Khách hàng | `/customer-portal` |
| Đăng ký đại lý | `/dealer-register` |
| QR máy | `/qr/{MACHINE_ID}` |

## Import Excel

- Máy/seri: `/admin/reports` và `public/templates/import-may-cu-kosovota.xlsx`.
- Khách hàng: `/admin/customers`; các dòng trùng số điện thoại tự gộp vào một hồ sơ và có thể gắn nhiều máy.
- Đại lý/CTV: `/admin/dealers`; bắt buộc mã CRM, tự động duyệt và tạo tài khoản sau import.

## Tài liệu chính

- `HUONG_DAN_V4_PHAN_QUYEN_TEST_API.md`: phân quyền, cách test và nối dịch vụ ngoài.
- `EXTERNAL_SERVICES_GUIDE.md`: ghi chú chi tiết tích hợp hiện có.
- `.env.example`: toàn bộ biến cấu hình.
- `MO_TA_LAI_YEU_CAU_V30.md`: đặc tả yêu cầu và tiêu chí nghiệm thu theo ảnh kiểm thử.
- `DA_SUA_GI_V30.md`: changelog, migration và kịch bản test V30.
