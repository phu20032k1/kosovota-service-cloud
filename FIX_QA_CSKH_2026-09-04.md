# KOSOVOTA – sửa QA CSKH / GPS / import / điều phối / bảo trì

Ngày: 2026-09-04

## Phạm vi đã sửa

- Chuẩn hóa phạm vi tỉnh CSKH để cùng nhận `Hà Nội`, `HN`, `01` và các alias tương ứng.
- Áp scope vào khách hàng, máy, đại lý, ticket, bản đồ đại lý; các API hiện có cho SOS, điều phối và bảo trì nhận scope đã được mở rộng từ lớp auth.
- Thêm `/cskh/dealers`: danh sách đại lý chỉ đọc theo tỉnh được giao.
- Tìm khách hàng/máy trực tiếp DB theo tên, SĐT, địa chỉ, ID, Seri, model, tên máy; UI CSKH dùng debounce và AbortController.
- Luồng tạo phiếu CSKH dùng tìm kiếm DB thay vì phụ thuộc danh sách tải sẵn.
- Import khách hàng đồng bộ Seri, tên máy, model, ngày SX, ngày lắp, kích hoạt, thời hạn BH, GPS; lỗi trả về đầy đủ dòng/KH/SĐT/Seri và có CSV lỗi.
- Import đại lý nhận `Số kỹ thuật viên`, ghép tỉnh vào địa chỉ trước geocode và cập nhật hồ sơ.
- Geocode chặn tọa độ ngoài Việt Nam, kiểm tra token/số nhà và từ chối địa chỉ mơ hồ.
- Bản đồ máy có `Tự ghim GPS`, chạy theo batch và báo số cần kiểm tra/còn lại.
- Shortlist điều phối tự ghim máy/đại lý thiếu GPS, hỗ trợ `radiusKm` lọc trước `slice`; tương thích client cũ bằng cách không cắt 30 kết quả quá sớm.
- Lịch thay lõi tách `Quá hạn`, `Hôm nay`, `7 ngày tới`.
- Cron reminder/process hỗ trợ GET + `CRON_SECRET`; reminder bao gồm quá hạn và chống trùng.
- Vercel Cron: reminder `23:45 UTC`, process queue `00:00 UTC`.
- Hồ sơ CSKH hiển thị Seri/model/ngày SX/ngày lắp/kích hoạt/thời hạn BH/ngày hết hạn BH.

## Checklist QA lại

1. Tạo CSKH phạm vi `Hà Nội`, `HN`, `01` ở 3 tài khoản khác nhau và xác nhận cùng nhìn thấy đúng tập dữ liệu Hà Nội.
2. Xác nhận CSKH không xem/sửa được khách hàng ngoài vùng bằng URL trực tiếp.
3. Mở `/cskh/dealers`: không có nút duyệt/sửa/xóa, chỉ có đại lý đúng vùng.
4. Tạo yêu cầu: gõ tên/SĐT/Seri/model và xác nhận kết quả DB xuất hiện sau ~300ms; gõ nhanh không bị kết quả request cũ ghi đè.
5. Import file 176 dòng mẫu: các dòng phone sai phải hiện dòng/KH/SĐT/Seri/nguyên nhân; tải CSV lỗi và nhập lại được.
6. Import đại lý có `Số kỹ thuật viên`; kiểm tra `technicianCount` cập nhật và GPS dùng `Địa chỉ + Tỉnh`.
7. Thử địa chỉ mơ hồ và tọa độ Nhật Bản: hệ thống không được ghim.
8. Bản đồ máy: bấm `Tự ghim GPS`; kiểm tra số updated/failed/remaining.
9. Điều phối máy thiếu GPS + đại lý thiếu GPS; hệ thống tự ghim trước khi tính khoảng cách.
10. Lịch thay lõi: kiểm tra 3 nhóm quá hạn/hôm nay/7 ngày tới độc lập.
11. Gọi cron GET không có secret => 403; Bearer `CRON_SECRET` => chạy thành công.
12. Vercel cron phải có hai lịch `45 23 * * *` và `0 0 * * *`.
