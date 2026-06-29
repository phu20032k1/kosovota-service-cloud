$ErrorActionPreference = "Continue"
Write-Host "=== KOSOVOTA - KIEM TRA HE THONG ===" -ForegroundColor Green
npm run db:generate
npm run test:db
npm run lint
npm run typecheck
npm run build
Write-Host "Mo http://localhost:3000/api/health sau khi npm run dev de kiem tra live." -ForegroundColor Cyan
