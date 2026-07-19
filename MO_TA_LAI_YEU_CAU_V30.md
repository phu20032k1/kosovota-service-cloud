# MÔ TẢ LẠI YÊU CẦU – KOSOVOTA V30

Tài liệu này viết lại đầy đủ yêu cầu từ các ảnh kiểm thử ngày 18–19/07 và cách hệ thống phải hoạt động sau khi sửa.

## 1. Luồng Ticket → Điều phối

### Yêu cầu nghiệp vụ

1. Ticket là nơi tiếp nhận yêu cầu dịch vụ từ các nguồn: Admin/CSKH tạo, khách hàng gửi yêu cầu, đại lý/CTV/KTV ghi nhận từ QR hoặc quá trình chăm sóc.
2. Khi tạo Ticket cần lưu đủ: loại yêu cầu, tiêu đề, **Mô tả lại yêu cầu**, khách hàng, máy, người liên hệ, mức ưu tiên, hạn xử lý, đại lý và nhân viên phụ trách.
3. Với Ticket nghiệp vụ gồm bảo hành, sửa chữa, bảo trì, lắp đặt hoặc khiếu nại, nếu đã chọn máy thì hệ thống tự tạo lệnh dịch vụ và tự liên kết sang Điều phối.
4. Không được tạo xong Ticket nhưng Điều phối không có dữ liệu.
5. Từ Ticket phải xem được mã lệnh đã liên kết, trạng thái, máy, khách hàng, đại lý, KTV, hạn xử lý và báo cáo hoàn thành.
6. Ticket cũ chưa có lệnh phải có nút tạo lệnh Điều phối ngay tại màn hình chi tiết.
7. Thay đổi trạng thái, đại lý hoặc hạn xử lý ở Ticket phải đồng bộ với lệnh liên kết.
8. Từ Điều phối phải mở được chi tiết Ticket nguồn; từ Ticket phải mở được chi tiết lệnh.

### Tiêu chí nghiệm thu

- Tạo Ticket có máy thuộc nhóm nghiệp vụ → xuất hiện ngay một lệnh ở `/operations-map`.
- Mở `/admin/tickets?ticket={id}` → tự chọn đúng Ticket.
- Mở `/operations-map?order={id}` → tự chọn đúng lệnh.
- Không mất phần mô tả gốc của khách hàng; phần “Mô tả lại yêu cầu” hiển thị rõ tại Ticket và lệnh.

## 2. QR và đăng ký Đại lý/CTV

1. Khi khách hàng quét QR máy, hệ thống cho phép xác thực bằng số điện thoại/OTP để xem đúng máy của mình.
2. Khi đại lý, CTV hoặc KTV quét QR, hệ thống nhận diện vai trò và đưa về đúng cổng nghiệp vụ.
3. Tại màn hình QR luôn có lối vào **Đăng ký Đại lý / CTV** để người chưa có tài khoản đăng ký.
4. Form đăng ký bắt buộc nhập mã khách hàng/mã đại lý đã tồn tại trên CRM; không tự sinh mã.
5. Mã đại lý, mã CRM và mã đăng nhập phải đồng bộ.

## 3. Import Excel

### Khách hàng

1. Có nút nhập khách hàng từ Excel ngay tại màn hình Khách hàng 360°.
2. Các cột tối thiểu: Tên khách hàng và Số điện thoại.
3. Có thể nhập thêm địa chỉ, email, CSKH phụ trách, mã/seri máy, model và ngày lắp đặt.
4. Các dòng có cùng số điện thoại được gộp thành một khách hàng; các máy khác nhau được liên kết vào hồ sơ đó.
5. Import cập nhật dữ liệu trực tiếp, không tạo hàng chờ duyệt.
6. Sau import hiển thị rõ số dòng thành công, tạo mới, cập nhật, gắn máy và lỗi theo dòng.

### Đại lý/CTV

1. File bắt buộc có Mã đại lý/Mã CRM, tên và số điện thoại.
2. Không tự sinh mã đại lý.
3. Tất cả dòng hợp lệ được tự động chuyển sang trạng thái `APPROVED`.
4. Hệ thống tự tạo hoặc kích hoạt tài khoản đăng nhập tương ứng.
5. Dòng CTV được tạo đúng vai trò CTV; dòng đại lý được tạo đúng vai trò DEALER.
6. Sau import hiển thị kết quả chi tiết, không bắt người dùng duyệt lại thủ công.

### Máy/seri

1. Dữ liệu hợp lệ được tạo/cập nhật trực tiếp, không có hàng chờ duyệt.
2. Nếu file có khách hàng cùng số điện thoại, hệ thống dùng chung một hồ sơ khách hàng.
3. Nếu có ngày lắp đặt, hệ thống tạo lịch chăm sóc/bảo trì tự động.

## 4. Khách hàng sử dụng nhiều máy

1. Một số điện thoại chỉ tương ứng với một hồ sơ khách hàng.
2. Một khách hàng có thể sở hữu nhiều máy/model/sản phẩm.
3. Danh sách khách hàng phải hiển thị số máy và tên/model các máy đang dùng.
4. Chi tiết khách hàng phải hiển thị từng máy với seri, model, ngày sản xuất, ngày lắp đặt, kích hoạt bảo hành, tổng lệnh, số lệnh đã xử lý và chưa xử lý.
5. Dòng thời gian hợp nhất tương tác CSKH, Ticket, lệnh dịch vụ và báo cáo theo từng máy.

## 5. Chi tiết Đại lý/CTV

1. Admin xem và sửa được toàn bộ thông tin đại lý đã nhập trên Form đăng ký:
   - mã CRM/mã đại lý;
   - loại đăng ký, tên công ty/cửa hàng, người đại diện, ngày sinh;
   - số điện thoại, email, tỉnh/thành, địa chỉ, loại địa điểm;
   - GPS, khu vực phụ trách, số KTV, năng lực dịch vụ;
   - mã số thuế, CCCD, tài khoản ngân hàng;
   - ảnh chân dung, cửa hàng, kho và tên video đăng ký.
2. Đổi mã đại lý phải đồng bộ mã trên tài khoản DEALER/CTV/KTV liên quan.
3. Màn chi tiết phải liên kết được tới từng lệnh dịch vụ và từng Ticket của đại lý.

## 6. Báo cáo và Dashboard

1. Tất cả thẻ KPI quan trọng phải bấm được để xem dữ liệu chi tiết, không chỉ hiển thị số.
2. Dashboard cần trực quan hóa:
   - máy khách đang sử dụng;
   - máy đến kỳ chăm sóc;
   - máy đã chăm sóc;
   - máy đã có báo cáo dịch vụ;
   - lệnh đang xử lý và đã hoàn thành;
   - xu hướng lệnh tạo/hoàn thành/báo cáo trong 6 tháng;
   - trạng thái Ticket và lệnh;
   - phân bổ máy theo tỉnh;
   - tồn kho thấp và hiệu suất đại lý.
3. Tại Khách hàng 360°, các thẻ “Khách VIP”, “Có lịch liên hệ”, “Cần quan tâm” phải bấm để lọc đúng danh sách chi tiết.
4. Báo cáo chi tiết phải có bảng desktop và dạng thẻ dễ đọc trên điện thoại.

## 7. Giao diện và điện thoại

1. Không để trang, bảng, thanh điều hướng hoặc nút thao tác tràn khỏi chiều rộng màn hình.
2. Trên điện thoại, nút chính chuyển sang toàn chiều rộng khi cần; bảng cuộn bên trong khung thay vì đẩy cả trang.
3. Modal báo cáo dùng chiều cao động, có nút đóng luôn nhìn thấy và dạng thẻ trên mobile.
4. Font thống nhất dùng Be Vietnam Pro; tiêu đề, nhãn, trạng thái và khoảng cách được chuẩn hóa.
5. Màn Ticket, Điều phối, chi tiết lệnh, chi tiết đại lý và Dashboard phải có phân cấp thị giác rõ, dễ đọc và thao tác.

## 8. Vai trò tài khoản

Hệ thống có năm vai trò nghiệp vụ chính:

- `ADMIN`: quản trị toàn hệ thống.
- `CSKH`: chăm sóc khách hàng theo phạm vi được giao.
- `DEALER`: quản lý lệnh, kho, KTV và đối soát của đại lý.
- `CTV`: nhận và xử lý lệnh theo mã đại lý, có thể kích hoạt máy và gửi báo cáo.
- `KTV`: chỉ xử lý lệnh được phân công.

Mỗi tài khoản Đại lý/CTV/KTV phải có mã đại lý/CRM liên kết; dữ liệu được giới hạn theo mã này.
