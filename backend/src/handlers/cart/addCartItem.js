const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variables
const CARTS_TABLE = process.env.CARTS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Extract user ID from JWT token set by API Gateway authorizer
 */
const getUserIdFromEvent = (event) => {
    // API Gateway HTTP API authorizer sets claims in requestContext.authorizer.jwt.claims
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    
    if (!claims) {
        throw new Error('No authorization claims found');
    }

    // Cognito sets the user ID in 'sub' claim
    const userId = claims.sub || claims['cognito:username'];
    
    if (!userId) {
        throw new Error('User ID not found in token');
    }

    return userId;
};

/**
 * Lambda handler to add item to cart
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variables
        if (!CARTS_TABLE) {
            throw new Error('CARTS_TABLE environment variable is not set');
        }
        if (!PRODUCTS_TABLE) {
            throw new Error('PRODUCTS_TABLE environment variable is not set');
        }

        // Extract user ID from JWT
        const userId = getUserIdFromEvent(event);
        console.log('User ID from JWT:', userId);

        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch (error) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Invalid JSON in request body'
                })
            };
        }

        const { productId, quantity = 1 } = body;

        // Validate required fields
        if (!productId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Product ID is required'
                })
            };
        }

        // Validate quantity
        if (quantity < 1 || !Number.isInteger(quantity)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Quantity must be a positive integer'
                })
            };
        }

        // Verify product exists and get product details
        const productKey = {
            PK: `PRODUCT#${productId}`,
            SK: `PRODUCT#${productId}`
        };

        const getProductCommand = new GetCommand({
            TableName: PRODUCTS_TABLE,
            Key: productKey
        });

        const productResult = await ddbDocClient.send(getProductCommand);

        if (!productResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    message: `Product with ID '${productId}' not found`
                })
            };
        }

        const product = productResult.Item;

        // Check if product has sufficient stock
        if (product.stock < quantity) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
                })
            };
        }

        // Construct DynamoDB keys for cart item
        const cartItemKey = {
            PK: `CART#${userId}`,
            SK: `ITEM#${productId}`
        };

        // Check if item already exists in cart
        const getCartItemCommand = new GetCommand({
            TableName: CARTS_TABLE,
            Key: cartItemKey
        });

        const existingItem = await ddbDocClient.send(getCartItemCommand);

        let newQuantity = quantity;
        if (existingItem.Item) {
            // Item exists, add to existing quantity
            newQuantity = existingItem.Item.quantity + quantity;

            // Check stock against new total quantity
            if (product.stock < newQuantity) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        message: `Cannot add ${quantity} more. Available: ${product.stock}, Already in cart: ${existingItem.Item.quantity}`
                    })
                };
            }
        }

        // Create cart item
        const cartItem = {
            PK: `CART#${userId}`,
            SK: `ITEM#${productId}`,
            userId: userId,
            productId: productId,
            productName: product.name,
            productPrice: product.price,
            productImageUrl: product.imageUrl || '',
            quantity: newQuantity,
            addedAt: existingItem.Item?.addedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            expiresAt: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days TTL
        };

        // Save to DynamoDB
        const putCommand = new PutCommand({
            TableName: CARTS_TABLE,
            Item: cartItem
        });

        await ddbDocClient.send(putCommand);

        console.log(`Successfully added/updated item in cart for user ${userId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: existingItem.Item ? 'Cart item updated' : 'Item added to cart',
                item: cartItem
            })
        };

    } catch (error) {
        console.error('Error adding item to cart:', error);

        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('authorization') || error.message.includes('User ID')) {
            statusCode = 401;
        } else if (error.message.includes('required') || error.message.includes('Invalid')) {
            statusCode = 400;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to add item to cart',
                error: error.message
            })
        };
    }
};
