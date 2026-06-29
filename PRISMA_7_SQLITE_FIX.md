# Sửa lỗi Prisma 7 + SQLite

## Lỗi đã sửa

`Using engine type "client" requires either "adapter" or "accelerateUrl"`

Project dùng Prisma 7 và SQLite. Prisma 7 yêu cầu truyền driver adapter khi tạo `PrismaClient`.

## Các thay đổi

- Thêm `@prisma/adapter-better-sqlite3` đúng phiên bản Prisma `7.8.0`.
- Thêm `dotenv` để script seed đọc được `.env`.
- Khởi tạo Prisma bằng `PrismaBetterSqlite3` trong `src/lib/prisma.ts`.
- Khởi tạo adapter tương tự trong `prisma/seed.ts`.
- Khai báo lệnh seed trong `prisma.config.ts`.
- Giữ singleton Prisma khi Next.js hot reload để không mở nhiều kết nối SQLite.
- Giảm query log trong môi trường phát triển để terminal không bị tràn log.

## Chạy lại trên Windows

Dừng server đang chạy. Mở terminal tại thư mục project rồi thực hiện:

### PowerShell

```powershell
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
npm install
npx prisma generate
npm run dev
```

### Command Prompt (CMD)

```bat
rmdir /s /q .next
rmdir /s /q node_modules
npm install
npx prisma generate
npm run dev
```

Không xóa `dev.db`; đó là file dữ liệu SQLite hiện tại.

## Chỉ khi muốn tạo lại toàn bộ dữ liệu mẫu

Lệnh dưới đây xóa dữ liệu hiện tại rồi tạo dữ liệu demo mới:

```bash
npm run db:seed
```

Không chạy lệnh seed nếu cần giữ khách hàng, máy, đại lý, đơn dịch vụ hoặc dữ liệu đã nhập.
