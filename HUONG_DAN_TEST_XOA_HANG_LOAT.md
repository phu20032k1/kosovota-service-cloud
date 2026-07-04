# Chức năng mới: xóa / duyệt / từ chối hàng loạt

## File cần đè vào project

1. `src/app/api/dealers/route.ts`
   - Thêm duyệt/từ chối/tạm khóa hàng loạt bằng `PATCH /api/dealers` với `dealerCodes`.
   - Thêm xóa đại lý bằng `DELETE /api/dealers` với `dealerCode` hoặc `dealerCodes`.
   - Khi xóa đại lý: giữ lịch sử dịch vụ, bỏ liên kết `dealerId`, vô hiệu hóa tài khoản đại lý/KTV, xóa kho và đợt thanh toán liên quan.

2. `src/app/api/machines/route.ts`
   - Thêm xóa máy bằng `DELETE /api/machines` với `machineId` hoặc `machineIds`.
   - Khi xóa máy: xóa kích hoạt, lịch bảo trì, SOS, ticket, báo cáo dịch vụ, lệnh dịch vụ, payment line và stock movement liên quan.

3. `src/app/admin/dealers/page.tsx`
   - Thêm checkbox chọn đại lý.
   - Thêm nút `Duyệt hàng loạt`, `Từ chối hàng loạt`, `Xóa hàng loạt`.
   - Thêm nút `Xóa` từng đại lý.

4. `src/app/admin/reports/page.tsx`
   - Thêm checkbox chọn máy trong danh sách máy.
   - Thêm nút `Xóa máy hàng loạt`.
   - Thêm nút `Xóa` từng máy.
   - Thêm `Duyệt tất cả` và `Từ chối tất cả` cho hồ sơ đại lý chờ duyệt ở dashboard.

## Cách test nhanh

1. Đè 4 file trên vào đúng đường dẫn.
2. Chạy:

```bash
npm install
npx prisma generate
npm run dev
```

3. Vào `/admin/dealers`:
   - Tick nhiều đại lý chờ duyệt → bấm `Duyệt hàng loạt`.
   - Tick nhiều đại lý → bấm `Từ chối hàng loạt`.
   - Tick nhiều đại lý → bấm `Xóa hàng loạt`.
   - Thử nút `Xóa` từng đại lý.

4. Vào `/admin/reports`:
   - Tick nhiều máy trong `Danh sách máy` → bấm `Xóa máy hàng loạt`.
   - Thử nút `Xóa` từng máy.
   - Trong `Hồ sơ đại lý chờ duyệt`, thử `Duyệt tất cả` / `Từ chối tất cả`.
