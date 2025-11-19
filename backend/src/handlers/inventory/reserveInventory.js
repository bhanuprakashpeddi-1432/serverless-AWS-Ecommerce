const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    GetCommand, 
    PutCommand, 
    UpdateCommand,
    TransactWriteCommand 
} = require('@aws-sdk/lib-dynamodb');
const crypto = require('crypto');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variables
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const INVENTORY_LOGS_TABLE = process.env.INVENTORY_LOGS_TABLE || process.env.ORDERS_TABLE;

// Reservation TTL (24 hours)
const RESERVATION_TTL_SECONDS = 24 * 60 * 60;

/**
 * Reserve inventory by decrementing stock atomically
 * Creates reservation records with TTL
 */
exports.handler = async (event) => {
    console.log('ReserveInventory Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variables
        if (!PRODUCTS_TABLE || !INVENTORY_LOGS_TABLE) {
            throw new Error('Required environment variables are not set');
        }

        const { orderId, userId, items, action, idempotencyId } = event;

        // Validate action
        if (action && action !== 'reserve') {
            console.log(`Action is ${action}, skipping reserve operation`);
            return {
                statusCode: 200,
                success: true,
                message: `Action ${action} not applicable for reserve`,
                orderId
            };
        }

        // Validate required fields
        if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
            const error = new Error('Invalid input: orderId and items array are required');
            error.name = 'InventoryError';
            throw error;
        }

        // Generate or use provided idempotencyId
        const effectiveIdempotencyId = idempotencyId || `${orderId}-reserve-${Date.now()}`;
        const reservationId = `RESERVATION#${orderId}#${crypto.randomBytes(8).toString('hex')}`;

        console.log(`Reserving inventory for order ${orderId}, reservationId: ${reservationId}`);

        // Check if reservation already exists (idempotency)
        if (idempotencyId) {
            try {
                const existingReservation = await ddbDocClient.send(new GetCommand({
                    TableName: INVENTORY_LOGS_TABLE,
                    Key: {
                        PK: `IDEMPOTENCY#${idempotencyId}`,
                        SK: `IDEMPOTENCY#${idempotencyId}`
                    }
                }));

                if (existingReservation.Item) {
                    console.log('Reservation already exists (idempotent), returning cached result');
                    return existingReservation.Item.result;
                }
            } catch (error) {
                console.warn('Error checking idempotency:', error);
            }
        }

        const timestamp = new Date().toISOString();
        const expiresAt = Math.floor(Date.now() / 1000) + RESERVATION_TTL_SECONDS;

        // Build transaction items for atomic update
        const transactItems = [];
        const reservedItems = [];

        for (const item of items) {
            const { productId, quantity, productName, price } = item;

            if (!productId || !quantity || quantity < 1) {
                console.warn(`Invalid item data: ${JSON.stringify(item)}`);
                continue;
            }

            // Update product stock atomically with condition
            transactItems.push({
                Update: {
                    TableName: PRODUCTS_TABLE,
                    Key: {
                        PK: `PRODUCT#${productId}`,
                        SK: `PRODUCT#${productId}`
                    },
                    UpdateExpression: 'SET stock = stock - :quantity, updatedAt = :timestamp',
                    ConditionExpression: 'attribute_exists(PK) AND stock >= :quantity',
                    ExpressionAttributeValues: {
                        ':quantity': quantity,
                        ':timestamp': timestamp
                    }
                }
            });

            // Create reservation log entry
            transactItems.push({
                Put: {
                    TableName: INVENTORY_LOGS_TABLE,
                    Item: {
                        PK: `RESERVATION#${orderId}`,
                        SK: `ITEM#${productId}`,
                        reservationId,
                        orderId,
                        userId: userId || 'unknown',
                        productId,
                        productName: productName || 'Unknown',
                        price: price || 0,
                        quantity,
                        action: 'reserve',
                        status: 'active',
                        createdAt: timestamp,
                        expiresAt,
                        idempotencyId: effectiveIdempotencyId
                    }
                }
            });

            reservedItems.push({
                productId,
                productName: productName || 'Unknown',
                quantity
            });
        }

        // Execute atomic transaction
        try {
            await ddbDocClient.send(new TransactWriteCommand({
                TransactItems: transactItems
            }));
        } catch (error) {
            console.error('Transaction failed:', error);
            
            if (error.name === 'TransactionCanceledException') {
                // Check if it was due to insufficient stock
                const reasons = error.CancellationReasons || [];
                const stockIssues = reasons.filter(r => 
                    r.Code === 'ConditionalCheckFailed'
                );

                if (stockIssues.length > 0) {
                    const err = new Error('Insufficient stock to reserve');
                    err.name = 'InsufficientStockError';
                    err.details = {
                        message: 'One or more items do not have sufficient stock',
                        orderId
                    };
                    throw err;
                }
            }

            throw error;
        }

        const result = {
            statusCode: 200,
            success: true,
            orderId,
            reservationId,
            idempotencyId: effectiveIdempotencyId,
            reservedItems,
            expiresAt: new Date(expiresAt * 1000).toISOString(),
            message: 'Inventory reserved successfully',
            timestamp
        };

        // Store idempotency record
        if (idempotencyId) {
            try {
                await ddbDocClient.send(new PutCommand({
                    TableName: INVENTORY_LOGS_TABLE,
                    Item: {
                        PK: `IDEMPOTENCY#${idempotencyId}`,
                        SK: `IDEMPOTENCY#${idempotencyId}`,
                        result,
                        createdAt: timestamp,
                        expiresAt
                    }
                }));
            } catch (error) {
                console.warn('Error storing idempotency record:', error);
            }
        }

        console.log(`Successfully reserved inventory for order ${orderId}`);
        return result;

    } catch (error) {
        console.error('Error in reserveInventory:', error);

        // Re-throw inventory-specific errors
        if (error.name === 'InsufficientStockError' || error.name === 'InventoryError') {
            throw error;
        }

        // Wrap other errors
        const wrappedError = new Error(error.message || 'Failed to reserve inventory');
        wrappedError.name = 'InventoryError';
        throw wrappedError;
    }
};
