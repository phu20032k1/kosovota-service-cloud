# Hướng dẫn vận hành KOSOVOTA V3

## 1. Tạo kho và nhập tồn đầu kỳ

1. Đăng nhập Admin, mở `/admin/inventory`.
2. Chọn **Tạo kho**.
3. Chọn loại:
   - `CENTRAL`: kho tổng.
   - `REGIONAL`: kho khu vực.
   - `DEALER`: kho gắn với một đại lý đã duyệt.
4. Chọn **Thêm vật tư** để tạo SKU, giá vốn, giá bán và ngưỡng tồn tối thiểu.
5. Chọn **Lập phiếu kho → Nhập kho** để ghi tồn ban đầu.

Không thể tạo hai kho cho cùng một đại lý. Phiếu xuất và điều chuyển bị từ chối nếu tồn khả dụng không đủ.

## 2. Đại lý sử dụng vật tư khi làm dịch vụ

1. Đại lý mở `/agent-portal` và nhận lệnh.
2. Chuyển lệnh sang **Đang xử lý**.
3. Chọn **Gửi báo cáo**.
4. Chọn từng vật tư và số lượng thực tế đã dùng.
5. Tải ảnh lõi cũ, lõi mới, ảnh hoàn thành và nhập xác nhận khách hàng.
6. Gửi báo cáo.

Hệ thống thực hiện đồng thời:

- Kiểm tra tồn kho đại lý.
- Trừ tồn.
- Tạo phiếu `SERVICE_USE` gắn mã lệnh.
- Lưu báo cáo.
- Hoàn thành lệnh và lịch bảo trì liên quan.
- Ghi nhật ký thao tác.

Nếu một bước thất bại, toàn bộ transaction được hoàn tác.

## 3. Tạo và thanh toán đối soát

1. Admin mở `/admin/payments`.
2. Chọn đại lý và khoảng thời gian.
3. Hệ thống chỉ lấy lệnh:
   - Đã hoàn thành.
   - Có đại lý.
   - Chưa thanh toán.
   - Chưa nằm trong kỳ đối soát khác.
4. Tạo kỳ đối soát.
5. Kiểm tra tiền công, vật tư và tổng tiền.
6. Duyệt, sau đó ghi mã giao dịch ngân hàng và đánh dấu đã thanh toán.

Đại lý xem lịch sử tại `/agent-portal/payments`.

## 4. Ticket bảo hành và khiếu nại

1. Mở `/admin/tickets`.
2. Tạo ticket, chọn khách hàng/máy, loại yêu cầu, mức ưu tiên và hạn SLA.
3. Giao nhân viên hoặc đại lý xử lý.
4. Thêm trao đổi trong timeline.
5. Chuyển trạng thái: Mới → Đang xử lý → Đã xử lý → Đã đóng.
6. Có thể ghi điểm hài lòng sau khi hoàn thành.

Ticket quá hạn được thể hiện trên dashboard lãnh đạo.

## 5. CRM khách hàng 360°

- Danh sách: `/admin/customers`.
- Hồ sơ chi tiết: `/admin/customers/[id]`.
- Có thể xem máy, lịch bảo trì, lệnh dịch vụ, ticket và lịch sử tương tác.
- Ghi lại cuộc gọi, Zalo/SMS, ghi chú, kết quả và ngày cần liên hệ tiếp.

## 6. Dashboard và nhật ký

- `/admin/executive`: KPI doanh thu, công nợ, lịch quá hạn, ticket và tồn kho.
- `/admin/audit-logs`: tìm theo hành động, mục tiêu, IP hoặc nội dung thay đổi.

## 7. Nguyên tắc vận hành

- Không sửa trực tiếp database khi có thể thao tác từ giao diện.
- Mỗi đại lý phải có kho trước khi xuất vật tư theo lệnh.
- Chỉ tạo đối soát sau khi báo cáo dịch vụ đã đầy đủ.
- Không chia sẻ tài khoản Admin.
- Định kỳ xuất backup và kiểm tra nhật ký truy cập dữ liệu khách hàng.
