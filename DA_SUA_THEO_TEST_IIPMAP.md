# Các lỗi đã sửa theo “Test ứng dụng IIPMap.xlsx”

## Điều hành – báo cáo

- Các KPI quan trọng trên Dashboard điều hành có thể bấm để mở báo cáo/danh sách tương ứng.
- “Lịch quá hạn” mở bảng chi tiết ngay trên Dashboard, có khách hàng, máy và ngày quá hạn.
- “Máy khách đang sử dụng” chỉ đếm máy đã gắn khách hàng; hiển thị thêm tổng máy toàn hệ thống để tránh nhầm máy kho/chưa kích hoạt.

## Khách hàng

- Thêm nhập khách hàng hàng loạt từ Excel.
- Dòng trùng số điện thoại được gom vào một khách hàng; nhiều dòng máy có thể gắn vào cùng hồ sơ.
- Hồ sơ hiển thị CSKH phụ trách, liên hệ gần nhất và lịch tiếp theo.
- Mỗi thiết bị hiển thị seri, tên/model, ngày sản xuất, ngày lắp, ngày kích hoạt bảo hành, tổng lệnh, đã xử lý và chưa xử lý.
- Dòng thời gian hợp nhất tương tác CSKH, lệnh dịch vụ, báo cáo xử lý và yêu cầu bảo hành/sửa chữa theo máy.
- Thêm khu vực yêu cầu bảo hành/sửa chữa liên quan.

### Cột Excel nhập khách hàng

- Bắt buộc: `Tên khách hàng`, `Số điện thoại`.
- Tùy chọn: `Địa chỉ`, `Email`, `Phân khúc`, `Nhãn`, `CSKH phụ trách`, `Seri`, `Model`, `Ngày lắp đặt`.

## Đại lý

- Thêm nút “Xem / sửa chi tiết” cho từng đại lý.
- Trang chi tiết trả lại đầy đủ dữ liệu form đăng ký, lệnh, ticket và đối soát.
- Admin được sửa mã đại lý/CRM. Khi đổi mã, hệ thống đồng bộ mã trên các tài khoản Đại lý và KTV liên quan.

## Tài khoản

- Admin được đổi vai trò giữa `CSKH`, `DEALER`, `KTV`.
- Khi đổi vai trò, hệ thống kiểm tra phạm vi tỉnh hoặc mã đại lý và xóa phạm vi không còn phù hợp.

## Kiểm tra kỹ thuật

- ESLint các tệp thay đổi: đạt.
- TypeScript `tsc --noEmit`: đạt.
- Next.js production build: đạt.
