# Testing GetProducts Function - Node.js Version

## Prerequisites
1. AWS SAM CLI installed
2. Docker installed and running
3. Node.js 18.x runtime available

## Option 1: Test Individual Function with Event File

### Step 1: Set environment variables for local testing
```powershell
$env:PRODUCTS_TABLE = "dev-ecommerce-products"
```

### Step 2: Invoke function with test event
```powershell
# From project root
sam local invoke GetProductsFunction --event events/get-products.json
```

### Test with pagination
Create `events/get-products-paginated.json`:
```json
{
  "httpMethod": "GET",
  "path": "/products",
  "queryStringParameters": {
    "limit": "5",
    "lastKey": "encoded-key-here"
  },
  "headers": {
    "Content-Type": "application/json"
  },
  "body": null
}
```

## Option 2: Start Local API Gateway

### Step 1: Start local API
```powershell
sam local start-api --port 3001
```

### Step 2: Test endpoints
```powershell
# Get all products (default limit 20)
curl http://localhost:3001/products

# Get with custom limit
curl "http://localhost:3001/products?limit=10"

# Get with pagination
curl "http://localhost:3001/products?limit=10&lastKey=<encoded-key>"
```

## Frontend Testing

### Step 1: Update environment variables
Create `.env.local` in frontend directory:
```
VITE_API_BASE_URL=http://localhost:3001
```

### Step 2: Install dependencies and run
```powershell
cd frontend
npm install
npm run dev
```

### Step 3: Verify in browser
- Open http://localhost:5173
- Check product listing page
- Verify pagination controls
- Check browser console for API calls

## Troubleshooting

### Docker Issues
```powershell
# Verify Docker is running
docker ps

# Restart Docker Desktop if needed
```

### Port Conflicts
```powershell
# Check if port 3001 is in use
netstat -ano | findstr :3001

# Kill process if needed
Stop-Process -Id <PID> -Force
```

### DynamoDB Local (Optional)
If testing without AWS credentials:
```powershell
# Install DynamoDB Local
npm install -g dynamodb-local

# Start DynamoDB Local
dynamodb-local --port 8000

# Update function to use local endpoint
$env:AWS_SAM_LOCAL = "true"
```
