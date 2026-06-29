# KOSOVOTA Service Cloud V3.0.0 — Release Notes

Ngày đóng gói: 18/06/2026

## Nâng cấp chính

- CRM khách hàng 360° và lịch sử tương tác.
- Ticket bảo hành/khiếu nại có SLA và timeline.
- Kho tổng, kho khu vực, kho đại lý và phiếu nhập/xuất/điều chuyển.
- Đại lý chọn vật tư khi hoàn thành lệnh; hệ thống tự kiểm tra và trừ tồn.
- Đối soát tiền công + chi phí vật tư theo từng lệnh.
- Dashboard lãnh đạo và nhật ký bảo mật.
- Giao diện quản trị và cổng đại lý được mở rộng nhưng giữ nguyên design system V2.

## Kiểm tra phát hành

- ESLint: đạt.
- TypeScript: đạt.
- Next.js production build: 71/71 route.
- `npm audit --omit=dev`: 0 lỗ hổng được báo cáo.
- Migration từ database rỗng: 5/5 migration áp dụng thành công.
- SQLite integrity: `ok`.
- Foreign key errors: `0`.

## Lưu ý khi nâng từ V2

Chạy:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

Không sao chép đè file `.env` production. Luôn backup database trước khi chạy migration.
