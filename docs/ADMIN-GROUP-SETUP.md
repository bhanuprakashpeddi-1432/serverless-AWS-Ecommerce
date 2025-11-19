# Admin Group Setup Guide

## Overview

The admin interface requires users to be in the `Admins` Cognito group to access protected routes like `/admin`. This guide shows how to add users to the Admin group via AWS CLI.

## Prerequisites

- AWS CLI installed and configured
- User pool ID and username
- Appropriate IAM permissions to manage Cognito users

## Create the Admins Group

First, create the `Admins` group in your Cognito User Pool:

```bash
aws cognito-idp create-group \
  --group-name Admins \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --description "Administrators with full access to admin dashboard" \
  --precedence 1
```

**With PowerShell:**
```powershell
aws cognito-idp create-group `
  --group-name Admins `
  --user-pool-id <YOUR_USER_POOL_ID> `
  --description "Administrators with full access to admin dashboard" `
  --precedence 1
```

## Add User to Admins Group

### Method 1: Using Username

```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username <USERNAME_OR_EMAIL> \
  --group-name Admins
```

**With PowerShell:**
```powershell
aws cognito-idp admin-add-user-to-group `
  --user-pool-id <YOUR_USER_POOL_ID> `
  --username <USERNAME_OR_EMAIL> `
  --group-name Admins
```

**Example:**
```bash
# Linux/Mac
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_ABC123DEF \
  --username admin@example.com \
  --group-name Admins

# PowerShell
aws cognito-idp admin-add-user-to-group `
  --user-pool-id us-east-1_ABC123DEF `
  --username admin@example.com `
  --group-name Admins
```

### Method 2: Get User Pool ID from SAM/CloudFormation Stack

```bash
# Get User Pool ID from CloudFormation stack
USER_POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name <YOUR_STACK_NAME> \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" \
  --output text)

echo "User Pool ID: $USER_POOL_ID"

# Add user to Admins group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id $USER_POOL_ID \
  --username <USERNAME> \
  --group-name Admins
```

**With PowerShell:**
```powershell
# Get User Pool ID from CloudFormation stack
$USER_POOL_ID = aws cloudformation describe-stacks `
  --stack-name <YOUR_STACK_NAME> `
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" `
  --output text

Write-Host "User Pool ID: $USER_POOL_ID"

# Add user to Admins group
aws cognito-idp admin-add-user-to-group `
  --user-pool-id $USER_POOL_ID `
  --username <USERNAME> `
  --group-name Admins
```

## Verify User Group Membership

Check if user is in the Admins group:

```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username <USERNAME>
```

**Expected Output:**
```json
{
  "Groups": [
    {
      "GroupName": "Admins",
      "UserPoolId": "us-east-1_ABC123DEF",
      "Description": "Administrators with full access to admin dashboard",
      "Precedence": 1,
      "LastModifiedDate": "2025-11-18T10:30:00.000Z",
      "CreationDate": "2025-11-18T10:30:00.000Z"
    }
  ]
}
```

## List All Users in Admins Group

```bash
aws cognito-idp list-users-in-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --group-name Admins
```

## Remove User from Admins Group

If you need to revoke admin access:

```bash
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username <USERNAME> \
  --group-name Admins
```

## How It Works

1. **Group Creation**: The `Admins` group is created in Cognito with a precedence value
2. **User Assignment**: Users are added to the group via AWS CLI or Console
3. **Token Claims**: When users sign in, their ID token includes a `cognito:groups` claim
4. **Frontend Check**: The `AuthProvider` extracts groups and sets `isAdmin` flag
5. **Protected Route**: The `ProtectedRoute` component checks `user.isAdmin` before rendering

## Frontend Integration

The frontend automatically checks for admin status:

```javascript
// In AuthProvider.jsx
const groups = idToken.payload['cognito:groups'] || []
setUser({
  ...userData,
  groups: groups,
  isAdmin: groups.includes('Admins')
})
```

```jsx
// In App.jsx - Protected admin route
<Route path="/admin" element={
  <ProtectedRoute requireAdmin={true}>
    <Admin />
  </ProtectedRoute>
} />
```

## Access Control Flow

```
User Login
    ↓
Cognito Authentication
    ↓
ID Token with cognito:groups claim
    ↓
AuthProvider extracts groups
    ↓
user.isAdmin = groups.includes('Admins')
    ↓
ProtectedRoute checks requireAdmin
    ↓
Allow/Deny access to /admin
```

## Testing

### Test Admin Access

1. **Create a test user:**
```bash
aws cognito-idp admin-create-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin-test@example.com \
  --user-attributes Name=email,Value=admin-test@example.com \
  --temporary-password "TempPass123!" \
  --message-action SUPPRESS
```

2. **Add to Admins group:**
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin-test@example.com \
  --group-name Admins
```

3. **Set permanent password:**
```bash
aws cognito-idp admin-set-user-password \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username admin-test@example.com \
  --password "SecurePass123!" \
  --permanent
```

4. **Login and access `/admin`** - Should see admin dashboard

### Test Non-Admin Access

1. Create a regular user (without adding to Admins group)
2. Login and try to access `/admin`
3. Should see "Access Denied" message

## Troubleshooting

### User can't access /admin despite being in group

**Check 1: Verify group membership**
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --username <USERNAME>
```

**Check 2: User needs to sign out and sign in again**
- Groups are added to the token at sign-in time
- Existing sessions won't have the updated group claims
- Force user to sign out and sign in again

**Check 3: Inspect ID token**
```javascript
// In browser console
const idToken = localStorage.getItem('idToken')
const payload = JSON.parse(atob(idToken.split('.')[1]))
console.log('Groups:', payload['cognito:groups'])
```

### Group doesn't exist error

Create the group first:
```bash
aws cognito-idp create-group \
  --group-name Admins \
  --user-pool-id <YOUR_USER_POOL_ID>
```

### Permission denied errors

Ensure your AWS CLI user has these permissions:
- `cognito-idp:AdminAddUserToGroup`
- `cognito-idp:AdminRemoveUserFromGroup`
- `cognito-idp:CreateGroup`
- `cognito-idp:ListUsersInGroup`

## Production Best Practices

1. **Limit Admin Users**: Only grant admin access to trusted users
2. **Audit Regularly**: Review admin group membership periodically
3. **Use MFA**: Enable multi-factor authentication for admin accounts
4. **Log Access**: Monitor CloudWatch logs for admin actions
5. **Principle of Least Privilege**: Create separate groups for different permission levels

## Additional Groups

You can create multiple groups for fine-grained access control:

```bash
# Create different permission groups
aws cognito-idp create-group \
  --group-name Admins \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --precedence 1

aws cognito-idp create-group \
  --group-name Managers \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --precedence 2

aws cognito-idp create-group \
  --group-name Customers \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --precedence 3
```

Then check for specific groups in the frontend:
```javascript
const isManager = user.groups.includes('Managers')
const isCustomer = user.groups.includes('Customers')
```

## Quick Reference

```bash
# Create Admins group
aws cognito-idp create-group --group-name Admins --user-pool-id <POOL_ID> --precedence 1

# Add user to Admins
aws cognito-idp admin-add-user-to-group --user-pool-id <POOL_ID> --username <EMAIL> --group-name Admins

# List user's groups
aws cognito-idp admin-list-groups-for-user --user-pool-id <POOL_ID> --username <EMAIL>

# List all admins
aws cognito-idp list-users-in-group --user-pool-id <POOL_ID> --group-name Admins

# Remove from Admins
aws cognito-idp admin-remove-user-from-group --user-pool-id <POOL_ID> --username <EMAIL> --group-name Admins
```

---

**Note:** Replace `<YOUR_USER_POOL_ID>`, `<USERNAME>`, and `<YOUR_STACK_NAME>` with your actual values.
