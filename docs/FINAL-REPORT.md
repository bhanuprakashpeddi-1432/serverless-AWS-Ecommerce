---
title: "Serverless E‑Commerce Capstone – Final Report"
author: "serverless-AWS-Ecommerce Team"
date: "2025-11-19"
toc: true
toc-depth: 3
geometry: margin=1in
fontsize: 11pt
---

## Abstract

This project delivers a production‑grade, serverless e‑commerce application on AWS. The system provides product catalog, cart, checkout, and order processing with strong reliability via AWS Step Functions, DynamoDB single‑table design, and compensation patterns. The frontend is a React SPA served through CloudFront and S3, with Cognito‑based authentication and admin features. The backend exposes HTTP APIs via API Gateway, integrates with Stripe for payments, and notifies customers via SES/SNS. Observability is enabled through CloudWatch dashboards, structured logs, and AWS X‑Ray. CI/CD uses GitHub Actions for automated builds and deployments.

## Architecture

```mermaid
flowchart TD
  subgraph Client
    U[User Browser]
  end

  subgraph Edge
    CF[Amazon CloudFront\n(OAI, WAF, TLS 1.2+)]
  end

  subgraph Frontend
    S3F[S3 Frontend Bucket\nPrivate, OAI]
  end

  subgraph Identity
    COG[Cognito User Pool\nJWT, Admin Group]
  end

  subgraph API
    APIGW[API Gateway HTTP API\nJWT Authorizer]
  end

  subgraph Compute
    L(λ Node.js Handlers)
  end

  subgraph Data
    DDB[(DynamoDB\nSingle Table)]
    S3I[(S3 Product Images)]
    SEC[Secrets Manager\nStripe Key]
  end

  subgraph Workflow
    SFN[[Step Functions\nOrder Processing]]
    PI[(Stripe PaymentIntent)]
    SES[(Amazon SES)]
    SNS[(Amazon SNS)]
  end

  subgraph Observability
    CW[CloudWatch\nLogs & Dashboards]
    XR[X‑Ray Tracing]
  end

  U --> CF
  CF --> S3F
  U -->|SPA API calls| CF --> APIGW --> L
  L --> DDB
  L --> S3I
  L --> SEC
  L --> SFN
  SFN --> PI
  SFN --> SES
  SFN --> SNS

  CF -.->|WAF| CF
  L -.-> XR
  APIGW -.-> XR
  L -.-> CW
  SFN -.-> CW
```

## Infrastructure Inventory

- API & Auth
  - `API Gateway (HTTP API)`: JWT authorizer (Cognito User Pool)
  - `Cognito User Pool`: Admins group; tokens contain group claims
- Compute & Workflow
  - `AWS Lambda (Node.js 18)`: Products, Cart, Checkout, Orders, Workflows
  - `AWS Step Functions`: Order processing with retries and compensation
- Data & Storage
  - `DynamoDB` single‑table: products, users, carts, orders, indexes for queries
  - `S3` buckets: Frontend hosting (private via OAI), Product images
- Edge & Security
  - `CloudFront` distribution: OAI to S3, WAF, security headers, SPA routing
  - `AWS WAFv2`: Managed rule sets, rate limiting
  - `Secrets Manager`: Stripe secret key (preferred) or env var fallback
- Notifications
  - `SES` for email; `SNS` for SMS (optional)
- Observability
  - `CloudWatch` logs, dashboards (`infra/cloudwatch-dashboard.json`)
  - `AWS X‑Ray` tracing enabled globally in SAM
- CI/CD
  - GitHub Actions: `deploy-backend.yml`, `deploy-frontend.yml`

## State Machine (ASL) – Order Processing

The full definition is in `state-machines/order-processing.asl.json`. Below is a representative excerpt illustrating core flow and compensation:

```json
{
  "Comment": "Order processing with compensation",
  "StartAt": "ValidateInventory",
  "States": {
    "ValidateInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.validateInventory", "Payload.$": "$" },
      "Retry": [{ "ErrorEquals": ["States.ALL"], "IntervalSeconds": 2, "MaxAttempts": 3, "BackoffRate": 2.0 }],
      "Catch": [{ "ErrorEquals": ["InventoryError"], "ResultPath": "$.error", "Next": "FailOrder" }],
      "Next": "ReserveInventory"
    },
    "ReserveInventory": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.reserveInventory", "Payload.$": "$" },
      "Retry": [{ "ErrorEquals": ["States.ALL"], "IntervalSeconds": 2, "MaxAttempts": 3, "BackoffRate": 2.0 }],
      "Catch": [{ "ErrorEquals": ["ReservationError"], "ResultPath": "$.error", "Next": "FailOrder" }],
      "Next": "ProcessPayment"
    },
    "ProcessPayment": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.processPayment", "Payload.$": "$" },
      "Retry": [{ "ErrorEquals": ["States.ALL"], "IntervalSeconds": 2, "MaxAttempts": 3, "BackoffRate": 2.0 }],
      "Catch": [{ "ErrorEquals": ["PaymentError"], "ResultPath": "$.error", "Next": "CompensateReservation" }],
      "Next": "CreateOrder"
    },
    "CreateOrder": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.createOrderRecord", "Payload.$": "$" },
      "Catch": [{ "ErrorEquals": ["States.ALL"], "ResultPath": "$.error", "Next": "CompensatePaymentAndReservation" }],
      "Next": "NotifyCustomer"
    },
    "NotifyCustomer": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.notifyCustomer", "Payload.$": "$" },
      "End": true
    },
    "CompensateReservation": {
      "Type": "Task",
      "Resource": "arn:aws:states:::lambda:invoke",
      "Parameters": { "FunctionName.$": "$.functions.releaseInventory", "Payload.$": "$" },
      "Next": "FailOrder"
    },
    "CompensatePaymentAndReservation": {
      "Type": "Parallel",
      "Branches": [
        { "StartAt": "RefundPayment", "States": { "RefundPayment": { "Type": "Task", "Resource": "arn:aws:states:::lambda:invoke", "Parameters": { "FunctionName.$": "$.functions.refundPayment", "Payload.$": "$" }, "End": true } } },
        { "StartAt": "ReleaseInventory2", "States": { "ReleaseInventory2": { "Type": "Task", "Resource": "arn:aws:states:::lambda:invoke", "Parameters": { "FunctionName.$": "$.functions.releaseInventory", "Payload.$": "$" }, "End": true } } }
      ],
      "Next": "FailOrder"
    },
    "FailOrder": { "Type": "Fail", "Error": "OrderFailed" }
  }
}
```

## API Documentation (Summary)

- Auth
  - `JWT`: Cognito User Pool; Admin routes require `Admins` group
- Products
  - `GET /products?limit&lastKey` → List products (paginated)
  - `GET /products/{id}` → Get product by ID
  - `POST /products` (Admin) → Create product; supports S3 presigned upload
  - `PATCH /products/{id}` (Admin) → Update product
  - `DELETE /products/{id}` (Admin) → Delete product
- Cart (Auth required)
  - `GET /cart` → Retrieve current user cart
  - `POST /cart` → Add item `{ productId, quantity }`
  - `PATCH /cart/{productId}` → Update quantity
  - `DELETE /cart/{productId}` → Remove item
  - `DELETE /cart` → Clear cart
- Checkout & Orders (Auth required)
  - `POST /checkout/start` → Starts Step Functions execution; calculates totals
  - `GET /orders` → List user orders
  - `GET /orders/{id}` → Fetch order details

Example – Get products

```http
GET /products?limit=20 HTTP/1.1
Authorization: Bearer <JWT>
```

Example – Start checkout

```http
POST /checkout/start HTTP/1.1
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "shippingAddress": {
    "street": "1 Test St",
    "city": "Testville",
    "state": "CA",
    "zipCode": "90001"
  },
  "paymentMethod": "card"
}
```

## Deployment

- SAM CLI (local)

```powershell
sam build
sam deploy `
  --stack-name dev-ecommerce-stack `
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND `
  --parameter-overrides Environment=dev Stage=dev
```

- Frontend (manual)

```powershell
cd frontend
npm ci
npm run build
$bucket = (aws cloudformation describe-stacks `
  --stack-name dev-ecommerce-stack `
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" `
  --output text)
aws s3 sync dist/ s3://$bucket/ --delete --cache-control "public,max-age=31536000,immutable" --exclude "index.html" --exclude "*.map"
aws s3 cp dist/index.html s3://$bucket/index.html --cache-control "public,max-age=0,must-revalidate" --content-type "text/html"
$distId = (aws cloudformation describe-stacks `
  --stack-name dev-ecommerce-stack `
  --query "Stacks[0].Outputs[?OutputKey=='FrontendDistributionId'].OutputValue" `
  --output text)
aws cloudfront create-invalidation --distribution-id $distId --paths "/*"
```

- CI/CD
  - Backend: `.github/workflows/deploy-backend.yml`
  - Frontend: `.github/workflows/deploy-frontend.yml`

## Testing

- Unit (Jest)

```powershell
cd backend/tests
npm ci
npm test
```

- Integration (Postman)
  - Import `tests/postman/Ecommerce.postman_collection.json`
  - Set variables: `apiBaseUrl`, `region`, `cognitoClientId`, `username`, `password`, `email`, `productId`
  - Run: SignUp → InitiateAuth → GetProducts → Add Item → Checkout Start

- E2E (Cypress) – Skeleton

```powershell
cd frontend
npm i -D cypress
npx cypress open
# Uses: frontend/cypress/e2e/checkout-flow.cy.js
# Env: CYPRESS_BASE_URL, CYPRESS_USERNAME, CYPRESS_PASSWORD
```

## Cost Analysis

We include a small estimator `scripts/cost-estimator.js` to approximate monthly costs.

Example (PowerShell):

```powershell
node scripts/cost-estimator.js `
  --lambda-invocations 5000000 `
  --lambda-memory-mb 512 --lambda-duration-ms 200 `
  --dynamo-mode on-demand --dynamo-reads 20000000 --dynamo-writes 2000000 `
  --s3-egress-gb 50 --cf-egress-gb 500
```

Caching & Cost Tips:
- CloudFront: cache assets long (immutable, 1y), `index.html` no‑cache
- API Gateway: consider stage cache for popular idempotent GETs
- DynamoDB: On‑Demand for spiky; Provisioned + autoscaling for steady high throughput
- Use compression (Brotli/Gzip) and avoid large payloads

## Screenshots (Placeholders)

Add screenshots to `docs/screenshots/` and adjust names below:

- ![Admin Dashboard](screenshots/admin-dashboard.png)
- ![Checkout Success](screenshots/checkout-success.png)
- ![CloudWatch Dashboard](screenshots/cloudwatch-dashboard.png)
- ![Step Functions Execution](screenshots/stepfunctions-execution.png)

## Security & Observability Summary

- Security
  - Private S3 with OAI, CloudFront WAF, TLSv1.2_2021
  - Cognito JWT auth; Admin group for privileged routes
  - Least‑privilege IAM for Lambda (see `docs/SECURITY-CHECKLIST.md`)
- Observability
  - CloudWatch dashboard: Lambda errors/duration, Step Functions failed, DynamoDB throttles (`infra/cloudwatch-dashboard.json`)
  - X‑Ray tracing enabled in `template.yaml` (Globals.Function.Tracing: Active)

## References

- `template.yaml` – Full infrastructure as SAM/CloudFormation
- `state-machines/order-processing.asl.json` – Full ASL definition
- `docs/API-README.md`, `docs/api-specification.json` – API details
- `docs/CLOUDFRONT-DEPLOYMENT.md` – CDN config & invalidation
- `docs/SECURITY-CHECKLIST.md`, `docs/XRAY-INTEGRATION.md`
- GitHub Actions: `.github/workflows/`
