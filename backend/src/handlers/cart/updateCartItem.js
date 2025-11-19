const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');

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
    'Access-Control-Allow-Methods': 'PUT, OPTIONS',
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
 * Lambda handler to update cart item quantity
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

        // Get product ID from path parameters
        const productId = event.pathParameters?.productId;

        if (!productId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Product ID is required'
                })
            };
        }

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

        const { quantity } = body;

        // Validate quantity
        if (quantity === undefined || quantity < 1 || !Number.isInteger(quantity)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Quantity must be a positive integer'
                })
            };
        }

        // Construct DynamoDB keys
        const cartItemKey = {
            PK: `CART#${userId}`,
            SK: `ITEM#${productId}`
        };

        // Check if cart item exists
        const getCartItemCommand = new GetCommand({
            TableName: CARTS_TABLE,
            Key: cartItemKey
        });

        const cartItemResult = await ddbDocClient.send(getCartItemCommand);

        if (!cartItemResult.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    message: `Cart item not found for product '${productId}'`
                })
            };
        }

        // Verify product still exists and has sufficient stock
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

        // Check stock availability
        if (product.stock < quantity) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: `Insufficient stock. Available: ${product.stock}, Requested: ${quantity}`
                })
            };
        }

        // Update cart item quantity
        const updateCommand = new UpdateCommand({
            TableName: CARTS_TABLE,
            Key: cartItemKey,
            UpdateExpression: 'SET quantity = :quantity, updatedAt = :updatedAt, productPrice = :price, productName = :name',
            ExpressionAttributeValues: {
                ':quantity': quantity,
                ':updatedAt': new Date().toISOString(),
                ':price': product.price,
                ':name': product.name
            },
            ReturnValues: 'ALL_NEW'
        });

        const updateResult = await ddbDocClient.send(updateCommand);

        console.log(`Successfully updated cart item for user ${userId}, product ${productId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Cart item updated successfully',
                item: updateResult.Attributes
            })
        };

    } catch (error) {
        console.error('Error updating cart item:', error);

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
                message: 'Failed to update cart item',
                error: error.message
            })
        };
    }
};
