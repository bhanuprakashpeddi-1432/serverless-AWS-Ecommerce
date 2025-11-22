# Demo Application Credentials

## Application URLs
- **Frontend**: http://localhost:3000
- **API Gateway**: https://b4885kyrch.execute-api.us-east-1.amazonaws.com

## Admin Access
- **Email**: admin@email.com
- **Password**: Admin123!

## Available Pages

### Public Pages (No login required)
- **Home** (`/`) - Browse all products
- **Product Detail** (`/products/:id`) - View individual product details
- **Cart** (`/cart`) - View shopping cart
- **Login** (`/login`) - Sign in or create new account

### Protected Pages (Login required)
- **Profile** (`/profile`) - View account info and order history
- **Checkout** (`/checkout`) - Complete purchase

### Admin Pages (Admin role required)
- **Admin Dashboard** (`/admin`) - Manage products (add, edit, delete)

## Testing the Application

1. **Start Frontend** (if not running):
   ```powershell
   cd frontend
   npm run dev
   ```

2. **Access the Application**:
   - Open http://localhost:3000 in your browser
   - Click "Sign In" button in header
   - Use admin credentials above

3. **Test User Flows**:
   - Browse products on home page
   - Click on a product to view details
   - Add items to cart
   - Sign in with admin credentials
   - Access Admin page to manage products
   - View Profile page for account info

## DynamoDB Products
The following test products are available:
1. Wireless Headphones - $99.99
2. Smart Watch - $199.99
3. Laptop Backpack - $49.99
4. USB-C Cable - $14.99
5. Wireless Mouse - $29.99

## Architecture
- **Backend**: AWS Lambda (Python 3.11) + API Gateway HTTP API
- **Frontend**: React + Vite
- **Database**: DynamoDB (single-table design)
- **Auth**: Amazon Cognito
- **Region**: us-east-1
