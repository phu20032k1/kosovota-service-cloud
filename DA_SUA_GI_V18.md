# KOSOVOTA v18 — các phần đã sửa

## Chạy và triển khai

- Đồng bộ `package-lock.json` với `package.json`.
- Bỏ toàn bộ script trỏ tới thư mục `prisma-postgres` không tồn tại.
- Chuẩn hóa một schema PostgreSQL cho Neon.
- Chuyển migration SQLite cũ sang `prisma/migrations-sqlite-legacy`.
- Tạo PostgreSQL baseline tại `prisma/migrations/20260624000000_postgresql_baseline`.
- Thêm `npm run db:push`, `npm run db:baseline`, `npm run verify`.
- Thêm PowerShell chạy lần đầu và kiểm tra hệ thống.

## Neon và R2

- Thêm `npm run test:db` để kiểm tra Neon và đếm dữ liệu chính.
- Thêm `npm run test:r2` để upload ảnh kiểm tra và xác nhận URL công khai.
- Thêm `/api/health` để kiểm tra database và cấu hình storage khi website đang chạy.
- Dọn file `.env` bị lặp biến; giữ nguyên các khóa bí mật hiện có.
- Tạo `CRON_SECRET` và `NEXT_PUBLIC_APP_URL` local còn thiếu.
- Phát hiện còn thiếu `R2_PUBLIC_BASE_URL`; giữ `STORAGE_PROVIDER=local` để tránh upload lỗi trước khi điền URL.

## Phân quyền

- Super Admin tạo được: ADMIN, CSKH, DEALER, KTV.
- Admin có trang mới `/admin/users`, tạo được: CSKH, DEALER, KTV.
- Đại lý vẫn tạo KTV của chính đại lý tại `/agent-portal/team`.
- Khi Admin/Super Admin tạo đại lý với mã mới, hệ thống tạo luôn hồ sơ Dealer đã duyệt.
- Khi tạo KTV, bắt buộc chọn đại lý đã duyệt.
- Có khóa/mở, sửa, đổi mật khẩu và xóa tài khoản chưa có dữ liệu liên kết.
- Mật khẩu ban đầu được đưa vào hàng đợi thông báo.

## Kiểm tra đã thực hiện

- ESLint: đạt.
- Next.js dev server: khởi động thành công.
- Trang `/login`: HTTP 200.
- Route bảo vệ `/super-admin`: chuyển đúng sang trang đăng nhập.
- Next.js biên dịch source thành công.
- Đối chiếu PostgreSQL baseline với 23 model và toàn bộ quan hệ trong Prisma schema: không thiếu bảng, cột hoặc khóa ngoại.

## Việc cậu cần điền duy nhất trước khi test R2

```env
R2_PUBLIC_BASE_URL="https://..."
STORAGE_PROVIDER="r2"
```

Sau đó chạy:

```powershell
npm run test:r2
```
