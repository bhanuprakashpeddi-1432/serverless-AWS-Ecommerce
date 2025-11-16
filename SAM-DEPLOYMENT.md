# AWS SAM Template - Deployment Guide

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS SAM CLI installed (`pip install aws-sam-cli`)
- Python 3.11 or later
- Docker (for local testing)

## Quick Start

### 1. Build the application

```bash
sam build
```

### 2. Deploy to AWS

For first-time deployment:

```bash
sam deploy --guided
```

Follow the prompts:
- **Stack Name**: `dev-ecommerce-stack`
- **AWS Region**: Your preferred region (e.g., `us-east-1`)
- **Parameter Environment**: `dev`
- **Confirm changes before deploy**: Y
- **Allow SAM CLI IAM role creation**: Y
- **Save arguments to configuration file**: Y

For subsequent deployments:

```bash
sam deploy
```

### 3. Get API Endpoint

After deployment, find the API endpoint in the outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name dev-ecommerce-stack \
  --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
  --output text
```

## Local Development

### Test Lambda functions locally

```bash
sam local start-api
```

This starts a local API Gateway at `http://127.0.0.1:3000`

### Invoke a specific function

```bash
sam local invoke GetProductsFunction -e events/get-products.json
```

### Generate sample events

```bash
sam local generate-event apigateway http-api-proxy > events/sample-event.json
```

## Project Structure

```
├── template.yaml                 # SAM template (main infrastructure)
├── backend/
│   ├── openapi.yaml             # API specification
│   └── src/
│       └── handlers/
│           ├── products/        # Product Lambda handlers
│           ├── cart/            # Cart Lambda handlers
│           ├── checkout/        # Checkout Lambda handlers
│           ├── orders/          # Order Lambda handlers
│           └── workflows/       # Step Functions Lambda handlers
├── state-machines/
│   └── order-processing.asl.json  # Step Functions definition
├── frontend/                    # Frontend application
└── tests/                       # Test files
```

## Environment Variables

Lambda functions automatically receive:
- `PRODUCTS_TABLE`: DynamoDB Products table name
- `USERS_TABLE`: DynamoDB Users table name
- `CARTS_TABLE`: DynamoDB Carts table name
- `ORDERS_TABLE`: DynamoDB Orders table name
- `POWERTOOLS_SERVICE_NAME`: Service name for AWS Lambda Powertools
- `LOG_LEVEL`: Logging level (INFO by default)

## Key Resources Created

### DynamoDB Tables (Pay-per-request)
- **Products**: Product catalog with category and status GSIs
- **Users**: User profiles with email lookup GSI
- **Carts**: Shopping carts with TTL for auto-cleanup
- **Orders**: Order history with status and date GSIs

### Lambda Functions
- **GetProductsFunction**: List products with filtering
- **GetProductFunction**: Get single product details
- **CreateProductFunction**: Create product (admin)
- **UpdateProductFunction**: Update product (admin)
- **DeleteProductFunction**: Delete product (admin)
- **GetCartFunction**: Get user's cart
- **AddToCartFunction**: Add item to cart
- **UpdateCartItemFunction**: Update cart item quantity
- **RemoveFromCartFunction**: Remove item from cart
- **ClearCartFunction**: Clear entire cart
- **StartCheckoutFunction**: Start checkout and create order
- **GetOrdersFunction**: Get order history
- **GetOrderFunction**: Get single order details
- **ValidateInventoryFunction**: Validate inventory (Step Functions)
- **ProcessPaymentFunction**: Process payment (Step Functions)
- **UpdateInventoryFunction**: Update inventory (Step Functions)
- **SendOrderConfirmationFunction**: Send email confirmation (Step Functions)

### API Gateway
- **HTTP API** with Cognito authorizer
- CORS enabled
- OpenAPI 3.0 specification

### Step Functions
- **OrderProcessingStateMachine**: Orchestrates order workflow
  1. Validate inventory
  2. Process payment
  3. Update inventory
  4. Update order status
  5. Send confirmation email

### Cognito
- **User Pool**: User authentication
- **User Pool Client**: Web application client
- **Admin Group**: Administrator users
- **Customer Group**: Regular customers

### S3 Buckets
- **FrontendBucket**: Frontend static files (private)
- **ProductImagesBucket**: Product images (private, CloudFront access)

### CloudFront
- **Distribution**: CDN for frontend with custom error pages

## Stack Outputs

After deployment, the following outputs are available:

- **ApiEndpoint**: API Gateway base URL
- **ApiId**: API Gateway ID
- **FrontendBucketName**: S3 bucket for frontend
- **FrontendDistributionDomain**: CloudFront domain
- **FrontendDistributionId**: CloudFront distribution ID
- **ProductImagesBucketName**: S3 bucket for images
- **ProductsTableName**: DynamoDB Products table
- **UsersTableName**: DynamoDB Users table
- **CartsTableName**: DynamoDB Carts table
- **OrdersTableName**: DynamoDB Orders table
- **UserPoolId**: Cognito User Pool ID
- **UserPoolClientId**: Cognito User Pool Client ID
- **StateMachineArn**: Step Functions state machine ARN
- **Region**: AWS Region

## Costs

With pay-per-request billing:
- **DynamoDB**: $1.25 per million writes, $0.25 per million reads
- **Lambda**: $0.20 per million requests + compute time
- **API Gateway**: $1.00 per million requests
- **Step Functions**: $25 per million state transitions
- **S3**: $0.023 per GB storage + data transfer
- **CloudFront**: $0.085 per GB (first 10TB)
- **Cognito**: Free for first 50,000 MAUs

## Cleanup

To delete all resources:

```bash
sam delete
```

Or via CloudFormation:

```bash
aws cloudformation delete-stack --stack-name dev-ecommerce-stack
```

**Note**: S3 buckets must be empty before deletion.

## Security Best Practices

1. **Enable MFA** for Cognito users in production
2. **Use Secrets Manager** for payment gateway API keys
3. **Enable CloudTrail** for audit logging
4. **Configure WAF** for API Gateway in production
5. **Review IAM policies** and apply least privilege
6. **Enable VPC endpoints** for DynamoDB to avoid internet traffic
7. **Configure custom domain** with ACM certificate for HTTPS

## Monitoring

- **CloudWatch Logs**: All Lambda functions log to CloudWatch
- **X-Ray**: Distributed tracing enabled for all functions
- **CloudWatch Alarms**: Set up alarms for error rates and latency
- **DynamoDB Insights**: Monitor table performance
- **API Gateway Metrics**: Track request count, latency, errors

## Next Steps

1. Implement Lambda function code in `backend/src/handlers/`
2. Create Cognito users and test authentication
3. Seed initial products into DynamoDB
4. Deploy frontend to S3 and CloudFront
5. Set up CI/CD pipeline with GitHub Actions or CodePipeline
6. Configure custom domain name
7. Set up monitoring and alerting
8. Implement integration tests
9. Configure backup and disaster recovery

## Support

For issues or questions, refer to:
- [AWS SAM Documentation](https://docs.aws.amazon.com/serverless-application-model/)
- [AWS Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [DynamoDB Documentation](https://docs.aws.amazon.com/dynamodb/)
