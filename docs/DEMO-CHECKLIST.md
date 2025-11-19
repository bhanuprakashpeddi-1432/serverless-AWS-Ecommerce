# Demo Checklist

Use this quick checklist to ensure a smooth 5‑minute demo.

Environment & Access
- [ ] AWS account access confirmed; region set (e.g., `us-east-1`).
- [ ] GitHub repo access confirmed; Actions enabled.
- [ ] IAM OIDC role configured; secrets set: `AWS_ROLE_ARN`, `AWS_ACCOUNT_ID`.

Deployment State
- [ ] Backend stack deployed (e.g., `dev-ecommerce-stack`).
- [ ] CloudFormation outputs noted: `ApiEndpoint`, `UserPoolId`, `UserPoolClientId`, `CloudFrontUrl`.
- [ ] Frontend deployed to S3/CloudFront; URL opens home page.

Frontend Config
- [ ] `.env` or workflow‑injected envs include:
  - `VITE_API_BASE_URL`
  - `VITE_COGNITO_USER_POOL_ID`
  - `VITE_COGNITO_CLIENT_ID`
  - `VITE_COGNITO_REGION`
- [ ] Local fallback ready (optional): `npm run dev` works with `.env.local` if needed.

Test Data
- [ ] At least 3 products exist for browsing.
- [ ] Optional: Screenshot thumbnails load (image URLs valid/public).
- [ ] Cart/checkout smoke‑tested once (blank browser profile ok).

Auth & Roles
- [ ] Signup flow confirmed (email verification on/off understood).
- [ ] A user pre‑added to `Admins` group for admin CRUD demo.
- [ ] Backup: regular user credentials ready if live signup fails.

Walkthrough Props
- [ ] Browser tabs staged: Home, Cart, Checkout, Orders/Profile, Admin, GitHub Actions.
- [ ] AWS Console tabs (optional): CloudFormation stack outputs, Step Functions (for runs), CloudWatch dashboard.

CI/CD
- [ ] `.github/workflows/deploy-frontend.yml` present.
- [ ] `.github/workflows/deploy-backend.yml` present.
- [ ] A tiny, safe UI change prepped on `dev` branch (e.g., text).
- [ ] Permissions allow manual “Run workflow” in Actions.

Recovery / Contingency
- [ ] Hard refresh shortcut known (Ctrl+Shift+R) for cache.
- [ ] PowerShell commands on hand to fetch outputs and test `/products`.
- [ ] If admin CRUD fails, have Postman call ready for create/update/delete.

PowerShell Quick Ref
```powershell
# Outputs
$STACK = "dev-ecommerce-stack"
aws cloudformation describe-stacks --stack-name $STACK --query "Stacks[0].Outputs" --output table

# Products smoke test
$API = aws cloudformation describe-stacks --stack-name $STACK `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
  --output text
curl "$API/products"

# Trigger Frontend workflow (requires gh auth)
gh workflow run .github/workflows/deploy-frontend.yml --ref dev
```