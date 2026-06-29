# Ghi chú triển khai KOSOVOTA Service Cloud V3

## Kiến trúc

- Next.js App Router, React, TypeScript, Prisma và PostgreSQL/Neon.
- API kiểm tra quyền phía server; giao diện không được xem là lớp bảo mật.
- Các nghiệp vụ thay đổi nhiều bảng như trừ kho, hoàn thành lệnh và tạo đối soát chạy trong database transaction.
- Mã phiếu kho, ticket và kỳ đối soát dùng bảng sequence để tránh trùng khi có nhiều thao tác đồng thời.

## Design system

- Font Be Vietnam Pro và font hệ thống dự phòng.
- Icon SVG thống nhất; không dùng emoji cho chức năng nghiệp vụ.
- Component chung cho header, KPI, bảng, thông báo, loading, badge trạng thái và form.
- Giao diện responsive cho desktop, tablet và điện thoại.

## Map và thông báo

- Bản đồ hỗ trợ OpenStreetMap, MapTiler và Google Maps qua biến môi trường.
- `/operations-map` kết hợp lớp máy và đại lý, lọc năng lực và giao lệnh.
- Hàng đợi `Notification` lưu payload, trạng thái, số lần thử, lỗi và mã nhà cung cấp.
- Worker: `npm run notifications:process`; endpoint cron yêu cầu `CRON_SECRET`.
- Mặc định `NOTIFICATION_DRY_RUN=true`.

## CRM và ticket

- `CustomerActivity` lưu cuộc gọi, Zalo/SMS, ghi chú và lịch hẹn lại.
- `SupportTicket` liên kết khách hàng, máy, đại lý và nhân viên phụ trách.
- Ticket có priority, status, dueAt, resolvedAt và `TicketMessage` làm timeline.

## Kho và đối soát

- `InventoryItem`, `Warehouse`, `StockBalance`, `StockMovement` quản lý tồn theo kho.
- Xuất kho chặn âm tồn và tôn trọng số lượng đang giữ chỗ.
- Khi đại lý hoàn thành lệnh, vật tư đã chọn được trừ trong cùng transaction với báo cáo và trạng thái lệnh.
- `PaymentBatch` và `PaymentLine` chỉ nhận lệnh hoàn thành, chưa có dòng đối soát; chi phí vật tư lấy từ `StockMovement.unitCost`.

## Nhật ký

- `AdminLog` lưu user, action, target, detail, IP, user-agent và request ID.
- Các thao tác tạo vật tư, kho, phiếu kho, ticket, đối soát, thanh toán và hoàn thành dịch vụ được ghi audit.

## Production

- Dữ liệu hiện dùng PostgreSQL/Neon; không còn dùng SQLite trong schema chính.
- Ảnh local chỉ phù hợp phát triển. Production dùng S3, Cloudflare R2, MinIO hoặc Cloudinary.
- Thiết lập backup database, HTTPS, secret manager và lịch xoay access token.
- Chạy `npm audit --omit=dev`, `npm run lint`, `npm run typecheck` và `npm run build` trước mỗi lần phát hành.
