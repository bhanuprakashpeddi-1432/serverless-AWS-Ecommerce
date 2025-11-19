# Security Checklist (Backend + Frontend)

Use this short checklist to harden the e-commerce stack.

## Identity & Access Management
- Least privilege for Lambda roles (only required DynamoDB tables and S3 prefixes)
- Separate roles per environment (dev, prod)
- Use OIDC for GitHub Actions (no long-lived keys)
- Scope trust policy to this repo (and branch if needed)

## Data Protection
- Enable encryption at rest (S3, DynamoDB, Logs)
- Enforce TLS 1.2+ on CloudFront
- Block public S3 access; serve via CloudFront OAI

## Network & Edge
- Enable AWS WAF on CloudFront (rate limits, managed rules)
- Redirect HTTP→HTTPS; set strong security headers

## Observability
- Enable X-Ray tracing (Lambdas + API Gateway)
- Set CloudWatch alarms for errors, latency, throttles
- Keep a dashboard for Lambda, States, DynamoDB (see `infra/cloudwatch-dashboard.json`)

## Secrets & Config
- Never commit secrets; use Secrets Manager/SSM Parameter Store
- Use environment variables for non-secret config

## CI/CD
- Require PR review and branch protection for `main`
- Automate deployments; log and tag deployments

---

## Sample Least-Privilege IAM Policy (Lambda)

Replace placeholders like `<ACCOUNT_ID>`, `<REGION>`, `<ENV>` and resource names to match your stack.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DynamoDBMinimalAccess",
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:Scan",
        "dynamodb:TransactWriteItems"
      ],
      "Resource": [
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-products",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-users",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-carts",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-orders",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-products/index/*",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-users/index/*",
        "arn:aws:dynamodb:<REGION>:<ACCOUNT_ID>:table/<ENV>-ecommerce-orders/index/*"
      ]
    },
    {
      "Sid": "S3LeastPrivilege",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::<ENV>-ecommerce-images-<ACCOUNT_ID>/products/*"
      ]
    },
    {
      "Sid": "XRayWrites",
      "Effect": "Allow",
      "Action": [
        "xray:PutTraceSegments",
        "xray:PutTelemetryRecords"
      ],
      "Resource": "*"
    },
    {
      "Sid": "LogsWrite",
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
```

Tips:
- Prefer explicit table ARNs over `*`.
- Limit S3 paths to the exact prefixes the function needs (e.g., `products/`).
- If a function is read-only for a table, remove write actions.
- For presigned URL upload flows, Lambdas usually need only `s3:PutObject` on a prefix.
```
