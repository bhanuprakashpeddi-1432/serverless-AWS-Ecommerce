const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { 
    DynamoDBDocumentClient, 
    GetCommand,
    QueryCommand,
    PutCommand,
    TransactWriteCommand 
} = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(client);

// Environment variables
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const INVENTORY_LOGS_TABLE = process.env.INVENTORY_LOGS_TABLE || process.env.ORDERS_TABLE;

// Idempotency TTL (7 days)
const IDEMPOTENCY_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Release inventory reservation by incrementing stock back
 * Handles rollback scenarios
 */
exports.handler = async (event) => {
    console.log('ReleaseInventory Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variables
        if (!PRODUCTS_TABLE || !INVENTORY_LOGS_TABLE) {
            throw new Error('Required environment variables are not set');
        }

        const { orderId, userId, items, action, idempotencyId, reservationId } = event;

        // Validate action
        if (action && action !== 'release') {
            console.log(`Action is ${action}, skipping release operation`);
            return {
                statusCode: 200,
                success: true,
                message: `Action ${action} not applicable for release`,
                orderId
            };
        }

        // Validate required fields
        if (!orderId) {
            const error = new Error('Invalid input: orderId is required');
            error.name = 'InventoryError';
            throw error;
        }

        // Generate or use provided idempotencyId for release
        const effectiveIdempotencyId = idempotencyId || `${orderId}-release-${Date.now()}`;

        console.log(`Releasing inventory for order ${orderId}, idempotencyId: ${effectiveIdempotencyId}`);

        // Check if release already executed (idempotency)
        if (idempotencyId) {
            try {
                const existingRelease = await ddbDocClient.send(new GetCommand({
                    TableName: INVENTORY_LOGS_TABLE,
                    Key: {
                        PK: `IDEMPOTENCY#${idempotencyId}`,
                        SK: `IDEMPOTENCY#${idempotencyId}`
                    }
                }));

                if (existingRelease.Item) {
                    console.log('Release already executed (idempotent), returning cached result');
                    return existingRelease.Item.result;
                }
            } catch (error) {
                console.warn('Error checking idempotency:', error);
            }
        }

        // Fetch reservation records
        let itemsToRelease = items;

        if (!itemsToRelease || itemsToRelease.length === 0) {
            console.log('No items provided, fetching from reservation logs');
            
            const queryResult = await ddbDocClient.send(new QueryCommand({
                TableName: INVENTORY_LOGS_TABLE,
                KeyConditionExpression: 'PK = :pk',
                FilterExpression: '#status = :status AND #action = :action',
                ExpressionAttributeNames: {
                    '#status': 'status',
                    '#action': 'action'
                },
                ExpressionAttributeValues: {
                    ':pk': `RESERVATION#${orderId}`,
                    ':status': 'active',
                    ':action': 'reserve'
                }
            }));

            itemsToRelease = (queryResult.Items || []).map(item => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                reservationSK: item.SK
            }));
        }

        if (!itemsToRelease || itemsToRelease.length === 0) {
            console.log('No active reservations found to release');
            return {
                statusCode: 200,
                success: true,
                orderId,
                idempotencyId: effectiveIdempotencyId,
                message: 'No active reservations to release',
                timestamp: new Date().toISOString()
            };
        }

        const timestamp = new Date().toISOString();
        const expiresAt = Math.floor(Date.now() / 1000) + IDEMPOTENCY_TTL_SECONDS;

        // Build transaction items for atomic update
        const transactItems = [];
        const releasedItems = [];

        for (const item of itemsToRelease) {
            const { productId, quantity, productName, reservationSK } = item;

            if (!productId || !quantity || quantity < 1) {
                console.warn(`Invalid item data: ${JSON.stringify(item)}`);
                continue;
            }

            // Increment product stock back
            transactItems.push({
                Update: {
                    TableName: PRODUCTS_TABLE,
                    Key: {
                        PK: `PRODUCT#${productId}`,
                        SK: `PRODUCT#${productId}`
                    },
                    UpdateExpression: 'SET stock = stock + :quantity, updatedAt = :timestamp',
                    ConditionExpression: 'attribute_exists(PK)',
                    ExpressionAttributeValues: {
                        ':quantity': quantity,
                        ':timestamp': timestamp
                    }
                }
            });

            // Update reservation log to released
            const sk = reservationSK || `ITEM#${productId}`;
            transactItems.push({
                Update: {
                    TableName: INVENTORY_LOGS_TABLE,
                    Key: {
                        PK: `RESERVATION#${orderId}`,
                        SK: sk
                    },
                    UpdateExpression: 'SET #status = :status, releasedAt = :timestamp',
                    ConditionExpression: 'attribute_exists(PK)',
                    ExpressionAttributeNames: {
                        '#status': 'status'
                    },
                    ExpressionAttributeValues: {
                        ':status': 'released',
                        ':timestamp': timestamp
                    }
                }
            });

            releasedItems.push({
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
                console.warn('Some items may not exist, continuing with partial release');
                // Don't throw error for release operations - log and continue
            } else {
                throw error;
            }
        }

        const result = {
            statusCode: 200,
            success: true,
            orderId,
            idempotencyId: effectiveIdempotencyId,
            releasedItems,
            message: 'Inventory released successfully',
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

        console.log(`Successfully released inventory for order ${orderId}`);
        return result;

    } catch (error) {
        console.error('Error in releaseInventory:', error);

        // Don't fail release operations - log error and return success
        console.warn('Release operation encountered error but continuing');
        return {
            statusCode: 200,
            success: true,
            orderId: event.orderId,
            message: 'Release completed with warnings',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};
