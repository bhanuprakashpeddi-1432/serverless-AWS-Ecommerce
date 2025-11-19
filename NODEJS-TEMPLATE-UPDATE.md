# Add this to template.yaml to use Node.js GetProducts handler

## Replace the existing GetProductsFunction with this:

```yaml
  GetProductsFunction:
    Type: AWS::Serverless::Function
    Properties:
      FunctionName: !Sub ${Environment}-ecommerce-get-products
      CodeUri: backend/src/handlers/products/
      Handler: getProducts.handler
      Runtime: nodejs18.x
      Description: List all products with filtering and pagination (Node.js)
      Architectures:
        - x86_64
      Policies:
        - DynamoDBReadPolicy:
            TableName: !Ref ProductsTable
      Events:
        GetProducts:
          Type: HttpApi
          Properties:
            ApiId: !Ref EcommerceHttpApi
            Path: /products
            Method: GET
      Tags:
        Environment: !Ref Environment
```

## Notes:
- Changed `Handler` from `get_products.handler` to `getProducts.handler`
- Changed `Runtime` from global Python to `nodejs18.x`
- Added `Architectures` for clarity
- Keep the same `CodeUri` since both files are in the same directory

## To use both Python and Node.js versions:
You can rename one function (e.g., `GetProductsFunctionNode`) and have both available for testing.
