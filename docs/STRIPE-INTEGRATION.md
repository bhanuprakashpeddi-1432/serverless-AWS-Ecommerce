# Stripe Payment Integration Setup Guide

## Prerequisites

### 1. Get Stripe API Keys
1. Sign up for Stripe account at https://stripe.com
2. Navigate to Developers → API Keys
3. Copy your Secret Key (starts with `sk_test_` or `sk_live_`)

### 2. Store in AWS Secrets Manager

#### Option A: Using AWS Console
1. Go to AWS Secrets Manager
2. Click "Store a new secret"
3. Choose "Other type of secret"
4. Add key-value pair:
   - Key: `STRIPE_SECRET_KEY`
   - Value: `sk_test_...` (your secret key)
5. Name: `ecommerce/stripe/secret-key`
6. Save

#### Option B: Using AWS CLI
```powershell
aws secretsmanager create-secret `
  --name ecommerce/stripe/secret-key `
  --description "Stripe API Secret Key for payment processing" `
  --secret-string '{\"STRIPE_SECRET_KEY\":\"sk_test_your_key_here\"}'
```

### 3. Grant Lambda Permissions

Add to your Lambda execution role:
```json
{
  "Effect": "Allow",
  "Action": [
    "secretsmanager:GetSecretValue"
  ],
  "Resource": "arn:aws:secretsmanager:*:*:secret:ecommerce/stripe/secret-key*"
}
```

Or in SAM template:
```yaml
Policies:
  - AWSSecretsManagerGetSecretValuePolicy:
      SecretArn: !Sub 'arn:aws:secretsmanager:${AWS::Region}:${AWS::AccountId}:secret:ecommerce/stripe/secret-key*'
```

## Testing Payment Processing

### Test Card Numbers (Stripe Test Mode)

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Successful payment |
| 4000 0025 0000 3155 | Requires 3D Secure authentication |
| 4000 0000 0000 9995 | Declined - insufficient funds |
| 4000 0000 0000 0002 | Declined - card declined |
| 4000 0000 0000 0069 | Expired card |
| 4000 0000 0000 0127 | Incorrect CVC |

### Local Testing

```powershell
# Set environment variable for local testing
$env:STRIPE_SECRET_KEY = "sk_test_your_key_here"

# Invoke function
sam local invoke ProcessPaymentFunction --event events/process-payment.json
```

### Testing 3D Secure Flow

Event file for 3DS testing:
```json
{
  "orderId": "ORDER#test-3ds",
  "amount": 50.00,
  "paymentMethodId": "pm_card_threeDSecure2Required"
}
```

Expected response:
```json
{
  "success": false,
  "status": "requires_action",
  "requires3DS": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "nextAction": {
    "type": "use_stripe_sdk"
  }
}
```

## Integration in Frontend

### Install Stripe.js
```bash
npm install @stripe/stripe-js
```

### Handle 3D Secure
```javascript
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_your_publishable_key');

// If payment requires action
if (response.requires3DS) {
  const { error, paymentIntent } = await stripe.confirmCardPayment(
    response.clientSecret
  );
  
  if (error) {
    // Handle error
  } else if (paymentIntent.status === 'succeeded') {
    // Payment completed after 3DS
  }
}
```

## Error Handling

### Error Names Returned
- `PaymentDeclined` - Card declined, expired, or incorrect details
- `InsufficientFunds` - Card has insufficient funds
- `PaymentFailed` - Generic payment failure
- `PaymentGatewayTimeout` - Stripe service timeout (retryable)

### Retry Strategy in Step Functions
```json
{
  "Retry": [
    {
      "ErrorEquals": ["PaymentGatewayTimeout"],
      "MaxAttempts": 2,
      "BackoffRate": 2.0
    }
  ],
  "Catch": [
    {
      "ErrorEquals": ["PaymentDeclined", "InsufficientFunds"],
      "Next": "PaymentFailedState"
    }
  ]
}
```

## Idempotency

The handler uses Stripe's idempotency keys to prevent duplicate charges:
- Format: `{orderId}-{timestamp}` or custom key
- Stripe stores results for 24 hours
- Retries with same key return cached result
- Prevents double charging on retries

## Production Checklist

- [ ] Replace test API key with live key in Secrets Manager
- [ ] Enable Stripe webhook for payment updates
- [ ] Implement payment confirmation webhook handler
- [ ] Add logging and monitoring (CloudWatch, Stripe Dashboard)
- [ ] Set up fraud detection rules in Stripe Dashboard
- [ ] Configure payment methods (cards, wallets, etc.)
- [ ] Test refund scenarios
- [ ] Implement payment dispute handling
- [ ] Set up PCI compliance requirements
- [ ] Add payment receipt generation

## Webhook Integration (Optional)

Create webhook handler for payment events:
```javascript
// Handle payment_intent.succeeded, payment_intent.failed
const webhookSecret = 'whsec_...';
const sig = event.headers['stripe-signature'];
const stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret);
```

## Environment Variables

- `STRIPE_SECRET_NAME` - Secrets Manager key name (default: `ecommerce/stripe/secret-key`)
- `STRIPE_SECRET_KEY` - Direct secret key (fallback for local testing)

## Monitoring

Track these metrics:
- Payment success rate
- Payment failure reasons
- 3DS authentication rate
- Average payment processing time
- Failed payments by error type

## Security Best Practices

1. Never log full payment method details
2. Use Secrets Manager for API keys (not environment variables in production)
3. Rotate API keys periodically
4. Enable Stripe Radar for fraud detection
5. Implement rate limiting
6. Validate amounts server-side
7. Use HTTPS only
8. Implement webhook signature verification
