# Create Test Users Script
# Creates sample users for testing Cognito authentication

param(
    [string]$Environment = "dev",
    [string]$UserPoolId = "",
    [switch]$CreateAdmin,
    [switch]$CreateCustomer
)

$ErrorActionPreference = "Stop"

# Get User Pool ID if not provided
if ([string]::IsNullOrEmpty($UserPoolId)) {
    $stackName = "$Environment-ecommerce-stack"
    Write-Host "Getting User Pool ID from stack: $stackName" -ForegroundColor Yellow
    $UserPoolId = aws cloudformation describe-stacks --stack-name $stackName --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text
    
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrEmpty($UserPoolId)) {
        Write-Host "[ERROR] Could not find User Pool ID" -ForegroundColor Red
        Write-Host "Please provide User Pool ID manually: .\create-test-users.ps1 -UserPoolId YOUR_POOL_ID" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host "Using User Pool ID: $UserPoolId" -ForegroundColor Cyan
Write-Host ""

# Function to create a user
function Create-CognitoUser {
    param(
        [string]$Email,
        [string]$GivenName,
        [string]$FamilyName,
        [string]$TempPassword,
        [string]$GroupName = $null
    )
    
    Write-Host "Creating user: $Email" -ForegroundColor Yellow
    
    # Create user
    aws cognito-idp admin-create-user `
        --user-pool-id $UserPoolId `
        --username $Email `
        --user-attributes `
            Name=email,Value=$Email `
            Name=email_verified,Value=true `
            Name=given_name,Value=$GivenName `
            Name=family_name,Value=$FamilyName `
        --temporary-password $TempPassword `
        --message-action SUPPRESS 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] User created: $Email" -ForegroundColor Green
        
        # Set permanent password
        aws cognito-idp admin-set-user-password `
            --user-pool-id $UserPoolId `
            --username $Email `
            --password $TempPassword `
            --permanent 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[OK] Password set to permanent" -ForegroundColor Green
        }
        
        # Add to group if specified
        if (-not [string]::IsNullOrEmpty($GroupName)) {
            aws cognito-idp admin-add-user-to-group `
                --user-pool-id $UserPoolId `
                --username $Email `
                --group-name $GroupName 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host "[OK] Added to group: $GroupName" -ForegroundColor Green
            }
        }
        
        Write-Host "   Email:    $Email" -ForegroundColor White
        Write-Host "   Password: $TempPassword" -ForegroundColor White
        Write-Host ""
        
        return $true
    } else {
        Write-Host "[WARN] User may already exist or creation failed" -ForegroundColor Yellow
        Write-Host ""
        return $false
    }
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Creating Test Users" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$usersCreated = 0

# Create Admin User
if ($CreateAdmin -or (-not $CreateCustomer)) {
    Write-Host "Creating Admin User..." -ForegroundColor Cyan
    Write-Host ""
    
    if (Create-CognitoUser -Email "admin@ecommerce.test" -GivenName "Admin" -FamilyName "User" -TempPassword "Admin@123456" -GroupName "Admins") {
        $usersCreated++
    }
}

# Create Customer Users
if ($CreateCustomer -or (-not $CreateAdmin)) {
    Write-Host "Creating Customer Users..." -ForegroundColor Cyan
    Write-Host ""
    
    if (Create-CognitoUser -Email "customer@ecommerce.test" -GivenName "John" -FamilyName "Doe" -TempPassword "Customer@123" -GroupName "Customers") {
        $usersCreated++
    }
    
    if (Create-CognitoUser -Email "jane@ecommerce.test" -GivenName "Jane" -FamilyName "Smith" -TempPassword "Customer@456" -GroupName "Customers") {
        $usersCreated++
    }
}

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "  Created $usersCreated test user(s)" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# List all users
Write-Host "All Users in Pool:" -ForegroundColor Yellow
aws cognito-idp list-users --user-pool-id $UserPoolId --query "Users[].{Username:Username,Email:Attributes[?Name==``'email``'].Value|[0],Status:UserStatus}" --output table

Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "   - Use these credentials to test login in your frontend" -ForegroundColor White
Write-Host "   - Admin user has access to admin-only endpoints" -ForegroundColor White
Write-Host "   - Customer users can access cart, orders, and checkout" -ForegroundColor White
Write-Host ""
Write-Host "Open Cognito Console:" -ForegroundColor Yellow
$region = aws configure get region
Write-Host "   https://console.aws.amazon.com/cognito/v2/idp/user-pools/$UserPoolId/users?region=$region" -ForegroundColor Cyan
Write-Host ""
