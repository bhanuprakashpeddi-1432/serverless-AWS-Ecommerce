const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variables
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;

/**
 * Check inventory availability for order items
 * Returns list of items with sufficient stock or insufficient items
 */
exports.handler = async (event) => {
    console.log('CheckInventory Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variable
        if (!PRODUCTS_TABLE) {
            throw new Error('PRODUCTS_TABLE environment variable is not set');
        }

        const { orderId, userId, items, idempotencyId } = event;

        // Validate required fields
        if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
            const error = new Error('Invalid input: orderId and items array are required');
            error.name = 'InventoryError';
            throw error;
        }

        console.log(`Checking inventory for order ${orderId}, idempotencyId: ${idempotencyId}`);

        const insufficientStock = [];
        const availableItems = [];

        // Check each item's stock
        for (const item of items) {
            try {
                const { productId, quantity } = item;

                if (!productId || !quantity || quantity < 1) {
                    console.warn(`Invalid item data: ${JSON.stringify(item)}`);
                    continue;
                }

                // Fetch product from DynamoDB
                const params = {
                    RequestItems: {
                        [PRODUCTS_TABLE]: {
                            Keys: [
                                {
                                    PK: `PRODUCT#${productId}`,
                                    SK: `PRODUCT#${productId}`
                                }
                            ]
                        }
                    }
                };

                const result = await ddbDocClient.send(new BatchGetCommand(params));
                const products = result.Responses?.[PRODUCTS_TABLE] || [];

                if (products.length === 0) {
                    insufficientStock.push({
                        productId,
                        productName: item.productName || 'Unknown',
                        requested: quantity,
                        available: 0,
                        reason: 'Product not found'
                    });
                    continue;
                }

                const product = products[0];

                // Check if product is active
                if (product.status && product.status !== 'active') {
                    insufficientStock.push({
                        productId,
                        productName: product.name,
                        requested: quantity,
                        available: 0,
                        reason: 'Product not available'
                    });
                    continue;
                }

                // Check stock availability
                const availableStock = product.stock || 0;
                
                if (availableStock < quantity) {
                    insufficientStock.push({
                        productId,
                        productName: product.name,
                        requested: quantity,
                        available: availableStock,
                        reason: 'Insufficient stock'
                    });
                } else {
                    availableItems.push({
                        productId,
                        productName: product.name,
                        price: product.price,
                        quantity,
                        availableStock
                    });
                }

            } catch (itemError) {
                console.error(`Error checking item ${item.productId}:`, itemError);
                insufficientStock.push({
                    productId: item.productId,
                    productName: item.productName || 'Unknown',
                    requested: item.quantity,
                    available: 0,
                    reason: 'Error checking stock'
                });
            }
        }

        // If any items have insufficient stock, throw error
        if (insufficientStock.length > 0) {
            console.log('Insufficient stock found:', insufficientStock);
            const error = new Error('Insufficient stock for order');
            error.name = 'InsufficientStockError';
            error.details = {
                insufficientStock,
                message: 'Some items do not have sufficient stock'
            };
            throw error;
        }

        console.log(`Inventory check passed for order ${orderId}`);

        return {
            statusCode: 200,
            success: true,
            orderId,
            idempotencyId,
            availableItems,
            message: 'All items have sufficient stock',
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('Error in checkInventory:', error);

        // Re-throw inventory-specific errors
        if (error.name === 'InsufficientStockError' || error.name === 'InventoryError') {
            throw error;
        }

        // Wrap other errors
        const wrappedError = new Error(error.message || 'Failed to check inventory');
        wrappedError.name = 'InventoryError';
        throw wrappedError;
    }
};
