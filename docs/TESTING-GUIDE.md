# 🧪 Testing Cognito Authentication

Quick guide to test the Cognito authentication setup locally and on AWS.

## 🚀 Quick Start (Recommended)

### 1. Deploy to AWS Dev Environment

```powershell
# Run the automated deployment script
.\scripts\deploy-and-verify.ps1
```

This script will:
- ✅ Validate the SAM template
- ✅ Build the application
- ✅ Deploy to AWS
- ✅ Verify Cognito resources
- ✅ Generate frontend `.env` file automatically

### 2. Create Test Users

```powershell
# Create admin and customer test users
.\scripts\create-test-users.ps1
```

**Test Credentials Created:**
- **Admin:** admin@ecommerce.test / Admin@123456
- **Customer 1:** customer@ecommerce.test / Customer@123
- **Customer 2:** jane@ecommerce.test / Customer@456

### 3. Start Frontend

```powershell
cd frontend
npm install  # First time only
npm run dev
```

Navigate to: http://localhost:5173

### 4. Test Authentication Flow

1. **Sign Up** - Create a new account
2. **Verify Email** - Check console logs for verification code (if email not configured)
3. **Sign In** - Login with credentials
4. **Check Tokens** - Open DevTools → Application → Local Storage
5. **Test Protected Routes** - Access cart, orders, etc.

---

## 📋 Manual Testing Steps

### Verify Cognito in AWS Console

1. **Open Cognito Console:**
   ```
   https://console.aws.amazon.com/cognito/v2/home?region=us-east-1
   ```

2. **Check User Pool:**
   - Click on `dev-ecommerce-users`
   - Verify User Pool ID matches frontend config
   - Check "Users" tab for created users

3. **Check App Client:**
   - Go to "App integration" → "App clients"
   - Verify Client ID
   - Check enabled auth flows:
     - ✅ ALLOW_USER_PASSWORD_AUTH
     - ✅ ALLOW_REFRESH_TOKEN_AUTH
     - ✅ ALLOW_USER_SRP_AUTH

4. **Check Domain:**
   - Go to "App integration" → "Domain"
   - Should show: `dev-ecommerce-{account-id}`

5. **Check Groups:**
   - Go to "Groups" tab
   - Verify `Admins` and `Customers` groups exist

### Test API Authentication

```powershell
# Get your access token from localStorage in browser
$token = "YOUR_ACCESS_TOKEN_HERE"
$apiEndpoint = "YOUR_API_ENDPOINT"

# Test protected endpoint (cart)
curl "$apiEndpoint/cart" `
  -H "Authorization: Bearer $token" `
  -H "Content-Type: application/json"

# Should return your cart (empty if new user)
```

### Test Admin Access

```powershell
# Login as admin user
# Get admin access token
$adminToken = "ADMIN_ACCESS_TOKEN"

# Test admin-only endpoint (create product)
$body = @{
    name = "Test Product"
    description = "Testing admin access"
    price = 99.99
    category = "test"
    stock = 100
} | ConvertTo-Json

curl "$apiEndpoint/products" `
  -X POST `
  -H "Authorization: Bearer $adminToken" `
  -H "Content-Type: application/json" `
  -d $body
```

---

## 🐛 Troubleshooting

### Issue: "Stack not found"
```powershell
# Check if stack exists
aws cloudformation describe-stacks --stack-name dev-ecommerce-stack

# If not found, deploy first:
.\scripts\deploy-and-verify.ps1
```

### Issue: "Invalid User Pool ID"
```powershell
# Get the correct User Pool ID
aws cloudformation describe-stacks `
  --stack-name dev-ecommerce-stack `
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
  --output text

# Update frontend/.env with correct value
```

### Issue: "CORS Error"
- The template already has CORS configured
- Verify API endpoint in frontend/.env is correct
- Check browser console for specific CORS error

### Issue: "Token Expired"
- Tokens expire after 1 hour by default
- Call `refreshSession()` from AuthProvider
- Or sign out and sign in again

### Issue: "Unauthorized (401)"
- Verify token is in Authorization header: `Bearer {token}`
- Check token hasn't expired (decode at jwt.io)
- Ensure user exists and is in correct group

### Issue: "Docker not running" (SAM Local)
- Start Docker Desktop
- Wait for Docker to fully start
- Run: `docker info` to verify

---

## 🔧 Advanced Testing

### Test Token Refresh

```javascript
// In browser console (after login)
const { refreshSession } = useAuth();
await refreshSession();
console.log('Token refreshed:', localStorage.getItem('accessToken'));
```

### Test Password Change

```javascript
const { changePassword } = useAuth();
await changePassword('OldPassword@123', 'NewPassword@456');
```

### Test Forgot Password Flow

```javascript
const { forgotPassword, confirmPassword } = useAuth();

// Step 1: Request reset code
await forgotPassword('user@example.com');

// Step 2: Check email for code and reset
await confirmPassword('user@example.com', '123456', 'NewPassword@789');
```

### Decode JWT Token

```powershell
# Get token from localStorage
$token = "YOUR_ID_TOKEN"

# Copy and paste token to: https://jwt.io
# Or use PowerShell:
$payload = $token.Split('.')[1]
$decoded = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($payload + "=="))
$decoded | ConvertFrom-Json | ConvertTo-Json
```

---

## 🧹 Cleanup

### Delete Test Users

```powershell
$userPoolId = "us-east-1_XXXXXXXXX"

# Delete specific user
aws cognito-idp admin-delete-user `
  --user-pool-id $userPoolId `
  --username "user@example.com"

# List all users
aws cognito-idp list-users --user-pool-id $userPoolId
```

### Delete Stack (Complete Cleanup)

```powershell
# Delete CloudFormation stack
aws cloudformation delete-stack --stack-name dev-ecommerce-stack

# Wait for deletion
aws cloudformation wait stack-delete-complete --stack-name dev-ecommerce-stack
```

---

## 📚 Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [amazon-cognito-identity-js](https://github.com/aws-amplify/amplify-js/tree/main/packages/amazon-cognito-identity-js)
- [SAM CLI Reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-sam-cli-command-reference.html)
- [JWT.io Token Decoder](https://jwt.io)

---

## ✅ Testing Checklist

- [ ] SAM template validates successfully
- [ ] Application builds without errors
- [ ] Stack deploys to AWS successfully
- [ ] User Pool created in Cognito
- [ ] User Pool Client created
- [ ] Domain configured
- [ ] Admin and Customer groups created
- [ ] Test users created successfully
- [ ] Frontend connects to Cognito
- [ ] User registration works
- [ ] Email verification works (or skipped)
- [ ] User login works
- [ ] Tokens stored in localStorage
- [ ] Protected API endpoints require auth
- [ ] Admin users can access admin endpoints
- [ ] Regular users cannot access admin endpoints
- [ ] Token refresh works
- [ ] Logout clears tokens
- [ ] Password reset flow works

---

## 🎯 Next Steps

After successful testing:

1. **Configure Email Sending:**
   - Set up SES for production emails
   - Configure Cognito to use SES

2. **Enable MFA:**
   - Add MFA configuration to User Pool
   - Update frontend to handle MFA flow

3. **Add Social Login:**
   - Configure Google/Facebook identity providers
   - Update frontend for social auth buttons

4. **Set Up CI/CD:**
   - Create GitHub Actions workflow
   - Automate testing and deployment

5. **Monitor and Logs:**
   - Set up CloudWatch dashboards
   - Configure alarms for auth failures
