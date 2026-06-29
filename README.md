# KOSOVOTA Service Cloud V4

Nền tảng quản lý vòng đời máy lọc nước, khách hàng, đại lý, KTV, chăm sóc sau bán hàng, kho và đối soát.

## Phân hệ

- QR máy, kích hoạt hai bước, GPS và ảnh xác thực.
- Cổng khách hàng OTP, lịch sử, lịch bảo trì, chia sẻ máy và SOS.
- CSOS cho CSKH theo phạm vi tỉnh.
- Bản đồ máy, đại lý và điều phối.
- Đại lý: lệnh, đội KTV, kho và đối soát.
- KTV: chỉ lệnh được giao và báo cáo hoàn thành.
- Admin: CRM, duyệt đại lý, ticket, kho, đối soát, import/export, thông báo, tích hợp và nhật ký.
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
| Đại lý | `/agent-portal` |
| KTV | `/technician-portal` |
| Khách hàng | `/customer-portal` |
| Đăng ký đại lý | `/dealer-register` |
| QR máy | `/qr/{MACHINE_ID}` |

## Import Excel

Mẫu: `public/templates/import-may-cu-kosovota.xlsx`

Màn import: `/admin/reports`

## Tài liệu chính

- `HUONG_DAN_V4_PHAN_QUYEN_TEST_API.md`: phân quyền, cách test và nối dịch vụ ngoài.
- `EXTERNAL_SERVICES_GUIDE.md`: ghi chú chi tiết tích hợp hiện có.
- `.env.example`: toàn bộ biến cấu hình.
