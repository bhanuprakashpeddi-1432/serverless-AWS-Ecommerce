# Complete Testing Guide for Node.js GetProducts Handler

## Current Status
✅ Created `getProducts.js` Node.js Lambda handler
✅ Created `package.json` with AWS SDK v3 dependencies
✅ Created test event file `events/get-products.json`
✅ Created frontend `.env.local` configuration
❌ Docker is not running (required for SAM Local)

## Step-by-Step Testing Instructions

### Phase 1: Start Docker (Required for SAM Local)

1. **Start Docker Desktop**
   - Open Docker Desktop application
   - Wait for Docker to fully start (watch for "Docker Desktop is running" status)
   - Verify: Run `docker ps` in terminal (should not show errors)

### Phase 2: Test Lambda Function Locally

#### Option A: Test with SAM Local API (Recommended)

```powershell
# 1. Navigate to project root
cd "a:\GitHub Repo\Capstone-project\serverless-ecom-capstone"

# 2. Start local API (runs in background)
sam local start-api --port 3001
```

Wait for output: `Mounting GetProductsFunction at http://127.0.0.1:3001/products [GET]`

```powershell
# 3. In a NEW terminal, test the endpoint
curl http://localhost:3001/products

# Or with parameters
curl "http://localhost:3001/products?limit=10"
```

#### Option B: Test with Event File

```powershell
# Set environment variable
$env:PRODUCTS_TABLE = "dev-ecommerce-products"

# Invoke function
sam local invoke GetProductsFunction --event events/get-products.json
```

### Phase 3: Start Frontend Development Server

```powershell
# 1. Open NEW terminal
cd "a:\GitHub Repo\Capstone-project\serverless-ecom-capstone\frontend"

# 2. Install dependencies (if not already done)
npm install

# 3. Start development server
npm run dev
```

Expected output: `Local: http://localhost:5173/`

### Phase 4: Verify Integration

1. **Open browser** to `http://localhost:5173`
2. **Navigate to Products page**
3. **Open Developer Tools** (F12)
4. **Check Console tab** for API calls
5. **Check Network tab** for requests to `http://localhost:3001/products`

### Expected Results

#### Backend Response (from SAM Local):
```json
{
  "items": [...],
  "count": 10,
  "scannedCount": 10,
  "lastKey": "encoded-pagination-key"
}
```

#### Frontend Behavior:
- Products display in grid layout
- Pagination controls appear if more items exist
- Loading states during API calls
- Error messages if API is unreachable

## Troubleshooting

### Issue: SAM Local Not Starting

**Solution 1: Check template.yaml**
The template currently uses Python runtime. To use Node.js handler:

```powershell
# Temporary: Test without modifying template
sam local invoke -t events/get-products.json --parameter-overrides 'Runtime=nodejs18.x Handler=getProducts.handler'
```

**Solution 2: Update template.yaml**
See `NODEJS-TEMPLATE-UPDATE.md` for template changes

### Issue: DynamoDB Table Not Found

**Error**: `PRODUCTS_TABLE environment variable is not set`

**Solution**:
```powershell
# Set environment variable before starting
$env:PRODUCTS_TABLE = "dev-ecommerce-products"
sam local start-api --port 3001 --env-vars env.json
```

Create `env.json`:
```json
{
  "GetProductsFunction": {
    "PRODUCTS_TABLE": "dev-ecommerce-products"
  }
}
```

### Issue: Table Doesn't Exist in AWS

**Solution**: Deploy stack first or use DynamoDB Local

```powershell
# Deploy stack
sam build
sam deploy --guided

# OR use DynamoDB Local for offline testing
docker run -p 8000:8000 amazon/dynamodb-local
```

### Issue: Frontend Can't Connect to API

**Check**:
1. SAM Local is running on port 3001
2. `.env.local` has correct `VITE_API_BASE_URL=http://localhost:3001`
3. No CORS errors in browser console
4. API responds to curl test

### Issue: Port Already in Use

```powershell
# Find process using port 3001
netstat -ano | findstr :3001

# Kill the process
Stop-Process -Id <PID> -Force

# Or use different port
sam local start-api --port 3002
# Then update .env.local: VITE_API_BASE_URL=http://localhost:3002
```

## Alternative: Test Without SAM Local

If you can't run SAM Local, deploy to AWS and test:

```powershell
# Build and deploy
sam build
sam deploy

# Get API endpoint from outputs
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text

# Update frontend .env.local with real API endpoint
# VITE_API_BASE_URL=https://your-api-id.execute-api.region.amazonaws.com
```

## Testing Checklist

- [ ] Docker Desktop is running
- [ ] SAM Local API started successfully
- [ ] Can curl `http://localhost:3001/products` 
- [ ] Frontend installed dependencies (`npm install`)
- [ ] Frontend `.env.local` configured
- [ ] Frontend dev server running (`npm run dev`)
- [ ] Browser shows products page
- [ ] Network tab shows successful API calls
- [ ] Pagination works (if multiple pages exist)
- [ ] Error handling works (try stopping backend)

## Next Steps After Testing

1. **If working**: Commit the Node.js handler and update template.yaml
2. **Add to template**: Update `GetProductsFunction` to use Node.js runtime
3. **Deploy**: `sam build && sam deploy`
4. **Update frontend**: Point to production API endpoint
5. **Add tests**: Create unit tests for handler
6. **Add sample data**: Populate DynamoDB with test products

## Quick Test Script

Save as `test-local.ps1`:
```powershell
# Quick test script
Write-Host "Testing GetProducts Handler" -ForegroundColor Cyan

# Check Docker
Write-Host "`n1. Checking Docker..." -ForegroundColor Yellow
docker ps | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "   ❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}
Write-Host "   ✅ Docker is running" -ForegroundColor Green

# Test API endpoint
Write-Host "`n2. Testing API endpoint..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "http://localhost:3001/products?limit=5" -Method GET
if ($response.StatusCode -eq 200) {
    Write-Host "   ✅ API is responding" -ForegroundColor Green
    $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 5
} else {
    Write-Host "   ❌ API returned status: $($response.StatusCode)" -ForegroundColor Red
}
```

Run with: `.\test-local.ps1`
