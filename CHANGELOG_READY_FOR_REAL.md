# KOSOVOTA — thay đổi trong bản ready-for-real

## Dữ liệu máy và import
- Nhận file Excel có hai cột `Seri cần in` và `Tên máy`.
- Tách và lưu tên máy, model, seri, công suất/dung tích, thông số, bảo hành, năm sản xuất.
- Bổ sung model HT100-RU, HT250-RU, HT350-RU, BC04-U và BC06-U.
- Không còn tự gán lịch bảo trì của dòng máy khác cho model chưa nhận diện.

## Giao diện
- Khung Admin và bảng dữ liệu co theo màn hình, tránh tràn toàn trang.
- Nút import rõ ràng hơn, có hướng dẫn và kết quả tạo mới/cập nhật/lỗi.
- Trang báo cáo và trang QR hiển thị thêm tên máy, model và công suất.

## An toàn và production
- Khóa seed demo ở production và yêu cầu quyền Admin khi bật ở local.
- Vô hiệu endpoint đặt lại mật khẩu cũ không còn tương thích schema.
- Thêm giới hạn cơ bản cho đăng nhập, OTP, lead và upload.
- Upload kiểm tra loại/kích thước file; hỗ trợ local khi test và Cloudflare R2 khi production.
- Production không cho dùng OTP cố định; yêu cầu secret đủ dài.
- Thêm security headers cơ bản.
- Loại bỏ file seed tài khoản demo có mật khẩu cố định.

## Cấu hình và vận hành
- Chuẩn hóa một schema PostgreSQL dùng cho Neon; lưu migration SQLite cũ trong thư mục legacy.
- Có `.env.production.example`, kiểm tra biến môi trường production, script Windows và hướng dẫn triển khai.
- Kèm file seri gốc trong `data-import/` để test import.
