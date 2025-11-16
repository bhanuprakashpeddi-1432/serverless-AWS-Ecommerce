# Serverless E-Commerce API - Quick Reference

## Overview

This is a fully serverless e-commerce REST API built on AWS, designed to handle product browsing, shopping cart management, checkout, and order processing. The API uses JWT authentication and supports role-based access control for admin operations.

## Base URL

- **Production**: `https://api.example.com/v1`
- **Development**: `https://api-dev.example.com/v1`

## Authentication

Most endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## Core API Endpoints

### 1. **GET /products**
Browse the product catalog with optional filtering and pagination.

**Query Parameters:**
- `category` - Filter by category (e.g., Electronics)
- `minPrice`, `maxPrice` - Price range filters
- `search` - Search products by name/description
- `limit` - Items per page (default: 20, max: 100)
- `nextToken` - Pagination token

**Response**: Returns product list with pagination support

### 2. **GET /products/{id}**
Get detailed information about a specific product.

**Path Parameter:**
- `id` - Product ID

**Response**: Complete product details including images, pricing, inventory, and ratings

### 3. **POST /products** 🔒 Admin Only
Create a new product in the catalog.

**Authentication Required**: Admin role

**Request Body:**
```json
{
  "name": "Wireless Headphones",
  "description": "Premium noise-cancelling headphones",
  "price": 199.99,
  "currency": "USD",
  "category": "Electronics",
  "subCategory": "Audio",
  "brand": "TechBrand",
  "inventory": 50,
  "sku": "WH-123-BLK",
  "images": ["https://cdn.example.com/img1.jpg"],
  "attributes": {
    "color": "Black",
    "weight": "250g"
  }
}
```

### 4. **POST /cart** 🔒 Authenticated
Add an item to the shopping cart.

**Authentication Required**: Customer

**Request Body:**
```json
{
  "productId": "prod-123",
  "quantity": 2
}
```

**Response**: Updated cart with all items and calculated totals

### 5. **GET /cart** 🔒 Authenticated
Retrieve the current user's shopping cart.

**Authentication Required**: Customer

**Response**: Cart with items, quantities, and calculated totals (subtotal, tax, shipping, total)

### 6. **POST /checkout/start** 🔒 Authenticated
Initiate checkout and process payment.

**Authentication Required**: Customer

**Request Body:**
```json
{
  "paymentMethodId": "pm-1",
  "shippingAddress": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "country": "USA"
  },
  "shippingMethod": "standard"
}
```

**Response**: Order confirmation with order ID, payment status, and estimated delivery

### 7. **GET /orders** 🔒 Authenticated
Get the user's order history.

**Authentication Required**: Customer

**Query Parameters:**
- `status` - Filter by order status (pending, processing, shipped, delivered, cancelled)
- `limit` - Orders per page (default: 10, max: 100)
- `nextToken` - Pagination token

**Response**: List of orders with details and pagination

## Data Models

### Product
Core attributes: productId, name, description, price, currency, category, brand, images, inventory, ratings, status

### Cart
Contains: userId, items array, totals (subtotal, tax, shipping, total), updatedAt

### Order
Includes: orderId, userId, status, items, payment details, shipping info, totals, timestamps

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error description",
  "details": {}
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `201` - Created
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

## DynamoDB Design

The application uses 4 DynamoDB tables with single-table design principles:

1. **Products** - PK: `PRODUCT#<id>`, SK: `METADATA`, with GSIs for category and status queries
2. **Users** - PK: `USER#<id>`, SK: `PROFILE`, with email GSI for authentication
3. **Carts** - PK: `USER#<id>`, SK: `CART`, with TTL for abandoned carts
4. **Orders** - PK: `USER#<id>`, SK: `ORDER#<id>`, with GSIs for status and date queries

## AWS Architecture

**Compute**: AWS Lambda functions for all API operations  
**Database**: DynamoDB for data persistence  
**Authentication**: Amazon Cognito for user management and JWT tokens  
**API Gateway**: RESTful API with request validation and throttling  
**Storage**: S3 + CloudFront for product images  
**Monitoring**: CloudWatch Logs, Metrics, and X-Ray for tracing

## Development Notes

- All prices are stored in floating-point format
- Inventory validation happens during cart operations and checkout
- Shopping carts expire after 30 days of inactivity (DynamoDB TTL)
- Payment processing integrates with external payment gateway (e.g., Stripe)
- Email notifications sent via Amazon SES for order confirmations

## Next Steps

1. Review the complete OpenAPI specification in `api-specification.json`
2. Check detailed architecture documentation in `architecture-design.md`
3. Implement Lambda functions for each endpoint
4. Set up DynamoDB tables with appropriate GSIs
5. Configure API Gateway with Cognito authorizer
6. Deploy infrastructure using AWS SAM, CDK, or Terraform

---

For complete API specification, see [api-specification.json](./api-specification.json)
