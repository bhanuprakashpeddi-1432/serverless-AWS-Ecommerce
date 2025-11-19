# CloudFront Deployment Guide

## Overview

This project uses Amazon CloudFront as a Content Delivery Network (CDN) to serve the React frontend application with optimal performance, security, and global reach.

## Architecture

```
User Request
    ↓
CloudFront Distribution (CDN)
    ↓
Origin Access Identity (OAI)
    ↓
S3 Frontend Bucket (Private)
```

## CloudFront Configuration

### Origin Configuration
- **Origin Type**: S3 bucket
- **Access**: Origin Access Identity (OAI) - S3 bucket is private
- **Origin Shield**: Disabled (can be enabled for prod)

### Cache Behaviors

#### 1. Default Behavior (/)
- **Path Pattern**: `*` (all paths)
- **Viewer Protocol**: Redirect HTTP to HTTPS
- **Allowed Methods**: GET, HEAD, OPTIONS
- **Cache Policy**: Managed-CachingOptimized
- **Origin Request Policy**: Managed-CORS-S3Origin
- **Response Headers Policy**: Managed-SecurityHeadersPolicy
- **Compression**: Enabled (gzip, brotli)

#### 2. Static Assets (/assets/*)
- **Path Pattern**: `/assets/*`
- **Cache Policy**: Managed-CachingOptimized
- **TTL**: Long (31536000 seconds = 1 year)
- **Purpose**: Cache JS, CSS, images with fingerprinted filenames

#### 3. Index HTML (/index.html)
- **Path Pattern**: `/index.html`
- **Cache Policy**: Managed-CachingDisabled
- **TTL**: 0 (always fetch fresh)
- **Purpose**: Ensure users always get latest app version

### Custom Error Responses

For Single Page Application (SPA) routing:
- **403 Forbidden** → Return `/index.html` with 200 status
- **404 Not Found** → Return `/index.html` with 200 status
- **Error Caching TTL**: 60 seconds

This allows client-side routing (React Router) to handle all paths.

### Security Features

#### WAF Web ACL
Protects against common attacks:
1. **Rate Limiting**: 2000 requests per 5 minutes per IP
2. **Common Rule Set**: OWASP Top 10, SQL injection, XSS
3. **Known Bad Inputs**: Block malicious payloads
4. **Anonymous IP List**: Block VPN, proxies, Tor exit nodes

#### TLS Configuration
- **Minimum Protocol**: TLSv1.2_2021
- **SSL Certificate**: CloudFront default certificate
- **Viewer Protocol**: Redirect HTTP to HTTPS

### Logging
- **Access Logs**: Enabled
- **Log Bucket**: Separate S3 bucket
- **Log Prefix**: `{environment}-frontend/`
- **Log Retention**: 90 days

## Deployment Process

### Manual Deployment

1. **Build the frontend**:
```bash
cd frontend
npm install
npm run build
```

2. **Sync to S3**:
```bash
# Get bucket name from CloudFormation
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name dev-ecommerce-stack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

# Sync build files (with caching for assets)
aws s3 sync dist/ s3://$BUCKET_NAME/ \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html" \
  --exclude "*.map"

# Upload index.html with no-cache
aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html \
  --cache-control "public,max-age=0,must-revalidate" \
  --content-type "text/html"
```

3. **Invalidate CloudFront cache**:
```bash
# Get distribution ID
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name dev-ecommerce-stack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
  --output text)

# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

### PowerShell Deployment

```powershell
# Build frontend
cd frontend
npm install
npm run build

# Get CloudFormation outputs
$BUCKET_NAME = aws cloudformation describe-stacks `
  --stack-name dev-ecommerce-stack `
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" `
  --output text

$DISTRIBUTION_ID = aws cloudformation describe-stacks `
  --stack-name dev-ecommerce-stack `
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" `
  --output text

# Sync to S3
aws s3 sync dist/ s3://$BUCKET_NAME/ `
  --delete `
  --cache-control "public,max-age=31536000,immutable" `
  --exclude "index.html" `
  --exclude "*.map"

aws s3 cp dist/index.html s3://$BUCKET_NAME/index.html `
  --cache-control "public,max-age=0,must-revalidate" `
  --content-type "text/html"

# Invalidate CloudFront
aws cloudfront create-invalidation `
  --distribution-id $DISTRIBUTION_ID `
  --paths "/*"

Write-Host "✅ Deployment complete!" -ForegroundColor Green
```

### GitHub Actions (Automated)

The `.github/workflows/deploy-frontend.yml` workflow automates deployment:

**Triggers**:
- Push to `main` or `dev` branches (when `frontend/**` changes)
- Manual workflow dispatch

**Steps**:
1. ✅ Checkout code
2. ✅ Set environment (dev/prod) based on branch
3. ✅ Setup Node.js with cache
4. ✅ Configure AWS credentials (OIDC)
5. ✅ Get CloudFormation outputs
6. ✅ Install dependencies
7. ✅ Create `.env.production` file
8. ✅ Build frontend
9. ✅ Run tests (if available)
10. ✅ Sync to S3 with proper cache headers
11. ✅ Create CloudFront invalidation
12. ✅ Wait for invalidation to complete
13. ✅ Create deployment artifact

**Required Secrets**:
- `AWS_ROLE_ARN`: IAM role ARN for OIDC authentication

**Example Output**:
```
🚀 Deployment Complete!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Environment: dev
🌐 CloudFront URL: https://d1234567890abc.cloudfront.net
🪣 S3 Bucket: dev-ecommerce-frontend-123456789012
🔄 Distribution ID: E1234567890ABC
🔗 API Endpoint: https://abc123def.execute-api.us-east-1.amazonaws.com
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Cache Invalidation

### When to Invalidate
- After deploying new frontend code
- After updating environment variables
- When fixing critical bugs

### Invalidation Patterns

**Invalidate everything** (recommended for new deployments):
```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"
```

**Invalidate specific files**:
```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/index.html" "/assets/main.*.js" "/assets/main.*.css"
```

**Invalidate with wildcard**:
```bash
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/assets/*" "/index.html"
```

### Invalidation Costs
- First 1,000 invalidation paths per month: **FREE**
- Additional paths: **$0.005 per path**
- Wildcard (`/*`) counts as 1 path

### Check Invalidation Status

```bash
# List invalidations
aws cloudfront list-invalidations \
  --distribution-id $DISTRIBUTION_ID

# Get specific invalidation details
aws cloudfront get-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --id <INVALIDATION_ID>

# Wait for invalidation to complete
aws cloudfront wait invalidation-completed \
  --distribution-id $DISTRIBUTION_ID \
  --id <INVALIDATION_ID>
```

## Performance Optimization

### Cache Headers Best Practices

**Long-term caching** (fingerprinted assets):
```bash
--cache-control "public,max-age=31536000,immutable"
```
- Assets with hash in filename (e.g., `main.abc123.js`)
- Images, fonts, versioned files

**No caching** (entry point):
```bash
--cache-control "public,max-age=0,must-revalidate"
```
- `index.html`
- Manifest files
- Service worker

**Short-term caching** (API responses):
```bash
--cache-control "public,max-age=300"
```
- 5-minute cache
- Frequently changing data

### Compression

CloudFront automatically compresses:
- JavaScript (`.js`)
- CSS (`.css`)
- JSON (`.json`)
- SVG (`.svg`)
- HTML (`.html`)

**Compression Algorithms**:
1. Brotli (better compression)
2. Gzip (wider support)

### Performance Metrics

Monitor in CloudWatch:
- **Cache Hit Rate**: Aim for >80%
- **Origin Latency**: <100ms
- **Error Rate**: <1%
- **Bytes Downloaded**: Track bandwidth usage

## Security Best Practices

### 1. Private S3 Bucket
- Use Origin Access Identity (OAI)
- Block all public access
- CloudFront is the only entry point

### 2. WAF Protection
- Enable AWS WAF
- Use managed rule sets
- Monitor blocked requests

### 3. HTTPS Only
- Redirect HTTP to HTTPS
- Use TLSv1.2 or higher
- Enable HSTS headers

### 4. Response Headers
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `X-XSS-Protection: 1; mode=block`
- `Strict-Transport-Security: max-age=31536000`

## Troubleshooting

### Issue: 403 Forbidden

**Cause**: OAI not properly configured or S3 bucket policy missing

**Fix**:
```bash
# Verify bucket policy allows OAI
aws s3api get-bucket-policy --bucket $BUCKET_NAME

# Redeploy CloudFormation stack if needed
sam deploy
```

### Issue: Old version cached

**Cause**: Browser or CloudFront cache not invalidated

**Fix**:
```bash
# Create invalidation
aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*"

# Hard refresh in browser (Ctrl+Shift+R)
```

### Issue: 404 for SPA routes

**Cause**: Custom error responses not configured

**Fix**: Already configured in template to return `index.html` for 403/404

### Issue: Slow propagation

**Cause**: CloudFront cache TTL too high

**Fix**:
- Invalidate cache after deployment
- Use shorter TTL for `index.html` (already configured)
- Wait 5-15 minutes for edge locations to update

## Monitoring & Alerts

### CloudWatch Metrics

```bash
# View distribution metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/CloudFront \
  --metric-name Requests \
  --dimensions Name=DistributionId,Value=$DISTRIBUTION_ID \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

### WAF Metrics

```bash
# View blocked requests
aws cloudwatch get-metric-statistics \
  --namespace AWS/WAFV2 \
  --metric-name BlockedRequests \
  --dimensions Name=Rule,Value=RateLimitRule \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Sum
```

## Cost Optimization

### Pricing Factors
1. **Data Transfer Out**: $0.085/GB (first 10 TB)
2. **HTTP/HTTPS Requests**: $0.0075 per 10,000 requests
3. **Invalidations**: First 1,000 paths free/month
4. **WAF Rules**: $1/month per rule + $0.60 per million requests

### Cost-Saving Tips
- Use longer cache TTLs for static assets
- Compress all assets before upload
- Use wildcard invalidations (counts as 1 path)
- Enable compression in CloudFront
- Use PriceClass_100 (North America & Europe only)

## Production Checklist

- [ ] Custom domain configured with SSL certificate
- [ ] WAF rules tuned for your traffic patterns
- [ ] CloudWatch alarms for errors and latency
- [ ] Origin Shield enabled for high-traffic sites
- [ ] CloudFront logs configured and analyzed
- [ ] Budget alerts configured
- [ ] Disaster recovery plan documented
- [ ] CDN cache warming strategy for major releases

## Quick Reference

```bash
# Get CloudFront URL
aws cloudformation describe-stacks \
  --stack-name dev-ecommerce-stack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendUrl'].OutputValue" \
  --output text

# Get Distribution ID
aws cloudformation describe-stacks \
  --stack-name dev-ecommerce-stack \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" \
  --output text

# Deploy frontend (one command)
cd frontend && npm run build && \
aws s3 sync dist/ s3://$(aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" --output text)/ --delete && \
aws cloudfront create-invalidation --distribution-id $(aws cloudformation describe-stacks --stack-name dev-ecommerce-stack --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" --output text) --paths "/*"
```

---

**Note**: Replace `dev-ecommerce-stack` with your actual CloudFormation stack name.
