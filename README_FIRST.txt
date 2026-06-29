BẮT ĐẦU TỪ ĐÂY - KOSOVOTA

1. Đọc file HUONG_DAN_CHAY_THAT.md.
2. Muốn chạy thử Windows: mở PowerShell tại thư mục project và chạy:
   powershell -ExecutionPolicy Bypass -File .\CHAY_LOCAL_WINDOWS.ps1
3. Script sẽ tạo .env nếu chưa có. Hãy điền secret, số điện thoại và mật khẩu Admin của chính bạn.
4. Sau khi script hoàn tất, chạy: npm run dev
5. Đăng nhập tại: http://localhost:3000/login
6. Import file: data-import/File in seri.xlsx

Không đưa .env lên Git. Không dùng OTP cố định, SQLite hay lưu ảnh local khi chạy production.
