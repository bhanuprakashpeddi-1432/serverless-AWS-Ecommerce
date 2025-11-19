# Postman Collection: Ecommerce API

Import `Ecommerce.postman_collection.json` into Postman, set the variables in the collection (gear icon → Variables):

- `apiBaseUrl`: API Gateway base URL (from stack output `ApiEndpoint`)
- `region`: e.g., `us-east-1`
- `cognitoClientId`: Cognito User Pool App Client ID
- `username` / `password` / `email`: test user creds
- `productId`: an existing product ID (e.g., `PRODUCT#<id>`)

Flow:
1. Run "Auth - SignUp" (first time only). Confirm the user if pool requires it.
2. Run "Auth - InitiateAuth (Login)" → stores `idToken`, `accessToken` into collection variables.
3. Run "Products - GetProducts".
4. Run "Cart - Add Item".
5. Run "Checkout - Start".

Notes:
- If SignUp requires confirmation, confirm in AWS Console or add a ConfirmSignUp request.
- You can chain the requests in a Postman collection runner.
