const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variable
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

// CORS headers
const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

/**
 * Lambda handler to get a single product by ID
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 * @returns {Object} - API Gateway Lambda Proxy Output Format
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variable
        if (!PRODUCTS_TABLE) {
            throw new Error('PRODUCTS_TABLE environment variable is not set');
        }

        // Extract product ID from path parameters
        const productId = event.pathParameters?.id;

        if (!productId) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Product ID is required'
                })
            };
        }

        // Construct DynamoDB key
        const key = {
            PK: `PRODUCT#${productId}`,
            SK: `PRODUCT#${productId}`
        };

        console.log('Fetching product with key:', JSON.stringify(key, null, 2));

        // Prepare GetItem parameters
        const params = {
            TableName: PRODUCTS_TABLE,
            Key: key
        };

        // Execute get operation
        const command = new GetCommand(params);
        const result = await ddbDocClient.send(command);

        // Check if product exists
        if (!result.Item) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    message: `Product with ID '${productId}' not found`
                })
            };
        }

        console.log(`Successfully retrieved product: ${productId}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(result.Item)
        };

    } catch (error) {
        console.error('Error retrieving product:', error);

        // Determine if it's a validation error or server error
        const statusCode = error.message.includes('environment variable') || 
                          error.message.includes('required') 
            ? 400 
            : 500;

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to retrieve product',
                error: error.message
            })
        };
    }
};
