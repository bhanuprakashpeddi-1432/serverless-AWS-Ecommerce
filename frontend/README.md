# E-Commerce Frontend

React (Vite) application for the serverless e-commerce platform.

## Tech Stack

- **React 18** with Vite
- **React Router v6** for routing
- **Axios** for API calls
- **Amazon Cognito** for authentication
- **CSS3** for styling

## Project Structure

```
frontend/
├── src/
│   ├── components/          # Shared components
│   │   ├── Header.jsx       # Navigation header
│   │   ├── Footer.jsx       # Footer component
│   │   ├── ProductCard.jsx  # Product display card
│   │   ├── CartSummary.jsx  # Cart summary/totals
│   │   └── AuthProvider.jsx # Cognito authentication wrapper
│   ├── pages/              # Page components
│   │   ├── Home.jsx        # Product listing page
│   │   ├── ProductDetail.jsx # Single product view
│   │   ├── Cart.jsx        # Shopping cart
│   │   ├── Checkout.jsx    # Checkout form
│   │   ├── Profile.jsx     # User profile & orders
│   │   └── Admin.jsx       # Admin dashboard
│   ├── services/           # API services
│   │   └── api.js          # Axios configuration & API calls
│   ├── config/             # Configuration
│   │   └── env.js          # Environment variables
│   ├── App.jsx             # Main app with routes
│   ├── main.jsx            # App entry point
│   └── index.css           # Global styles
├── package.json
├── vite.config.js
├── index.html
└── .env.example
```

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your values:
   ```
   VITE_API_BASE_URL=https://your-api-gateway-url.com
   VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
   VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
   VITE_COGNITO_REGION=us-east-1
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```

   App will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint

## Pages

### Home (`/`)
- Displays all products in a grid
- Fetches from `GET /products`
- Each product is a clickable card

### Product Detail (`/products/:id`)
- Shows detailed product information
- Add to cart functionality
- Fetches from `GET /products/{id}`

### Cart (`/cart`)
- View all cart items
- Update quantities
- Remove items
- Clear entire cart
- Uses Cart API endpoints

### Checkout (`/checkout`)
- Shipping address form
- Payment information
- Creates order via `POST /checkout`

### Profile (`/profile`)
- User account information
- Order history
- Fetches from `GET /orders`

### Admin (`/admin`)
- Product management (CRUD)
- View all products in table
- Add/Edit/Delete products

## API Service

The `api.js` service provides:
- Axios instance with base URL
- Request interceptor for auth tokens
- Response interceptor for error handling
- API methods organized by resource:
  - `productsApi` - Product CRUD operations
  - `cartApi` - Cart management
  - `ordersApi` - Order operations

## Authentication

The `AuthProvider` component wraps the app and provides:
- AWS Cognito integration
- `signIn(username, password)` - User login
- `signUp(username, password, email, name)` - User registration
- `signOut()` - User logout
- `checkAuth()` - Verify current session
- `user` - Current user object
- `loading` - Auth loading state

Access auth via the `useAuth()` hook:
```jsx
const { user, signIn, signOut } = useAuth()
```

## Environment Variables

All environment variables must be prefixed with `VITE_` to be accessible in the app via `import.meta.env`:

- `VITE_API_BASE_URL` - Backend API URL
- `VITE_COGNITO_USER_POOL_ID` - Cognito User Pool ID
- `VITE_COGNITO_CLIENT_ID` - Cognito App Client ID
- `VITE_COGNITO_REGION` - AWS Region

## Building for Production

```bash
npm run build
```

Creates optimized production build in `dist/` directory.

## Deployment

The built files in `dist/` can be deployed to:
- AWS S3 + CloudFront
- Vercel
- Netlify
- Any static hosting service

Make sure to configure environment variables in your hosting platform.
