# Hướng dẫn test nhanh các lỗi đối tác nêu

## 1) Cài bản sửa
Giải nén file patch và chép đè đúng thư mục dự án.

Sau đó chạy:

```powershell
npm install
npx prisma generate
npm run db:push
npm run dev
```

## 2) Tạo dữ liệu test an toàn
Lệnh này chỉ thêm dữ liệu TEST, không xóa dữ liệu cũ:

```powershell
npm run db:seed:test
```

Tài khoản test được in ra màn hình, mặc định là:

- Admin: `0999000001` / `Admin@123456`
- Đại lý: `0999000002` / `Dealer@123456`
- KTV: `0999000003` / `Ktv@123456`
- QR test: `/qr/TEST-MAY-0001`

## 3) Test nhập máy cũ hàng loạt
Vào:

```text
/admin/reports
```

Test:

1. Bấm **Tải mẫu máy**: file tải về phải là `.xlsx`.
2. Bấm **IMPORT FILE SERI**.
3. Chọn file máy `.xlsx`.
4. Kết quả phải hiện số dòng thành công, tạo mới, cập nhật, lỗi.
5. Bấm **Xuất Excel máy**: file tải về phải là `.xlsx` thật, mở Excel không báo sai định dạng.

Các cột xuất máy đã khớp lại với mẫu nhập chính: ID máy, seri, tên máy, model, công suất, bảo hành, năm sản xuất, khách hàng, SĐT, địa chỉ, tỉnh, vĩ độ, kinh độ, ngày lắp, trạng thái, thông tin máy, ảnh.

## 4) Test nhập đại lý hàng loạt
Có 2 nơi test:

```text
/admin/dealers
/admin/reports
```

Test:

1. Bấm **Tải mẫu đại lý** ở `/admin/reports`.
2. Xóa thử cột **Mã đại lý** hoặc để trống mã đại lý.
3. Để **Trạng thái = APPROVED**.
4. Import file.
5. Kết quả đúng là hệ thống tự sinh mã đại lý và tạo/kích hoạt tài khoản đại lý.
6. Kiểm tra thông báo kết quả có dòng **Tạo tài khoản**.
7. Dùng SĐT đại lý import để đăng nhập vai trò **Đại lý**.

Nếu đại lý import có `APPROVED`, hệ thống tạo mật khẩu ban đầu và ghi vào Notification loại `DEALER_IMPORT_ACCOUNT`.

## 5) Test QR kích hoạt máy
Dùng tài khoản Đại lý hoặc KTV:

```text
0999000002 / Dealer@123456
0999000003 / Ktv@123456
```

Mở:

```text
/qr/TEST-MAY-0001
```

Test:

1. Chọn ô đầu tiên **Kích hoạt máy**.
2. Nhập chủ nhà, SĐT, địa chỉ.
3. Bấm lấy GPS hoặc nhập tọa độ.
4. Sang bước 2 nhập ngày lắp, tình trạng, ghi chú.
5. Hoàn thành.

## 6) Test bản đồ
Bản đồ không nhất thiết cần API nếu đang dùng OpenStreetMap.

Điều kiện để lên điểm:

- Máy hoặc đại lý phải có `lat`, `lng`.
- Dữ liệu seed test đã có tọa độ Hà Nội.
- Nếu chỉ nhập địa chỉ mà không nhập tọa độ, cần bật geocoding riêng.

Mở:

```text
/customer-map
/dealer-map
```

Nếu nền bản đồ hiện nhưng không có marker: kiểm tra dữ liệu có vĩ độ/kinh độ chưa.
Nếu nền bản đồ trắng: kiểm tra máy có vào được CDN Leaflet và tile OpenStreetMap không.

## 7) Những phần đã sửa trong patch này

- Import đại lý không còn bắt buộc mã đại lý; thiếu mã thì tự sinh.
- Import đại lý `APPROVED` tự tạo/kích hoạt tài khoản đại lý.
- Thêm thông báo số tài khoản đại lý đã tạo sau import.
- Mẫu tải xuống đổi sang `.xlsx` thật.
- Xuất máy/đại lý/chăm sóc đổi sang `.xlsx` thật, không còn `.xls` HTML giả.
- Cột xuất máy và đại lý khớp hơn với mẫu nhập.
- Thêm import đại lý ngay trong trang `/admin/dealers` để đối tác dễ thấy.
- Thêm seed test an toàn `npm run db:seed:test`.
