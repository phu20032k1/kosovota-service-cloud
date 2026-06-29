# Hướng dẫn chạy KOSOVOTA với Neon và Cloudflare R2

## 1. Phần đã được chuẩn hóa trong bản này

- Chỉ dùng một Prisma schema PostgreSQL tại `prisma/schema.prisma`.
- Sửa toàn bộ script cũ trỏ tới thư mục `prisma-postgres` không tồn tại.
- Đồng bộ `package-lock.json` để `npm ci` có thể hoạt động.
- Thêm kiểm tra Neon: `npm run test:db`.
- Thêm kiểm tra R2: `npm run test:r2`.
- Thêm health check: `/api/health`.
- Super Admin tạo được Admin, CSKH, Đại lý, KTV.
- Admin tạo được CSKH, Đại lý, KTV tại `/admin/users`.
- Đại lý tiếp tục tạo KTV tại `/agent-portal/team`.
- Migration SQLite cũ được lưu tại `prisma/migrations-sqlite-legacy`; migration hiện tại là PostgreSQL baseline.

## 2. Chạy trên Windows

Mở PowerShell tại thư mục có `package.json`:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\CHAY_LOCAL_WINDOWS.ps1
```

Script sẽ tự chạy:

```powershell
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run test:db
npm run test:r2
npm run dev
```

`db:seed` hiện chỉ upsert Super Admin và Admin gốc; không xóa khách hàng, máy hoặc đại lý.

## 3. Cấu hình Neon

Trong `.env`:

```env
DATABASE_URL="postgresql://...neon.tech/..."
```

Kiểm tra:

```powershell
npm run test:db
```

Kết quả đúng có dòng:

```text
OK: Kết nối Neon/PostgreSQL thành công.
```

## 4. Cấu hình Cloudflare R2

Cần đủ các biến:

```env
STORAGE_PROVIDER="r2"
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="..."
R2_REGION="auto"
R2_PUBLIC_BASE_URL="https://pub-....r2.dev"
```

`R2_PUBLIC_BASE_URL` không phải S3 API endpoint. Nó phải là một trong hai loại:

1. Public Development URL của bucket; hoặc
2. Custom domain đã gắn vào bucket, ví dụ `https://media.kosovota.vn`.

Kiểm tra:

```powershell
npm run test:r2
```

Script sẽ upload ảnh 1 pixel và thử mở URL công khai.

## 5. Phân quyền tài khoản

### Super Admin

Mở `/super-admin` và có thể tạo:

- ADMIN
- CSKH
- DEALER
- KTV

Khi tạo DEALER với mã chưa tồn tại, hệ thống tạo luôn hồ sơ đại lý ở trạng thái `APPROVED` và liên kết tài khoản.

### Admin

Mở `/admin/users` hoặc mục **Tài khoản** trên thanh menu. Admin có thể tạo:

- CSKH
- DEALER
- KTV

### Đại lý

Mở `/agent-portal/team`. Đại lý chỉ tạo KTV thuộc mã đại lý của chính mình.

## 6. Migration PostgreSQL

Database Neon đã được tạo trước đây bằng `prisma db push` thì chạy một lần:

```powershell
npm run db:baseline
```

Lệnh này chỉ ghi nhận migration PostgreSQL baseline là đã áp dụng, không tạo lại bảng.

Database PostgreSQL hoàn toàn mới thì chạy:

```powershell
npm run db:migrate
```

Sau khi baseline xong, các thay đổi schema mới phải tạo migration trên môi trường thử nghiệm trước khi deploy production.

## 7. Chạy kiểm tra toàn bộ

```powershell
npm run verify
```

Hoặc:

```powershell
.\KIEM_TRA_HE_THONG_WINDOWS.ps1
```

Sau khi `npm run dev`, mở:

```text
http://localhost:3000/api/health
```

Kết quả bình thường:

```json
{
  "success": true,
  "status": "ok",
  "database": "connected"
}
```

## 8. Trước khi đưa lên production

Trong `.env` production:

```env
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://ten-mien-that.vn"
OTP_DEBUG="false"
NOTIFICATION_DRY_RUN="false"
STORAGE_PROVIDER="r2"
ALLOW_LOCAL_UPLOADS="false"
ALLOW_DEMO_SEED="false"
```

Xóa hoàn toàn dòng `OTP_FIXED_CODE`.

Chạy:

```powershell
npm run check:production
npm run verify
```
