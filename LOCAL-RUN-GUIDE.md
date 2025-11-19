# Local Run Guide - Complete Setup

This guide shows you how to run the complete serverless e-commerce application locally for your demo.

## Current Status

✅ **Payment Secret Created**: `ecommerce/payment` in Secrets Manager  
✅ **Failed Stack Removed**: Old ROLLBACK_COMPLETE stack deleted  
🔄 **Backend Deploying**: SAM deployment in progress...  
⏳ **Waiting for**: CloudFormation stack outputs

## What's Running

The `deploy-and-verify.ps1` script is currently:
1. ✅ Validating SAM template
2. ✅ Building Lambda functions
3. 🔄 Deploying to AWS (5-10 minutes)
   - DynamoDB tables
   - Lambda functions
   - API Gateway
   - Cognito User Pool
   - S3 buckets
   - CloudFront distribution
   - Step Functions

## Next Steps (After Deployment Completes)

### 1. Verify Deployment Success

Check the terminal output for:
```
[OK] Deployment completed successfully
[OK] Frontend config saved to: frontend\.env
```

The script automatically writes `frontend\.env` with:
- `VITE_API_BASE_URL`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_COGNITO_REGION`

### 2. Clean Up Any Override Files

```powershell
Remove-Item -Force ".\frontend\.env.local" -ErrorAction SilentlyContinue
```

### 3. Start the Frontend

```powershell
cd ".\frontend"
npm install
npm run dev
```

### 4. Open Your Browser

Navigate to: `http://localhost:5173`

## Demo Flow (5 minutes)

### 0:00-1:00 — Signup & Login
1. Click **Sign Up**
2. Register: `demo@example.com` (use any password meeting requirements)
3. If email verification is enabled, check your email for code
4. Sign in with your credentials

### 1:00-2:00 — Browse & Add to Cart
1. Browse products on home page
2. Click a product to see details
3. Click **Add to Cart**
4. Open Cart page
5. Adjust quantities

### 2:00-3:00 — Checkout (Success)
1. Navigate to Checkout
2. Fill in:
   - Email: (auto-filled)
   - Address: any test values
   - **Card**: `4242 4242 4242 4242`
   - **Expiry**: `12/34`
   - **CVV**: `123`
3. Click **Place Order**
4. See success message

### 3:00-4:00 — View Orders
1. Go to Profile → Orders (or Orders page)
2. See your completed order with total and status

### 4:00-5:00 — Admin Product CRUD
First, make your user an admin:
```powershell
$REGION = "us-east-1"
$STACK = "dev-ecommerce-stack"
$POOL = aws cloudformation describe-stacks --stack-name $STACK --region $REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text

aws cognito-idp admin-add-user-to-group --user-pool-id $POOL --username demo@example.com --group-name Admins
```

Then:
1. Sign out and sign back in (to refresh JWT groups)
2. Navigate to `/admin`
3. **Create**: Add a new product
4. **Update**: Edit an existing product
5. **Delete**: Remove a product
6. Verify changes appear in the catalog

## Troubleshooting

### Issue: Deployment Still Running
**Solution**: Wait for CloudFormation. Check AWS Console → CloudFormation → `dev-ecommerce-stack` for progress.

### Issue: `frontend\.env` is Empty or Has PowerShell Code
**Solution**: 
```powershell
$REGION = "us-east-1"
$STACK = "dev-ecommerce-stack"
$API = aws cloudformation describe-stacks --stack-name $STACK --region $REGION --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
$POOL = aws cloudformation describe-stacks --stack-name $STACK --region $REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
$CLIENT = aws cloudformation describe-stacks --stack-name $STACK --region $REGION --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text

@"
VITE_API_BASE_URL=$API
VITE_COGNITO_USER_POOL_ID=$POOL
VITE_COGNITO_CLIENT_ID=$CLIENT
VITE_COGNITO_REGION=$REGION
"@ | Set-Content -Path "frontend\.env" -Encoding UTF8
```

### Issue: 401 Unauthorized on Protected Endpoints
**Solution**: 
- Sign out and sign in again
- Check that access token is in localStorage
- For admin endpoints, ensure user is in `Admins` group

### Issue: No Products to Browse
**Solution**: Use the admin UI to create test products, or run:
```powershell
# Create a test product via API
$STACK = "dev-ecommerce-stack"
$API = aws cloudformation describe-stacks --stack-name $STACK --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
$TOKEN = "YOUR_ACCESS_TOKEN_HERE"  # Get from localStorage after login

$body = @{
  name = "Demo Product"
  description = "Test product for demo"
  price = 29.99
  category = "Electronics"
  imageUrl = "https://via.placeholder.com/300"
  stock = 100
} | ConvertTo-Json

Invoke-WebRequest -Uri "$API/products" -Method POST -Headers @{Authorization="Bearer $TOKEN"} -Body $body -ContentType "application/json"
```

### Issue: Frontend Shows "Cognito not configured"
**Solution**: Ensure `frontend\.env` has valid values (not empty, not PowerShell code).

### Issue: CloudFront Distribution Taking Long
**Solution**: CloudFront distributions take 15-20 minutes to fully deploy. The frontend can work without it using S3 directly, but for production you'll want CloudFront.

## Quick Commands Reference

```powershell
# Check deployment status
$STACK = "dev-ecommerce-stack"
aws cloudformation describe-stacks --stack-name $STACK --region us-east-1 --query "Stacks[0].StackStatus" --output text

# Get all stack outputs
aws cloudformation describe-stacks --stack-name $STACK --region us-east-1 --query "Stacks[0].Outputs" --output table

# Test API endpoint (public)
$API = aws cloudformation describe-stacks --stack-name $STACK --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
curl "$API/products"

# Add user to Admins group
$POOL = aws cloudformation describe-stacks --stack-name $STACK --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
aws cognito-idp admin-add-user-to-group --user-pool-id $POOL --username YOUR_EMAIL --group-name Admins

# Restart frontend
cd frontend
npm run dev
```

## Architecture Overview

**Frontend (Local)**: React + Vite → `http://localhost:5173`  
**Backend (AWS)**:
- API Gateway HTTP API with JWT authorizer
- Lambda functions (Python 3.11)
- DynamoDB tables (pay-per-request)
- Cognito User Pool (auth)
- Step Functions (order processing)
- S3 + CloudFront (production frontend hosting)

## What Happens During Checkout

1. User submits order → `POST /checkout/start`
2. Lambda creates order in DynamoDB
3. Step Functions workflow starts:
   - **Validate Inventory**: Check stock availability
   - **Process Payment**: Simulate payment (test mode)
   - **Update Inventory**: Decrement stock
   - **Send Confirmation**: Email notification (if SES configured)

## Cost Estimate (Dev Environment)

- Lambda: ~$1-2/month (1M free requests)
- DynamoDB: ~$1-2/month (on-demand)
- API Gateway: ~$3.50/month (1M free requests)
- S3: ~$1/month (5GB free)
- Cognito: FREE (under 50K MAU)
- CloudFront: ~$0-5/month (1TB free data transfer first 12 months)

**Total**: ~$5-15/month for low-traffic dev environment

## Ready for Production?

- [ ] Custom domain with ACM certificate
- [ ] WAF rules tuned for your traffic
- [ ] CloudWatch alarms + SNS notifications
- [ ] SES email identity verified
- [ ] Secrets Manager production payment key
- [ ] CI/CD pipeline configured (GitHub Actions)
- [ ] Load testing completed
- [ ] Security review done

---

**Questions?** Check the demo script in `docs/DEMO-SCRIPT.md` or the deployment guide in `SAM-DEPLOYMENT.md`.
