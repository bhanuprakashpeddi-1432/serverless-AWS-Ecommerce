# 5‑Minute Demo Script

This script guides a tight, end‑to‑end walkthrough: signup → browse → add to cart → checkout (success) → view orders → admin product CRUD → CI/CD deploy.

Assumptions
- You have the deployed CloudFront URL (`https://<dist>.cloudfront.net`) and API URL ready.
- Frontend is configured with Cognito and API env vars (`.env` or injected by the workflow).
- You’re signed in to AWS Console for quick verification if needed.

Timeline (Talk Track + Actions)

0:00 – 0:20 Intro
- Say: “This is a serverless e‑commerce app on AWS: API Gateway + Lambda (Python), DynamoDB, Cognito, Step Functions, S3 + CloudFront, all deployed via SAM and GitHub Actions. I’ll show customer and admin flows, then kick a CI/CD deploy.”
- Action: Open the CloudFront URL in the browser home page.

0:20 – 1:00 Signup & Sign‑in
- Say: “New users can sign up with email; Cognito handles auth and groups.”
- Action: Click Sign Up; register `demo+<timestamp>@example.com` and sign in.
- Optional: If email verification is enabled, use the code; otherwise proceed. Confirm UI shows user logged in (e.g., Profile/Sign out visible).

1:00 – 1:30 Browse Products
- Say: “Products are served from the backend. Let’s browse and open details.”
- Action: Scroll home; click into one product; point out image, price, description; navigate back.

1:30 – 2:00 Add to Cart
- Say: “Cart is per‑user and persisted via APIs.”
- Action: On a product, click Add to Cart; open Cart page; adjust quantity; confirm totals update.

2:00 – 2:40 Checkout (Success)
- Say: “Checkout triggers a Step Functions workflow (validate inventory → process payment → update inventory → send confirmation). In demo, payment is processed in test mode.”
- Action: Go to Checkout. Enter sample data:
  - Email: your signed‑in email (autofilled if available)
  - Address: any valid test values
  - Card: 4242 4242 4242 4242; Exp: 12/34; CVV: 123 (test)
- Click Place Order; show success screen/toast and empty cart.

2:40 – 3:10 View Orders
- Say: “Orders are queryable by user.”
- Action: Open Orders/Profile → Orders; show the new order with total and status.

3:10 – 4:00 Admin Product CRUD
- Say: “Admins manage products. I’ll elevate this user to Admin and perform CRUD.”
- Action (pre‑demo option A): If this user is already in the `Admins` group, go to `/admin`.
- Action (option B quick mention only): In Cognito console, add the user to `Admins` group, then refresh.
- Create: Add product “Demo Mug” price 14.99, image URL, description; save and show it appears in catalog.
- Update: Edit “Demo Mug” price to 12.99 and save; refresh product card to show the change.
- Delete: Remove “Demo Mug”; confirm it disappears from the catalog.

4:00 – 5:00 CI/CD Deploy
- Say: “Both backend (SAM) and frontend are deployed via GitHub Actions with OIDC.”
- Action: Open GitHub → Actions tab in this repo; show `deploy-backend.yml` and `deploy-frontend.yml` workflows.
- Trigger: Click Run workflow for Frontend on `dev` (or push a trivial UI text change).
- Show: Live logs starting; highlight steps: install → build → S3 sync → CloudFront invalidation.
- Wrap: “When this finishes, CloudFront serves the new build, and backend outputs are surfaced from CloudFormation for environment injection.”

Closing (if time permits)
- Mention CloudWatch dashboard, tracing (AWS X‑Ray), and security posture (WAF, least‑privilege IAM, OIDC to AWS).

Backup Commands (PowerShell)
```powershell
# Get backend stack outputs (adjust stack name if needed)
$STACK = "dev-ecommerce-stack"
aws cloudformation describe-stacks --stack-name $STACK --query "Stacks[0].Outputs" --output table

# Quick curl (public products)
curl $(aws cloudformation describe-stacks --stack-name $STACK `
  --query "Stacks[0].Outputs[?OutputKey=='ApiEndpoint'].OutputValue" `
  --output text)/products

# Trigger workflows from CLI (requires GitHub CLI auth)
# Frontend
gh workflow run .github/workflows/deploy-frontend.yml --ref dev
# Backend
gh workflow run .github/workflows/deploy-backend.yml --ref dev --field environment=dev
```

Notes
- If cache delays UI changes, hard refresh (Ctrl+Shift+R). Workflows already invalidate CloudFront on deploy.
- For admin flow on stage demos, pre‑add a user to `Admins` to avoid console switching.
- Payment runs in test/simulated mode; do not use real cards.