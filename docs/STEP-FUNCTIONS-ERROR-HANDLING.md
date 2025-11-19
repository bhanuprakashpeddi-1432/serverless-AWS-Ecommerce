# Step Functions Error Handling & Compensation Guide

## Overview

This document provides comprehensive error handling patterns and retry strategies for the Order Processing State Machine, including compensating actions for failure scenarios.

## Lambda Functions

### Core Workflow Functions
- **CheckInventory** - Validates stock availability
- **ReserveInventory** - Atomically reserves inventory
- **ProcessPayment** - Charges payment via Stripe
- **CreateOrderRecord** - Creates final order record
- **NotifyCustomer** - Sends confirmation email/SMS

### Compensating Functions
- **ReleaseInventory** - Rollback inventory reservations
- **RefundPayment** - Refund Stripe payment

## Error Handling Patterns

### 1. CheckInventory State

**Retry Strategy:**
```json
"Retry": [
  {
    "ErrorEquals": [
      "Lambda.ServiceException",
      "Lambda.AWSLambdaException",
      "Lambda.SdkClientException",
      "Lambda.TooManyRequestsException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  },
  {
    "ErrorEquals": ["States.TaskFailed"],
    "IntervalSeconds": 1,
    "MaxAttempts": 2,
    "BackoffRate": 1.5
  }
]
```

**Catch Strategy:**
- `InsufficientStockError` → **InsufficientInventory** (cancel order)
- `InventoryError` → **InventoryCheckFailed** (fail immediately)
- `States.ALL` → **InventoryCheckFailed** (catch-all)

**Compensation:** None needed (no resources allocated yet)

**Timeout:** 30 seconds

---

### 2. ReserveInventory State

**Retry Strategy:**
```json
"Retry": [
  {
    "ErrorEquals": [
      "ProvisionedThroughputExceededException",
      "ThrottlingException",
      "RequestLimitExceeded"
    ],
    "IntervalSeconds": 1,
    "MaxAttempts": 5,
    "BackoffRate": 2
  },
  {
    "ErrorEquals": [
      "Lambda.ServiceException",
      "Lambda.AWSLambdaException",
      "Lambda.SdkClientException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  }
]
```

**Catch Strategy:**
- `InsufficientStockError` → **InsufficientInventory** (stock changed between check/reserve)
- `InventoryError` → **ReservationFailed** (fail immediately)
- `States.ALL` → **ReservationFailed** (catch-all)

**Compensation:** None needed (DynamoDB transactions are atomic - either all succeed or all fail)

**Timeout:** 30 seconds

**Key Points:**
- Aggressive retry for DynamoDB throttling (5 attempts)
- Uses DynamoDB TransactWriteCommand for atomicity
- Built-in idempotency via `idempotencyId`

---

### 3. ProcessPayment State

**Retry Strategy:**
```json
"Retry": [
  {
    "ErrorEquals": [
      "Lambda.ServiceException",
      "Lambda.AWSLambdaException",
      "Lambda.SdkClientException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 2,
    "BackoffRate": 2
  },
  {
    "ErrorEquals": ["States.Timeout"],
    "IntervalSeconds": 5,
    "MaxAttempts": 1
  }
]
```

**Catch Strategy:**
- `PaymentDeclined`, `InsufficientFunds`, `CardError` → **ReleaseReservedInventory**
- `PaymentFailed` → **ReleaseReservedInventory**
- `States.ALL` → **ReleaseReservedInventory**

**Compensation:** **ReleaseInventory** Lambda
- Releases reserved inventory atomically
- Updates reservation status to 'released'
- Graceful error handling (logs warnings but doesn't fail)

**Timeout:** 60 seconds

**Key Points:**
- **LIMITED RETRIES** to avoid duplicate charges (max 2 attempts)
- Stripe idempotency via `idempotencyKey`
- All payment failures trigger inventory release
- Payment Lambda uses Stripe Secrets Manager

**Example Payment Error Flow:**
```
ProcessPayment (PaymentDeclined)
  ↓
ReleaseReservedInventory (compensate)
  ↓
PaymentFailedFinal (fail gracefully)
```

---

### 4. CreateOrderRecord State

**Retry Strategy:**
```json
"Retry": [
  {
    "ErrorEquals": [
      "ProvisionedThroughputExceededException",
      "ThrottlingException"
    ],
    "IntervalSeconds": 1,
    "MaxAttempts": 5,
    "BackoffRate": 2
  },
  {
    "ErrorEquals": [
      "Lambda.ServiceException",
      "Lambda.AWSLambdaException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  }
]
```

**Catch Strategy:**
- `OrderRecordError` → **RefundPaymentAndRelease** (parallel compensation)
- `States.ALL` → **RefundPaymentAndRelease** (critical failure)

**Compensation:** **RefundPaymentAndRelease** Parallel State
- Executes **RefundPayment** and **ReleaseInventory** in parallel
- Both branches have independent retry logic
- Continues even if compensation fails (logs for manual review)

**Timeout:** 30 seconds

**Key Points:**
- **CRITICAL STATE** - payment already charged
- Failure requires both refund AND inventory release
- Uses parallel execution for faster compensation
- Creates order with status 'CONFIRMED'
- Handles duplicate orders (conditional put → update fallback)

**Example Critical Error Flow:**
```
CreateOrderRecord (OrderRecordError)
  ↓
RefundPaymentAndRelease (parallel)
  ├─ RefundPayment (Stripe refund)
  └─ ReleaseInventory (atomic rollback)
  ↓
OrderFailedWithCompensation (logged)
```

---

### 5. NotifyCustomer State

**Retry Strategy:**
```json
"Retry": [
  {
    "ErrorEquals": [
      "Lambda.ServiceException",
      "Lambda.AWSLambdaException"
    ],
    "IntervalSeconds": 2,
    "MaxAttempts": 3,
    "BackoffRate": 2
  },
  {
    "ErrorEquals": ["Throttling"],
    "IntervalSeconds": 5,
    "MaxAttempts": 4,
    "BackoffRate": 2
  }
]
```

**Catch Strategy:**
- `States.ALL` → **OrderSuccess** (continue anyway)

**Compensation:** None - order already confirmed

**Timeout:** 45 seconds

**Key Points:**
- **NON-CRITICAL** - order already created and paid
- Notification failure doesn't fail the order
- Error logged to `$.notificationError` for monitoring
- Supports both email (SES) and SMS (SNS)
- Lambda returns success even if notification fails

---

## Compensation Workflows

### ReleaseInventory Lambda

**Purpose:** Rollback inventory reservations

**Features:**
- Queries active reservations if items not provided
- Atomic transaction to increment stock + update status
- **Graceful failure** - logs warnings but returns success
- Idempotency via `idempotencyId`
- 7-day idempotency cache

**Usage Scenarios:**
1. Payment failed → release reserved stock
2. Order creation failed → release as part of compensation
3. Manual rollback (operational)

**Example Invocation:**
```json
{
  "orderId": "ORDER#123",
  "items": [{"productId": "456", "quantity": 2}],
  "action": "release",
  "idempotencyId": "ORDER#123-release"
}
```

---

### RefundPayment Lambda

**Purpose:** Refund Stripe payments

**Features:**
- Fetches Stripe secret from Secrets Manager
- Creates Stripe refund via PaymentIntent
- Handles partial and full refunds
- Idempotency support
- Detects already-refunded payments

**Error Handling:**
```javascript
// Stripe-specific errors mapped to application errors
- 'StripeCardError' → RefundFailed
- 'charge_already_refunded' → Success (idempotent)
```

**Usage Scenarios:**
1. Order creation failed after payment
2. Manual refund (customer service)
3. Automated refund (cancellation workflow)

**Example Invocation:**
```json
{
  "orderId": "ORDER#123",
  "paymentIntentId": "pi_ABC123",
  "amount": 129.57,
  "reason": "Order processing failed",
  "idempotencyKey": "ORDER#123-refund"
}
```

---

## Parallel Compensation Pattern

The **RefundPaymentAndRelease** state demonstrates the parallel compensation pattern:

```json
{
  "Type": "Parallel",
  "Branches": [
    {
      "StartAt": "RefundPayment",
      "States": { /* Refund branch */ }
    },
    {
      "StartAt": "ReleaseInventory",
      "States": { /* Release branch */ }
    }
  ]
}
```

**Benefits:**
- Faster compensation (parallel execution)
- Independent retry logic per branch
- Either branch can fail without blocking the other
- Results merged into `$.compensation`

**Timeout:** 120 seconds (allows both branches to complete with retries)

---

## Order Status Flow

### Success Path
```
CheckInventory → ReserveInventory → ProcessPayment → CreateOrderRecord → NotifyCustomer → OrderSuccess
```

### Failure Paths

**1. Inventory Unavailable (No Compensation)**
```
CheckInventory (InsufficientStockError)
  ↓
InsufficientInventory
  ↓
OrderFailedFinal (status: CANCELLED)
```

**2. Payment Failed (Release Inventory)**
```
ProcessPayment (PaymentDeclined)
  ↓
ReleaseReservedInventory
  ↓
PaymentFailedFinal (status: FAILED)
```

**3. Order Creation Failed (Full Compensation)**
```
CreateOrderRecord (OrderRecordError)
  ↓
RefundPaymentAndRelease (parallel)
  ├─ RefundPayment
  └─ ReleaseInventory
  ↓
OrderFailedWithCompensation (status: FAILED_COMPENSATED)
```

**4. Notification Failed (Continue Anyway)**
```
NotifyCustomer (error)
  ↓
OrderSuccess (status: CONFIRMED, notificationError logged)
```

---

## Retry Guidelines

### Conservative Retry (Payment Operations)
- **Max 2 attempts** to avoid duplicate charges
- Idempotency keys required
- Longer intervals (2-5 seconds)

### Aggressive Retry (Read Operations)
- **Max 3-5 attempts** for transient failures
- Shorter intervals (1-2 seconds)
- Exponential backoff (2x)

### Throttling Retry (DynamoDB)
- **Max 5 attempts** for throughput exceptions
- Fast backoff (1 second initial)
- High backoff rate (2x)

### No Retry (Business Errors)
- `InsufficientStockError` - immediate failure
- `PaymentDeclined` - don't retry, compensate
- `OrderRecordError` - compensate immediately

---

## Idempotency Strategy

All critical operations support idempotency:

1. **ReserveInventory**: `idempotencyId` → 7-day cache in DynamoDB
2. **ProcessPayment**: `idempotencyKey` → Stripe idempotency
3. **ReleaseInventory**: `idempotencyId-release` → 7-day cache
4. **RefundPayment**: `idempotencyId-refund` → 7-day cache

**Format:** `{orderId}-{operation}`

**Example:**
```
orderId: "ORDER#1234567890-abc123"
Reserve: "ORDER#1234567890-abc123"
Release: "ORDER#1234567890-abc123-release"
Refund: "ORDER#1234567890-abc123-refund"
```

---

## Testing Error Scenarios

### Test Insufficient Inventory
```bash
# Modify test event to request unavailable quantity
{
  "items": [{"productId": "123", "quantity": 9999}]
}
```

### Test Payment Decline
```bash
# Use Stripe test card for declined payment
{
  "paymentMethodId": "pm_card_chargeDeclined"
}
```

### Test DynamoDB Throttling
```bash
# Set low provisioned capacity and run concurrent executions
# Watch retry pattern with 5 attempts
```

### Test Compensation
```bash
# Manually trigger error in CreateOrderRecord
# Verify parallel RefundPaymentAndRelease execution
```

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Compensation Rate**
   - RefundPayment invocations / total orders
   - Target: <1%

2. **Retry Rate**
   - States with retries / total executions
   - Target: <5%

3. **Timeout Rate**
   - Timeout errors / total executions
   - Target: <0.1%

4. **Critical Failures**
   - OrderFailedCritical count
   - Alert: >0 (requires manual review)

5. **Notification Failures**
   - Orders with notificationError
   - Alert: >10% (check SES/SNS)

### CloudWatch Alarms

```bash
# Critical: Compensation failure
aws cloudwatch put-metric-alarm \
  --alarm-name order-compensation-failures \
  --metric-name ExecutionsFailed \
  --namespace AWS/States \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanThreshold

# Warning: High retry rate
aws cloudwatch put-metric-alarm \
  --alarm-name order-high-retry-rate \
  --metric-name ExecutionsAborted \
  --namespace AWS/States \
  --statistic Sum \
  --period 3600 \
  --evaluation-periods 1 \
  --threshold 50 \
  --comparison-operator GreaterThanThreshold
```

---

## Production Checklist

- [ ] Configure Stripe webhook for payment confirmation
- [ ] Set up CloudWatch alarms for compensation failures
- [ ] Test all error paths in staging environment
- [ ] Verify idempotency with duplicate executions
- [ ] Configure SES production access (exit sandbox)
- [ ] Set appropriate Lambda timeouts and memory
- [ ] Enable X-Ray tracing for debugging
- [ ] Create runbook for manual compensation
- [ ] Set up DynamoDB auto-scaling for traffic spikes
- [ ] Configure dead-letter queues for failed executions

---

## Summary

The order processing workflow implements a robust error handling strategy:

✅ **Automatic Retries** with exponential backoff for transient failures  
✅ **Compensating Transactions** for payment/inventory rollback  
✅ **Parallel Compensation** for faster recovery  
✅ **Idempotency** to prevent duplicate operations  
✅ **Graceful Degradation** (notifications don't fail orders)  
✅ **Multiple Safety Nets** with catch-all error handlers  
✅ **Detailed Logging** for debugging and monitoring  

The workflow ensures that:
- Customers are never double-charged
- Inventory is never double-reserved
- Payment failures properly release inventory
- Order creation failures trigger full compensation
- Non-critical failures (notifications) don't impact order success
