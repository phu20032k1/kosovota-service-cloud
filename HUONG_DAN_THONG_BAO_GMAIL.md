# HƯỚNG DẪN THÔNG BÁO GMAIL / SMS / ZALO KOSO VOTA

## 1. Cài thư viện

```bash
npm install
```

Nếu máy chưa có nodemailer thì chạy thêm:

```bash
npm install nodemailer
npm install -D @types/nodemailer
```

## 2. Cấu hình `.env`

Thêm hoặc kiểm tra các dòng này:

```env
GMAIL_USER="email_gui_thong_bao@gmail.com"
GMAIL_APP_PASSWORD="mat_khau_ung_dung_16_ky_tu"
EMAIL_FROM="KOSO VOTA <email_gui_thong_bao@gmail.com>"

# true = chỉ mô phỏng, không gửi thật
# false = gửi Gmail/SMS/Zalo thật
NOTIFICATION_DRY_RUN="false"
```

Sau khi sửa `.env`, tắt server rồi chạy lại:

```bash
npm run dev
```

## 3. Cập nhật database

Schema đã có sẵn các trường email cho User, Customer, Dealer và Notification.
Chạy:

```bash
npx prisma generate
npx prisma db push
```

## 4. Test Gmail

Cách 1: test bằng script:

```bash
npm run test:email -- your-email@gmail.com
```

Cách 2: test bằng giao diện:

```txt
Admin → Tích hợp dịch vụ → nhập email → Test Gmail
```

## 5. Test luồng thật không dùng Postman

### A. Kích hoạt máy

```txt
Đại lý/KTV đăng nhập
→ Quét QR / Kích hoạt máy
→ Nhập tên, SĐT và Email khách hàng
→ Hoàn tất kích hoạt
→ Vào Admin → Trung tâm thông báo
→ Bấm “Gửi hàng đợi”
→ Gmail khách nhận email kích hoạt
```

### B. SOS

```txt
Khách bấm SOS
→ Hệ thống queue SMS + Email cho khách
→ Hệ thống queue Email cho Admin/CSKH
→ Admin → Trung tâm thông báo → Gửi hàng đợi
```

### C. Lệnh dịch vụ

```txt
Admin/CSKH tạo lệnh hoặc tạo từ lịch bảo trì
→ Khách nhận email thông tin lệnh
→ Giao đại lý → đại lý nhận Zalo + Gmail nếu có email
→ Đại lý giao KTV → KTV nhận Gmail nếu có email
→ KTV cập nhật trạng thái / hoàn thành → khách nhận Gmail cập nhật
```

### D. Gửi Gmail hàng loạt

```txt
Admin → Trung tâm thông báo
→ Gửi Gmail hàng loạt
→ Chọn: tất cả khách / tất cả đại lý / tất cả nhân sự / tất cả của tất cả
→ Nhập tiêu đề + nội dung
→ Tạo email cho tất cả
→ Bấm Gửi hàng đợi
```

### E. Nhắc lịch bảo trì

```txt
Admin → Trung tâm thông báo
→ Bấm “Tạo nhắc lịch 7 ngày”
→ Hệ thống tạo email cho lịch bảo trì sắp đến hạn
→ Bấm Gửi hàng đợi
```

## 6. Những file đã sửa/thêm chính

```txt
package.json
.env.example
.env.production.example
scripts/test-email.ts
scripts/check-production-env.mjs
src/lib/email.ts
src/lib/notifications/providers.ts
src/lib/notifications/events.ts
src/lib/notifications/broadcast.ts
src/app/admin/notifications/page.tsx
src/app/admin/integrations/page.tsx
src/app/api/admin/integrations/route.ts
src/app/api/admin/integrations/test/route.ts
src/app/api/notifications/route.ts
src/app/api/notifications/process/route.ts
src/app/api/notifications/broadcast/route.ts
src/app/api/notifications/maintenance-reminders/route.ts
src/app/api/activations/route.ts
src/app/activate/[machineId]/step-1/page.tsx
src/app/api/sos-tickets/route.ts
src/app/api/service-orders/route.ts
src/app/api/service-orders/from-schedule/route.ts
src/app/api/service-orders/assign-dealer/route.ts
src/app/api/service-orders/[id]/assign-technician/route.ts
src/app/api/service-orders/[id]/route.ts
src/app/api/service-orders/[id]/report/route.ts
```

## 7. Lưu ý chống vào spam

- Không gửi hàng loạt quá nhanh bằng Gmail cá nhân.
- Nên dùng email domain riêng khi chạy thật, ví dụ `notification@kosovota.vn`.
- Nếu dùng domain riêng cần cấu hình SPF/DKIM/DMARC.
- Nội dung nên rõ ràng, không dùng quá nhiều emoji, chữ in hoa, từ khóa quảng cáo.
