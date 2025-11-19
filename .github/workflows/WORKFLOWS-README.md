# GitHub Actions Workflows Documentation

## Overview

This project uses GitHub Actions for automated CI/CD deployment to AWS. There are two main workflows:

1. **Backend Deployment** - Deploys SAM application (Lambda functions, API Gateway, DynamoDB, etc.)
2. **Frontend Deployment** - Builds React app and deploys to S3/CloudFront

## Workflows

### 1. Backend Deployment (`deploy-backend.yml`)

**Purpose**: Build and deploy the serverless backend using AWS SAM.

**Triggers**:
- Push to `main` or `dev` branches (when backend files change)
- Manual workflow dispatch (with environment selection)

**Steps**:
1. ✅ Checkout code
2. ✅ Set environment (dev/prod) based on branch
3. ✅ Setup Node.js 18 and Python 3.11
4. ✅ Setup AWS SAM CLI
5. ✅ Configure AWS credentials via OIDC
6. ✅ Validate SAM template
7. ✅ Install dependencies (Node.js + Python)
8. ✅ Run backend tests (if available)
9. ✅ SAM Build (with containers)
10. ✅ Create/verify S3 deployment bucket
11. ✅ SAM Package (upload to S3)
12. ✅ SAM Deploy (with parameters)
13. ✅ Get CloudFormation outputs
14. ✅ Test API health endpoint
15. ✅ Create deployment artifacts
16. ✅ Create GitHub deployment

**Deployment Bucket**: `{environment}-ecommerce-sam-deployments-{account-id}`

**Stack Naming**: `{environment}-ecommerce-stack`

**Parameters**:
- `Environment`: dev/prod (from branch or manual input)
- `Stage`: dev/prod (API Gateway stage)

**Tags Applied**:
- Environment
- Application
- ManagedBy: GitHubActions
- Repository
- Branch
- CommitSha

---

### 2. Frontend Deployment (`deploy-frontend.yml`)

**Purpose**: Build React application and deploy to S3 with CloudFront invalidation.

**Triggers**:
- Push to `main` or `dev` branches (when frontend files change)
- Manual workflow dispatch

**Steps**:
1. ✅ Checkout code
2. ✅ Set environment (dev/prod) based on branch
3. ✅ Setup Node.js 18
4. ✅ Configure AWS credentials via OIDC
5. ✅ Get CloudFormation outputs (API endpoint, Cognito, S3 bucket)
6. ✅ Install dependencies
7. ✅ Create `.env.production` file
8. ✅ Build frontend (`npm run build`)
9. ✅ Run tests (if available)
10. ✅ Sync to S3 bucket (with cache headers)
11. ✅ Create CloudFront invalidation
12. ✅ Wait for invalidation to complete
13. ✅ Create deployment artifact

**Environment Variables** (injected into build):
- `VITE_API_BASE_URL`
- `VITE_AWS_REGION`
- `VITE_COGNITO_USER_POOL_ID`
- `VITE_COGNITO_CLIENT_ID`
- `VITE_ENVIRONMENT`

**Cache Strategy**:
- Assets (`/assets/*`): `max-age=31536000,immutable` (1 year)
- Index.html: `max-age=0,must-revalidate` (no cache)

---

## Required Secrets

### GitHub Repository Secrets

You must configure these secrets in your GitHub repository settings:

#### 1. AWS_ROLE_ARN (Required)
**Purpose**: IAM role ARN for OIDC authentication from GitHub Actions.

**Format**: `arn:aws:iam::{account-id}:role/{role-name}`

**How to Create**:

```bash
# Create IAM OIDC provider for GitHub
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1

# Create IAM role with trust policy
cat > github-actions-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::{ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:{GITHUB_ORG}/{GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF

# Replace placeholders
sed -i "s/{ACCOUNT_ID}/$(aws sts get-caller-identity --query Account --output text)/g" github-actions-trust-policy.json
sed -i "s|{GITHUB_ORG}/{GITHUB_REPO}|YOUR_ORG/YOUR_REPO|g" github-actions-trust-policy.json

# Create role
aws iam create-role \
  --role-name GitHubActionsDeploymentRole \
  --assume-role-policy-document file://github-actions-trust-policy.json \
  --description "Role for GitHub Actions to deploy e-commerce application"

# Attach policies (choose based on your needs)
# Option 1: Administrator access (simplest, use for dev)
aws iam attach-role-policy \
  --role-name GitHubActionsDeploymentRole \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Option 2: Least privilege (recommended for production)
# Create custom policy with only required permissions
cat > github-actions-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudformation:*",
        "lambda:*",
        "apigateway:*",
        "dynamodb:*",
        "s3:*",
        "cloudfront:*",
        "cognito-idp:*",
        "states:*",
        "iam:CreateRole",
        "iam:DeleteRole",
        "iam:GetRole",
        "iam:PassRole",
        "iam:AttachRolePolicy",
        "iam:DetachRolePolicy",
        "iam:PutRolePolicy",
        "iam:DeleteRolePolicy",
        "iam:GetRolePolicy",
        "logs:*",
        "events:*",
        "secretsmanager:*",
        "wafv2:*"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name GitHubActionsDeploymentRole \
  --policy-name GitHubActionsDeploymentPolicy \
  --policy-document file://github-actions-policy.json

# Get role ARN
aws iam get-role \
  --role-name GitHubActionsDeploymentRole \
  --query Role.Arn \
  --output text
```

**PowerShell Version**:

```powershell
# Get account ID
$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text

# Create trust policy
$trustPolicy = @"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:YOUR_ORG/YOUR_REPO:*"
        }
      }
    }
  ]
}
"@

$trustPolicy | Out-File -FilePath github-actions-trust-policy.json -Encoding utf8

# Create role
aws iam create-role `
  --role-name GitHubActionsDeploymentRole `
  --assume-role-policy-document file://github-actions-trust-policy.json `
  --description "Role for GitHub Actions to deploy e-commerce application"

# Attach administrator policy (for dev)
aws iam attach-role-policy `
  --role-name GitHubActionsDeploymentRole `
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Get role ARN
aws iam get-role `
  --role-name GitHubActionsDeploymentRole `
  --query Role.Arn `
  --output text
```

#### 2. AWS_ACCOUNT_ID (Required for backend workflow)
**Purpose**: Used to name the SAM deployment bucket.

**Format**: `123456789012` (12-digit AWS account ID)

**How to Get**:
```bash
aws sts get-caller-identity --query Account --output text
```

---

## Setting Up GitHub Secrets

### Via GitHub UI

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret:
   - **Name**: `AWS_ROLE_ARN`
   - **Value**: `arn:aws:iam::123456789012:role/GitHubActionsDeploymentRole`
   - Click **Add secret**
5. Repeat for `AWS_ACCOUNT_ID`

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# https://cli.github.com/

# Authenticate
gh auth login

# Set secrets
gh secret set AWS_ROLE_ARN --body "arn:aws:iam::123456789012:role/GitHubActionsDeploymentRole"
gh secret set AWS_ACCOUNT_ID --body "123456789012"

# Verify secrets
gh secret list
```

---

## Workflow Usage

### Automatic Deployment

1. **Push to `dev` branch**:
```bash
git checkout dev
git add .
git commit -m "Update backend Lambda functions"
git push origin dev
```
- Triggers: `deploy-backend.yml` (if backend files changed)
- Deploys to: `dev-ecommerce-stack`

2. **Push to `main` branch**:
```bash
git checkout main
git merge dev
git push origin main
```
- Triggers: `deploy-backend.yml` and `deploy-frontend.yml`
- Deploys to: `prod-ecommerce-stack`

### Manual Deployment

**Via GitHub UI**:
1. Go to **Actions** tab
2. Select workflow (e.g., "Deploy Backend SAM Application")
3. Click **Run workflow**
4. Select branch and environment
5. Click **Run workflow**

**Via GitHub CLI**:
```bash
# Deploy backend to dev
gh workflow run deploy-backend.yml \
  --ref dev \
  --field environment=dev

# Deploy backend to prod
gh workflow run deploy-backend.yml \
  --ref main \
  --field environment=prod

# Deploy frontend to dev
gh workflow run deploy-frontend.yml \
  --ref dev
```

---

## Monitoring Deployments

### View Workflow Status

**GitHub UI**:
- Navigate to **Actions** tab
- Click on a workflow run to see details
- View logs for each step

**GitHub CLI**:
```bash
# List workflow runs
gh run list --workflow=deploy-backend.yml

# View specific run
gh run view <run-id>

# Watch run in real-time
gh run watch <run-id>
```

### View Deployment Artifacts

Each successful deployment creates artifacts:

**Backend Deployment Artifact** includes:
- `backend-outputs.json` - CloudFormation outputs
- `packaged.yaml` - Packaged SAM template
- `.aws-sam/build.toml` - Build metadata

**Frontend Deployment Artifact** includes:
- `deployment-info.json` - Deployment metadata

**Download Artifacts**:
```bash
# List artifacts
gh run view <run-id> --log

# Download artifact
gh run download <run-id>
```

---

## Deployment Outputs

### Backend Deployment Outputs

After successful backend deployment, the workflow outputs:

```json
{
  "environment": "dev",
  "stack_name": "dev-ecommerce-stack",
  "api_endpoint": "https://abc123def.execute-api.us-east-1.amazonaws.com",
  "user_pool_id": "us-east-1_ABC123DEF",
  "user_pool_client_id": "1abc2def3ghi4jkl5mno6pqr7s",
  "frontend_bucket": "dev-ecommerce-frontend-123456789012",
  "cloudfront_url": "https://d1234567890abc.cloudfront.net",
  "aws_region": "us-east-1",
  "deployed_at": "2025-11-18T10:30:45Z",
  "commit_sha": "abc123def456",
  "commit_message": "Update Lambda functions",
  "deployed_by": "github-username"
}
```

### Frontend Deployment Outputs

After successful frontend deployment:

```json
{
  "environment": "dev",
  "cloudfront_url": "https://d1234567890abc.cloudfront.net",
  "s3_bucket": "dev-ecommerce-frontend-123456789012",
  "distribution_id": "E1234567890ABC",
  "api_endpoint": "https://abc123def.execute-api.us-east-1.amazonaws.com",
  "deployed_at": "2025-11-18T10:35:22Z",
  "commit_sha": "abc123def456",
  "commit_message": "Update frontend components"
}
```

---

## Troubleshooting

### Issue: "Error: Credentials could not be loaded"

**Cause**: AWS OIDC authentication failed.

**Fix**:
1. Verify `AWS_ROLE_ARN` secret is set correctly
2. Check IAM role trust policy includes your repository
3. Ensure OIDC provider exists in AWS account

### Issue: "Stack does not exist"

**Cause**: First deployment or stack was deleted.

**Fix**: The workflow will create the stack automatically. No action needed.

### Issue: "ChangeSet is empty"

**Cause**: No changes detected in CloudFormation stack.

**Fix**: This is informational. The workflow uses `--no-fail-on-empty-changeset`.

### Issue: "Access Denied" during deployment

**Cause**: IAM role lacks required permissions.

**Fix**:
1. Review IAM role policies
2. Add missing permissions
3. Consider using AdministratorAccess for dev/testing

### Issue: CloudFront invalidation takes too long

**Cause**: CloudFront invalidations can take 10-15 minutes.

**Fix**: The workflow waits automatically. Be patient or remove the wait step if needed.

### Issue: Frontend shows old version after deployment

**Cause**: Browser cache or CloudFront cache not invalidated.

**Fix**:
1. Hard refresh browser (Ctrl+Shift+R)
2. Check if CloudFront invalidation completed
3. Verify `index.html` has `cache-control: no-cache` header

---

## Cost Optimization

### GitHub Actions Minutes

- **Free tier**: 2,000 minutes/month for public repos
- **Private repos**: Depends on your plan
- **Cost**: ~$0.008 per minute for private repos

**Optimization tips**:
- Use caching for dependencies (already configured)
- Only trigger on relevant file changes (already configured)
- Avoid unnecessary workflow runs

### AWS Costs

**S3 Deployment Bucket**:
- Storage: ~$0.023/GB/month
- Requests: Minimal (only during deployments)

**CloudFront Invalidations**:
- First 1,000 paths/month: FREE
- Additional: $0.005/path
- **Tip**: Use wildcard `/*` (counts as 1 path)

---

## Security Best Practices

### 1. Use OIDC instead of long-lived credentials
✅ Already configured - no AWS access keys stored in GitHub.

### 2. Least privilege IAM permissions
⚠️  Currently using AdministratorAccess for simplicity.
**Recommendation**: Switch to custom policy with only required permissions for production.

### 3. Separate roles per environment
**Recommendation**: Create separate IAM roles for dev/prod:
- `GitHubActionsDeploymentRole-Dev`
- `GitHubActionsDeploymentRole-Prod`

### 4. Enable branch protection
**Recommendation**:
- Require pull request reviews before merging to `main`
- Require status checks to pass before merging
- Restrict who can push to `main`

### 5. Use environment secrets for production
**Recommendation**: Use GitHub environment secrets for prod-specific values:
- Settings → Environments → Create "production" environment
- Add environment-specific secrets
- Require approvals before production deployment

---

## Advanced Configuration

### Deploy to Multiple Regions

Modify workflows to deploy to multiple AWS regions:

```yaml
strategy:
  matrix:
    region: [us-east-1, eu-west-1, ap-southeast-1]
env:
  AWS_REGION: ${{ matrix.region }}
```

### Add Approval Gates for Production

Add environment protection rules:

1. Go to **Settings** → **Environments**
2. Create "production" environment
3. Enable **Required reviewers**
4. Add reviewers who must approve

Update workflow:
```yaml
jobs:
  deploy:
    environment:
      name: production
      url: ${{ steps.cfn-outputs.outputs.CLOUDFRONT_URL }}
```

### Slack/Email Notifications

Add notification steps:

```yaml
- name: Notify Slack on success
  if: success()
  uses: slackapi/slack-github-action@v1
  with:
    payload: |
      {
        "text": "✅ Deployment successful: ${{ steps.set-env.outputs.ENVIRONMENT }}"
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

---

## Quick Commands Reference

```bash
# View all workflows
gh workflow list

# Run backend deployment
gh workflow run deploy-backend.yml --ref dev --field environment=dev

# Run frontend deployment
gh workflow run deploy-frontend.yml --ref dev

# View latest run
gh run list --limit 1

# Watch deployment
gh run watch

# Download artifacts from latest run
gh run download $(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')

# Cancel running workflow
gh run cancel <run-id>

# Re-run failed workflow
gh run rerun <run-id>

# View workflow logs
gh run view <run-id> --log
```

---

## Next Steps

1. ✅ Set up GitHub secrets (`AWS_ROLE_ARN`, `AWS_ACCOUNT_ID`)
2. ✅ Create IAM OIDC provider and role in AWS
3. ✅ Push code to trigger first deployment
4. ✅ Monitor deployment in GitHub Actions
5. ✅ Verify deployment in AWS Console
6. ✅ Test deployed application
7. ✅ Set up branch protection rules
8. ✅ Configure environment secrets for production
9. ✅ Add approval gates for production deployments
10. ✅ Set up monitoring and alerts

---

**For questions or issues, check the workflow logs in the GitHub Actions tab.**
