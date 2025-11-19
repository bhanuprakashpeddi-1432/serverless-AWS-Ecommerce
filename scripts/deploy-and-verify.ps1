# Deploy and Verify Cognito Setup Script
# This script deploys the SAM application and verifies Cognito configuration

param(
    [string]$Environment = "dev",
    [switch]$SkipBuild,
    [switch]$SkipDeploy
)

$ErrorActionPreference = "Stop"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Serverless E-Commerce - Cognito Deployment" -ForegroundColor Cyan
Write-Host "  Environment: $Environment" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Validate Template
Write-Host "[1/6] Validating SAM template..." -ForegroundColor Yellow
sam validate --lint
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Template validation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Template is valid" -ForegroundColor Green
Write-Host ""

# Step 2: Build Application
if (-not $SkipBuild) {
    Write-Host "[2/6] Building SAM application..." -ForegroundColor Yellow
    sam build --parallel
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Build completed successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[2/6] Skipping build (using existing build)" -ForegroundColor Gray
    Write-Host ""
}

# Step 3: Deploy
if (-not $SkipDeploy) {
    Write-Host "[3/6] Deploying to AWS..." -ForegroundColor Yellow
    Write-Host "Note: This may take 5-10 minutes..." -ForegroundColor Gray
    
    sam deploy --config-env default --no-confirm-changeset --no-fail-on-empty-changeset
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Deployment failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] Deployment completed successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "[3/6] Skipping deployment (using existing stack)" -ForegroundColor Gray
    Write-Host ""
}

# Step 4: Get Stack Outputs
Write-Host "[4/6] Retrieving stack outputs..." -ForegroundColor Yellow

$stackName = "$Environment-ecommerce-stack"

# Check if stack exists
$stackStatus = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].StackStatus" --output text 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Stack not found: $stackName" -ForegroundColor Red
    Write-Host "Please deploy the stack first!" -ForegroundColor Yellow
    exit 1
}

Write-Host "Stack Status: $stackStatus" -ForegroundColor Cyan

# Get outputs
$userPoolId = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
$clientId = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolClientId'].OutputValue" --output text
$userPoolDomain = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolDomain'].OutputValue" --output text
$apiEndpoint = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" --output text
$region = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='Region'].OutputValue" --output text

Write-Host ""
Write-Host "Stack Outputs:" -ForegroundColor Cyan
Write-Host "  User Pool ID:     $userPoolId" -ForegroundColor White
Write-Host "  Client ID:        $clientId" -ForegroundColor White
Write-Host "  Domain:           $userPoolDomain" -ForegroundColor White
Write-Host "  API Endpoint:     $apiEndpoint" -ForegroundColor White
Write-Host "  Region:           $region" -ForegroundColor White
Write-Host ""

# Step 5: Verify Cognito Resources
Write-Host "[5/6] Verifying Cognito resources..." -ForegroundColor Yellow

# Check User Pool
$poolExists = aws cognito-idp describe-user-pool --user-pool-id $userPoolId --query "UserPool.Name" --output text 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] User Pool exists: $poolExists" -ForegroundColor Green
} else {
    Write-Host "[ERROR] User Pool not found!" -ForegroundColor Red
}

# Check Groups
$groups = aws cognito-idp list-groups --user-pool-id $userPoolId --query "Groups[].GroupName" --output text 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Groups found: $groups" -ForegroundColor Green
} else {
    Write-Host "[WARN] No groups found" -ForegroundColor Yellow
}

# Check Domain
$domainDescription = aws cognito-idp describe-user-pool-domain --domain $userPoolDomain --query "DomainDescription.Status" --output text 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Domain status: $domainDescription" -ForegroundColor Green
} else {
    Write-Host "[WARN] Domain not verified" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Generate Frontend Config
Write-Host "[6/6] Generating frontend configuration..." -ForegroundColor Yellow

$envContent = @"
# AWS Cognito Configuration
VITE_API_BASE_URL=$apiEndpoint
VITE_COGNITO_USER_POOL_ID=$userPoolId
VITE_COGNITO_CLIENT_ID=$clientId
VITE_COGNITO_REGION=$region
"@

$envPath = "frontend\.env"
$envContent | Out-File -FilePath $envPath -Encoding UTF8 -Force
Write-Host "[OK] Frontend config saved to: $envPath" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Deployment and Verification Complete!" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Open AWS Console to verify resources:" -ForegroundColor White
Write-Host "   https://console.aws.amazon.com/cognito/v2/idp/user-pools?region=$region" -ForegroundColor Cyan
Write-Host ""
Write-Host "2. Start the frontend application:" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. Test user registration and login:" -ForegroundColor White
Write-Host "   - Navigate to http://localhost:5173" -ForegroundColor Cyan
Write-Host "   - Create a new account" -ForegroundColor Cyan
Write-Host "   - Verify email and login" -ForegroundColor Cyan
Write-Host ""
Write-Host "4. Create an admin user (optional):" -ForegroundColor White
Write-Host "   aws cognito-idp admin-create-user ``" -ForegroundColor Cyan
Write-Host "     --user-pool-id $userPoolId ``" -ForegroundColor Cyan
Write-Host "     --username admin@example.com ``" -ForegroundColor Cyan
Write-Host "     --user-attributes Name=email,Value=admin@example.com Name=given_name,Value=Admin Name=family_name,Value=User ``" -ForegroundColor Cyan
Write-Host "     --message-action SUPPRESS" -ForegroundColor Cyan
Write-Host ""
Write-Host "   aws cognito-idp admin-add-user-to-group ``" -ForegroundColor Cyan
Write-Host "     --user-pool-id $userPoolId ``" -ForegroundColor Cyan
Write-Host "     --username admin@example.com ``" -ForegroundColor Cyan
Write-Host "     --group-name Admins" -ForegroundColor Cyan
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
