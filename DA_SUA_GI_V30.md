# ĐÃ SỬA GÌ – KOSOVOTA V30

## Các phần đã hoàn thành

- Viết lại màn Ticket thành luồng Ticket & Điều phối thống nhất.
- Thêm trường và khối **Mô tả lại yêu cầu**.
- Tự tạo `ServiceOrder` từ Ticket nghiệp vụ khi đã chọn máy.
- Đồng bộ trạng thái, đại lý và hạn xử lý giữa Ticket với lệnh.
- Thêm liên kết hai chiều Ticket ↔ lệnh Điều phối.
- Tạo trang chi tiết lệnh `/admin/service-orders/[id]` với khách hàng, máy, đại lý, KTV, báo cáo, ảnh, vật tư, chữ ký và dòng thời gian.
- Viết lại `/operations-map` theo dạng hàng đợi điều phối + bản đồ + đại lý gần nhất, hỗ trợ deep-link theo lệnh/máy.
- Thêm “Đăng ký Đại lý / CTV” tại màn QR; nhận diện đúng vai trò CTV.
- Bắt buộc mã đại lý/mã CRM trên Form đăng ký, không tự sinh mã.
- Import đại lý/CTV tự động duyệt, tự tạo/kích hoạt tài khoản và phân đúng vai trò.
- Thêm import khách hàng Excel; gộp theo số điện thoại và gắn nhiều máy vào một khách hàng.
- Nâng Khách hàng 360°: hiển thị số máy, loại máy, chi tiết từng máy và dòng thời gian dịch vụ.
- Cho phép bấm KPI Khách VIP / Có lịch liên hệ / Cần quan tâm để xem danh sách chi tiết.
- Nâng chi tiết đại lý: trả lại toàn bộ dữ liệu Form đăng ký, ảnh, GPS, ngân hàng, năng lực và liên kết Ticket/lệnh.
- Đồng bộ đổi mã đại lý tới tài khoản DEALER/CTV/KTV.
- Thêm vai trò CTV xuyên suốt đăng nhập, phân quyền, QR, kích hoạt, lệnh và báo cáo dịch vụ.
- Nâng Dashboard lãnh đạo: phễu chăm sóc, biểu đồ 6 tháng, phân bổ trạng thái, tỉnh/thành, tồn kho và hiệu suất đại lý.
- Nâng modal báo cáo chi tiết cho desktop/mobile.
- Sửa tràn màn hình, cuộn bảng, thanh điều hướng, nút mobile và bố cục responsive.
- Chuẩn hóa font Be Vietnam Pro, nhãn, badge, card, khoảng cách và trạng thái.
- Bổ sung migration liên kết `SupportTicket.serviceOrderId`.
- Dọn cảnh báo ESLint; `npm run lint` hiện chạy sạch.

## Migration mới

```text
prisma/migrations/20260719193000_ticket_dispatch_link/migration.sql
```

Migration thêm `SupportTicket.serviceOrderId`, unique index và khóa ngoại tới `ServiceOrder`.

## Cách chạy sau khi giải nén

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run dev
```

Trên macOS/Linux dùng:

```bash
cp .env.example .env
```

Sau khi cấu hình `DATABASE_URL`, chạy kiểm tra đầy đủ:

```bash
npm run verify
```

## Kịch bản test nhanh

1. Đăng nhập Admin, vào `/admin/tickets`, tạo Ticket loại Bảo hành và chọn máy.
2. Kiểm tra Ticket hiển thị mã lệnh; bấm mở lệnh chi tiết.
3. Mở `/operations-map`, xác nhận lệnh vừa tạo xuất hiện và có thể phân đại lý.
4. Vào `/admin/customers`, import file có hai dòng cùng số điện thoại nhưng khác máy; xác nhận chỉ có một khách hàng với hai máy.
5. Vào `/admin/dealers`, import file có mã CRM; xác nhận hồ sơ được duyệt và tài khoản được tạo ngay.
6. Mở hồ sơ đại lý để kiểm tra ảnh, GPS, thông tin ngân hàng, lệnh và Ticket.
7. Mở `/admin/executive`, bấm các KPI và kiểm tra báo cáo chi tiết trên desktop lẫn điện thoại.
8. Quét QR hoặc mở `/qr/{MACHINE_ID}`, kiểm tra nút Đăng ký Đại lý / CTV.

## Trạng thái kiểm tra trong môi trường đóng gói

- `npm run lint`: đạt, không còn lỗi/cảnh báo.
- Không thể hoàn thành `prisma generate`, `typecheck` và `build` trong môi trường đóng gói vì máy không truy cập được `binaries.prisma.sh` để tải Prisma schema engine. Đây là giới hạn mạng của môi trường, không phải lỗi cú pháp ESLint.
- Sau khi giải nén trên máy có Internet, cần chạy `npm run db:generate` trước `npm run typecheck` hoặc `npm run build`.
