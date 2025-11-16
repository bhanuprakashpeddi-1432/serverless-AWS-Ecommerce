# Serverless E-Commerce Application - Architecture Design

## 1. Feature List for v1

### Customer Features
- **Browse Products**: List all products with pagination, filtering, and search
- **Product Detail**: View detailed product information, images, pricing, and inventory
- **Shopping Cart**: Add/remove items, update quantities, view cart totals
- **Checkout**: Secure payment processing, order confirmation, email notifications
- **Order History**: View past orders, track order status, download invoices
- **Authentication**: User registration, login, password reset, JWT-based auth

### Admin Features
- **Product Management**: Create, read, update, delete products
- **Inventory Management**: Track stock levels, update availability
- **Order Management**: View all orders, update order status
- **User Management**: View user accounts, manage permissions

## 2. DynamoDB Table Designs

### Table 1: Products
**Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

```json
{
  "PK": "PRODUCT#<productId>",
  "SK": "METADATA",
  "productId": "prod-123",
  "name": "Wireless Headphones",
  "description": "Premium noise-cancelling wireless headphones",
  "price": 199.99,
  "currency": "USD",
  "category": "Electronics",
  "subCategory": "Audio",
  "brand": "TechBrand",
  "images": ["https://cdn.example.com/img1.jpg", "https://cdn.example.com/img2.jpg"],
  "inventory": 50,
  "sku": "WH-123-BLK",
  "attributes": {
    "color": "Black",
    "weight": "250g",
    "batteryLife": "30 hours"
  },
  "ratings": {
    "average": 4.5,
    "count": 128
  },
  "status": "active",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-11-17T08:20:00Z"
}
```

**GSI-1 (Category Index)**:
- **PK**: `GSI1PK` = `CATEGORY#<category>`
- **SK**: `GSI1SK` = `<price>#<productId>`
- Use case: Query products by category, sorted by price

**GSI-2 (Status Index)**:
- **PK**: `GSI2PK` = `STATUS#<status>`
- **SK**: `GSI2SK` = `<createdAt>`
- Use case: Admin queries for active/inactive products

### Table 2: Users
**Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

```json
{
  "PK": "USER#<userId>",
  "SK": "PROFILE",
  "userId": "user-456",
  "email": "customer@example.com",
  "passwordHash": "$2b$10$...",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "role": "customer",
  "addresses": [
    {
      "id": "addr-1",
      "type": "shipping",
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "isDefault": true
    }
  ],
  "paymentMethods": [
    {
      "id": "pm-1",
      "type": "card",
      "last4": "4242",
      "brand": "visa",
      "expiryMonth": 12,
      "expiryYear": 2026,
      "isDefault": true
    }
  ],
  "status": "active",
  "createdAt": "2025-01-10T14:20:00Z",
  "lastLogin": "2025-11-17T09:15:00Z"
}
```

**GSI-1 (Email Index)**:
- **PK**: `GSI1PK` = `EMAIL#<email>`
- **SK**: `GSI1SK` = `USER#<userId>`
- Use case: Login by email, user lookup

### Table 3: Carts
**Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

```json
{
  "PK": "USER#<userId>",
  "SK": "CART",
  "userId": "user-456",
  "items": [
    {
      "productId": "prod-123",
      "productName": "Wireless Headphones",
      "quantity": 2,
      "price": 199.99,
      "currency": "USD",
      "imageUrl": "https://cdn.example.com/img1.jpg",
      "addedAt": "2025-11-16T15:30:00Z"
    },
    {
      "productId": "prod-789",
      "productName": "USB-C Cable",
      "quantity": 3,
      "price": 12.99,
      "currency": "USD",
      "imageUrl": "https://cdn.example.com/img3.jpg",
      "addedAt": "2025-11-17T10:00:00Z"
    }
  ],
  "totals": {
    "subtotal": 438.95,
    "tax": 35.12,
    "shipping": 9.99,
    "total": 484.06,
    "currency": "USD"
  },
  "updatedAt": "2025-11-17T10:00:00Z",
  "expiresAt": 1734451200
}
```

**TTL Attribute**: `expiresAt` (automatically delete abandoned carts after 30 days)

### Table 4: Orders
**Primary Key**: `PK` (Partition Key), `SK` (Sort Key)

```json
{
  "PK": "USER#<userId>",
  "SK": "ORDER#<orderId>",
  "orderId": "ord-7890",
  "userId": "user-456",
  "status": "processing",
  "items": [
    {
      "productId": "prod-123",
      "productName": "Wireless Headphones",
      "quantity": 2,
      "price": 199.99,
      "currency": "USD",
      "imageUrl": "https://cdn.example.com/img1.jpg"
    }
  ],
  "payment": {
    "method": "card",
    "transactionId": "ch_3abc123",
    "status": "completed",
    "amount": 484.06,
    "currency": "USD"
  },
  "shipping": {
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA"
    },
    "method": "standard",
    "cost": 9.99,
    "trackingNumber": "1Z999AA10123456784",
    "estimatedDelivery": "2025-11-22T00:00:00Z"
  },
  "totals": {
    "subtotal": 438.95,
    "tax": 35.12,
    "shipping": 9.99,
    "total": 484.06,
    "currency": "USD"
  },
  "createdAt": "2025-11-17T11:30:00Z",
  "updatedAt": "2025-11-17T11:35:00Z"
}
```

**GSI-1 (Order Status Index)**:
- **PK**: `GSI1PK` = `STATUS#<status>`
- **SK**: `GSI1SK` = `<createdAt>#<orderId>`
- Use case: Admin queries for orders by status

**GSI-2 (Order Date Index)**:
- **PK**: `GSI2PK` = `ORDER`
- **SK**: `GSI2SK` = `<createdAt>#<orderId>`
- Use case: Admin queries for all orders sorted by date

## 3. Additional Considerations

### Security
- JWT tokens for authentication
- API Gateway with IAM/Cognito authorization
- Encryption at rest for DynamoDB
- HTTPS only for all endpoints

### Scalability
- DynamoDB on-demand billing for variable workloads
- Lambda for compute with auto-scaling
- CloudFront CDN for product images
- ElastiCache for frequently accessed product data

### Monitoring
- CloudWatch logs and metrics
- X-Ray for distributed tracing
- Custom metrics for business KPIs (orders, revenue)
- Alarms for error rates and latency
