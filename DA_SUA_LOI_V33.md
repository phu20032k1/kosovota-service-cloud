# Bản sửa lỗi V33

## Các lỗi đã xử lý

1. **Khách hàng – Có lịch liên hệ / Cần quan tâm**
   - Hai thẻ thống kê có thể bấm để mở danh sách xử lý nhanh.
   - Hiển thị ngày liên hệ, nguyên nhân cần quan tâm, nút gọi khách và nút mở hồ sơ.
   - Tự cuộn đúng tới khu vực chi tiết sau khi chọn thẻ.

2. **Tài khoản – tràn màn hình khi sửa**
   - Cửa sổ sửa tài khoản giới hạn theo chiều cao màn hình.
   - Phần nội dung cuộn độc lập, thanh nút Lưu/Hủy luôn nhìn thấy.
   - Khóa cuộn trang nền khi cửa sổ đang mở.
   - Bộ lọc và bố cục danh sách tự xuống hàng trên màn hình nhỏ.

3. **Ticket – `Unexpected end of JSON input`**
   - Không gọi `response.json()` trực tiếp ở các màn hình liên quan.
   - Phản hồi rỗng, HTML hoặc JSON lỗi được chuyển thành thông báo rõ ràng.
   - API Ticket và lệnh dịch vụ luôn trả JSON kể cả khi truy vấn cơ sở dữ liệu lỗi.

4. **Ticket tự động liên kết Điều phối**
   - Ticket nghiệp vụ có máy được chọn sẽ tự tạo `ServiceOrder` và lưu `serviceOrderId`.
   - Sau khi tạo thành công có nút mở ngay lệnh vừa tạo tại tab Điều phối.
   - Ticket cũ đã có máy nhưng chưa có lệnh có thể tạo lệnh Điều phối ngay từ chi tiết Ticket.
   - Trạng thái, đại lý và hạn xử lý tiếp tục được đồng bộ giữa Ticket và lệnh.

5. **Xem lại chi tiết lệnh**
   - Sửa cách đọc dữ liệu API để không vỡ trang khi máy chủ trả phản hồi lỗi.
   - Sửa tên trường người gửi trao đổi Ticket từ `senderName` thành đúng `authorName`.
   - API chi tiết lệnh được bọc xử lý lỗi và luôn trả JSON.
   - Cho phép xóa lịch hẹn/phí dịch vụ khi lưu giá trị trống.

6. **Triển khai Vercel**
   - `vercel-build` đã thêm `prisma migrate deploy` để tự áp dụng migration liên kết Ticket–Điều phối trước khi build.
   - Hai URL gói npm dùng mirror không ổn định đã đổi về registry npm chuẩn.

## Chạy kiểm tra ở máy local

```powershell
npm ci
npm run db:generate
npm run db:migrate
npm run lint
npm run typecheck
npm run build
```

Sau khi đẩy lên Vercel, kiểm tra log phải có bước `prisma migrate deploy`. Biến `DATABASE_URL` cần trỏ đúng PostgreSQL production.
