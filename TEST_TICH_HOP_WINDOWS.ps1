$ErrorActionPreference = "Stop"
Write-Host "KOSOVOTA V19 - KIEM TRA TICH HOP" -ForegroundColor Green
Write-Host "1. Test Neon"
npm run test:db
Write-Host "2. Test R2"
npm run test:r2
Write-Host "3. Test Map"
npm run test:map
Write-Host "4. Kiem tra cau hinh production"
npm run check:production
Write-Host "SMS/Zalo co the gui that. Hay test trong Admin -> Tich hop sau khi dien dung so dien thoai." -ForegroundColor Yellow
