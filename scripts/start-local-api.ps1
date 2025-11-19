# Start SAM Local API for Testing
# Runs the API Gateway locally with hot-reloading

param(
    [int]$Port = 3001,
    [switch]$WarmContainers,
    [switch]$Debug
)

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Starting SAM Local API" -ForegroundColor Cyan
Write-Host "  Port: $Port" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
Write-Host "Checking Docker..." -ForegroundColor Yellow
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Docker is running" -ForegroundColor Green
Write-Host ""

# Build first
Write-Host "Building SAM application..." -ForegroundColor Yellow
sam build --parallel
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Build completed" -ForegroundColor Green
Write-Host ""

# Prepare command
$command = "sam local start-api --port $Port"

if ($WarmContainers) {
    $command += " --warm-containers EAGER"
}

if ($Debug) {
    $command += " --debug"
}

Write-Host "Starting local API..." -ForegroundColor Yellow
Write-Host "Command: $command" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Note: Cognito authentication won't work locally!" -ForegroundColor Yellow
Write-Host "For full auth testing, deploy to AWS using: .\scripts\deploy-and-verify.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "API will be available at: http://localhost:$Port" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test endpoints:" -ForegroundColor Yellow
Write-Host "  GET  http://localhost:$Port/products" -ForegroundColor White
Write-Host "  GET  http://localhost:$Port/products/{id}" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Gray
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Start the API
Invoke-Expression $command
