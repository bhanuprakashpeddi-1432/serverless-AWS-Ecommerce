# Cognito Testing Guide

## Prerequisites

1. AWS CLI configured with credentials
2. SAM CLI installed
3. Docker installed (for local testing)
4. Node.js and npm installed

## Option 1: Deploy to AWS Dev Account (Recommended)

### Step 1: Validate SAM Template
```powershell
sam validate --lint
```

### Step 2: Build the Application
```powershell
sam build
```

### Step 3: Deploy to Dev Environment
```powershell
# First time deployment (guided)
sam deploy --guided --config-env default

# Or use existing config
sam deploy --config-env default
```

**Answer the prompts:**
- Stack Name: `dev-ecommerce-stack` (already configured)
- AWS Region: `us-east-1` (already configured)
- Parameter Environment: `dev`
- Confirm changes: Y
- Allow IAM role creation: Y
- Disable rollback: N (recommended)
- Save arguments to config file: Y

### Step 4: Get Deployment Outputs
```powershell
# Get stack outputs
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs" --output table

# Or get specific outputs
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='UserPoolDomain'].OutputValue" --output text
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
```

### Step 5: Verify in AWS Console

1. **Navigate to Cognito Console:**
   ```
   https://console.aws.amazon.com/cognito/v2/home?region=us-east-1
   ```

2. **Verify User Pool:**
   - Click on your user pool (e.g., `dev-ecommerce-users`)
   - Check "User pool properties" tab:
     - Pool ID
     - ARN
     - Attributes (email, given_name, family_name)
     - Password policies

3. **Verify App Client:**
   - Click "App integration" tab
   - Find "App clients and analytics"
   - Verify Client ID
   - Check authentication flows enabled:
     - ✅ ALLOW_USER_PASSWORD_AUTH
     - ✅ ALLOW_REFRESH_TOKEN_AUTH
     - ✅ ALLOW_USER_SRP_AUTH

4. **Verify Domain:**
   - Click "App integration" tab
   - Find "Domain" section
   - Should see: `dev-ecommerce-{account-id}.auth.us-east-1.amazoncognito.com`

5. **Verify Groups:**
   - Click "Groups" tab
   - Should see:
     - `Admins` (Precedence: 1)
     - `Customers` (Precedence: 10)

### Step 6: Configure Frontend Environment

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=https://{api-id}.execute-api.us-east-1.amazonaws.com
VITE_COGNITO_USER_POOL_ID={user-pool-id}
VITE_COGNITO_CLIENT_ID={client-id}
VITE_COGNITO_REGION=us-east-1
```

Replace placeholders with actual values from step 4.

### Step 7: Test User Registration

#### Via AWS Console:
1. Go to Cognito User Pool → Users
2. Click "Create user"
3. Fill in:
   - Username (email)
   - Email address
   - Temporary password
   - Uncheck "Mark email as verified" if testing verification flow

#### Via Frontend:
1. Start the frontend:
   ```powershell
   cd frontend
   npm run dev
   ```
2. Navigate to signup page
3. Register a new user
4. Check email for verification code
5. Verify email with code

### Step 8: Test Authentication Flow

1. **Sign In:**
   - Use registered email and password
   - Check browser localStorage for tokens:
     - `accessToken`
     - `idToken`
     - `refreshToken`

2. **Verify Token in Console:**
   ```powershell
   # Decode JWT token (use jwt.io or):
   $token = "YOUR_ID_TOKEN_HERE"
   # Copy to https://jwt.io to decode and verify claims
   ```

3. **Test Protected API Endpoints:**
   ```powershell
   # Get access token from localStorage
   $accessToken = "YOUR_ACCESS_TOKEN"
   
   # Test cart endpoint
   curl -X GET "https://{api-id}.execute-api.us-east-1.amazonaws.com/cart" -H "Authorization: Bearer $accessToken"
   ```

### Step 9: Test Admin Group Assignment

1. Go to Cognito Console → Your User Pool → Users
2. Select a user
3. Click "Add user to group"
4. Select "Admins" group
5. Sign out and sign in again in frontend
6. Verify `user.isAdmin === true` in React DevTools

---

## Option 2: Local Testing with SAM Local

**Note:** SAM Local doesn't fully support Cognito authentication locally. You'll need to mock or skip auth for local testing.

### Step 1: Start Local API
```powershell
sam build
sam local start-api --port 3001 --warm-containers EAGER
```

### Step 2: Mock Cognito for Local Development

Create a local environment file `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_COGNITO_USER_POOL_ID=mock-pool-id
VITE_COGNITO_CLIENT_ID=mock-client-id
VITE_COGNITO_REGION=us-east-1
```

### Step 3: Modify Lambda Functions for Local Testing

Add environment variable check in Lambda handlers:

```python
import os

IS_LOCAL = os.environ.get('AWS_SAM_LOCAL') == 'true'

def handler(event, context):
    if IS_LOCAL:
        # Skip Cognito validation
        event['requestContext']['authorizer'] = {
            'claims': {
                'sub': 'test-user-id',
                'email': 'test@example.com'
            }
        }
    
    # Your handler logic
```

### Step 4: Test Endpoints Locally
```powershell
# Test public endpoints
curl http://localhost:3001/products

# Test protected endpoints (with mock auth)
curl http://localhost:3001/cart
```

---

## Option 3: Hybrid Approach (Recommended for Development)

Use **real Cognito** (deployed) with **local API**:

1. Deploy Cognito to AWS (just the auth stack)
2. Use those credentials in frontend
3. Run API locally with SAM
4. Configure CORS to allow localhost

### Deploy Auth-Only Stack

Create a minimal stack for Cognito:

```powershell
# Deploy only Cognito resources
sam deploy --parameter-overrides Environment=dev --no-execute-changeset
# Review and execute only Cognito-related changes
```

---

## Testing Checklist

### Cognito Setup
- [ ] User Pool created
- [ ] User Pool Client created
- [ ] Domain configured
- [ ] Groups created (Admins, Customers)
- [ ] Password policy configured

### Authentication Flow
- [ ] User registration works
- [ ] Email verification works
- [ ] User login works
- [ ] Tokens stored in localStorage
- [ ] Token refresh works
- [ ] Logout clears tokens

### Authorization
- [ ] Protected endpoints require authentication
- [ ] Unauthorized requests return 401
- [ ] Admin-only endpoints check group membership
- [ ] Regular users can't access admin endpoints

### API Integration
- [ ] Access token included in API requests
- [ ] API Gateway validates tokens
- [ ] User context passed to Lambda functions

---

## Troubleshooting

### Issue: "User pool not found"
**Solution:** Verify User Pool ID in environment variables matches deployed pool.

### Issue: "Invalid client ID"
**Solution:** Ensure Client ID matches the deployed app client.

### Issue: "Token expired"
**Solution:** Implement token refresh in frontend interceptor.

### Issue: "CORS error"
**Solution:** Check API Gateway CORS configuration in template.yaml.

### Issue: "Unauthorized" on protected endpoints
**Solution:** 
1. Check token in Authorization header: `Bearer {token}`
2. Verify token hasn't expired
3. Check API Gateway authorizer configuration

### Issue: "Password doesn't meet requirements"
**Solution:** Password must have:
- Minimum 8 characters
- Uppercase letter
- Lowercase letter
- Number
- Special character

---

## Quick Start Commands

```powershell
# Full deployment to AWS
sam validate --lint
sam build
sam deploy --config-env default

# Get outputs
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs" --output table

# Update frontend config
# Copy UserPoolId and ClientId to frontend/.env

# Start frontend
cd frontend
npm run dev

# Test in browser
# Navigate to http://localhost:5173
# Register and login
```

---

## Next Steps

1. Set up automated testing with Cognito
2. Implement MFA (Multi-Factor Authentication)
3. Configure social identity providers (Google, Facebook)
4. Set up Cognito triggers for custom logic
5. Implement advanced security features (risk-based authentication)
