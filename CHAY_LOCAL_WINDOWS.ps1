$ErrorActionPreference = "Stop"

Write-Host "=== KOSOVOTA - CAI DAT VA CHAY LAN DAU ===" -ForegroundColor Green

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Chua co Node.js. Hay cai Node.js 22 LTS roi chay lai." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Da tao .env. Hay dien DATABASE_URL Neon, R2 va tai khoan seed." -ForegroundColor Yellow
  notepad .env
  exit 0
}

Write-Host "[1/6] Cai package..." -ForegroundColor Cyan
npm install

Write-Host "[2/6] Tao Prisma Client..." -ForegroundColor Cyan
npm run db:generate

Write-Host "[3/6] Dong bo schema voi Neon..." -ForegroundColor Cyan
npm run db:push

Write-Host "[4/6] Tao/cap nhat Super Admin va Admin goc..." -ForegroundColor Cyan
npm run db:seed

Write-Host "[5/6] Kiem tra ket noi database..." -ForegroundColor Cyan
npm run test:db

Write-Host "[6/6] Kiem tra Cloudflare R2..." -ForegroundColor Cyan
$envText = Get-Content ".env" -Raw
if ($envText -match 'R2_PUBLIC_BASE_URL="?https://') {
  npm run test:r2
} else {
  Write-Host "BO QUA R2: R2_PUBLIC_BASE_URL dang trong. Dien Public Development URL hoac custom domain cua bucket roi chay npm run test:r2." -ForegroundColor Yellow
}

Write-Host "" 
Write-Host "HOAN TAT. Dang chay website tai http://localhost:3000" -ForegroundColor Green
npm run dev
