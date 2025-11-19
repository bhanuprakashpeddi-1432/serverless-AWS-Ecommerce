const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');

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
 * Lambda handler to get products with pagination
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

        // Extract query parameters for pagination
        const limit = event.queryStringParameters?.limit 
            ? parseInt(event.queryStringParameters.limit, 10) 
            : 20; // Default limit
        
        const lastEvaluatedKey = event.queryStringParameters?.lastKey 
            ? JSON.parse(decodeURIComponent(event.queryStringParameters.lastKey))
            : undefined;

        // Validate limit
        if (limit < 1 || limit > 100) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Limit must be between 1 and 100'
                })
            };
        }

        // Prepare DynamoDB Scan parameters
        const params = {
            TableName: PRODUCTS_TABLE,
            Limit: limit
        };

        // Add ExclusiveStartKey if provided for pagination
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }

        console.log('Scan params:', JSON.stringify(params, null, 2));

        // Execute scan operation
        const command = new ScanCommand(params);
        const result = await ddbDocClient.send(command);

        // Prepare response
        const response = {
            items: result.Items || [],
            count: result.Count || 0,
            scannedCount: result.ScannedCount || 0
        };

        // Include pagination token if more items exist
        if (result.LastEvaluatedKey) {
            response.lastKey = encodeURIComponent(
                JSON.stringify(result.LastEvaluatedKey)
            );
        }

        console.log(`Successfully retrieved ${response.count} products`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(response)
        };

    } catch (error) {
        console.error('Error retrieving products:', error);

        // Determine if it's a validation error or server error
        const statusCode = error.message.includes('environment variable') || 
                          error.message.includes('Limit must be') 
            ? 400 
            : 500;

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to retrieve products',
                error: error.message
            })
        };
    }
};
