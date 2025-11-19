const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variables
const CARTS_TABLE = process.env.CARTS_TABLE;

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
 * Lambda handler to get user's cart
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variable
        if (!CARTS_TABLE) {
            throw new Error('CARTS_TABLE environment variable is not set');
        }

        // Extract user ID from JWT
        const userId = getUserIdFromEvent(event);
        console.log('User ID from JWT:', userId);

        // Query all cart items for this user
        const queryParams = {
            TableName: CARTS_TABLE,
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: {
                ':pk': `CART#${userId}`
            }
        };

        console.log('Query params:', JSON.stringify(queryParams, null, 2));

        const command = new QueryCommand(queryParams);
        const result = await ddbDocClient.send(command);

        const items = result.Items || [];

        // Calculate cart summary
        const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
        const totalPrice = items.reduce((sum, item) => sum + (item.productPrice * item.quantity), 0);

        console.log(`Successfully retrieved cart for user ${userId}: ${items.length} unique items`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                userId: userId,
                items: items,
                itemCount: items.length,
                totalItems: totalItems,
                totalPrice: parseFloat(totalPrice.toFixed(2)),
                lastUpdated: items.length > 0 
                    ? items.reduce((latest, item) => 
                        item.updatedAt > latest ? item.updatedAt : latest, 
                        items[0].updatedAt
                    )
                    : null
            })
        };

    } catch (error) {
        console.error('Error retrieving cart:', error);

        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('authorization') || error.message.includes('User ID')) {
            statusCode = 401;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to retrieve cart',
                error: error.message
            })
        };
    }
};
