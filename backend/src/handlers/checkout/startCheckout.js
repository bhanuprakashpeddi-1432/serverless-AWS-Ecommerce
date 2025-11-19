const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const { SFNClient, StartExecutionCommand } = require('@aws-sdk/client-sfn');
const crypto = require('crypto');

// Initialize clients
const dynamoClient = new DynamoDBClient({});
const ddbDocClient = DynamoDBDocumentClient.from(dynamoClient);
const sfnClient = new SFNClient({});

// Environment variables
const CARTS_TABLE = process.env.CARTS_TABLE;
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE;
const ORDERS_TABLE = process.env.ORDERS_TABLE;
const STATE_MACHINE_ARN = process.env.STATE_MACHINE_ARN;

// Constants
const TAX_RATE = 0.08; // 8% sales tax (placeholder)
const FLAT_SHIPPING = 9.99; // Flat shipping rate
const FREE_SHIPPING_THRESHOLD = 50.00; // Free shipping over $50

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
    const claims = event.requestContext?.authorizer?.jwt?.claims;
    
    if (!claims) {
        throw new Error('No authorization claims found');
    }

    const userId = claims.sub || claims['cognito:username'];
    
    if (!userId) {
        throw new Error('User ID not found in token');
    }

    return userId;
};

/**
 * Fetch user's cart from DynamoDB
 */
const fetchUserCart = async (userId) => {
    const queryParams = {
        TableName: CARTS_TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: {
            ':pk': `CART#${userId}`
        }
    };

    const result = await ddbDocClient.send(new QueryCommand(queryParams));
    return result.Items || [];
};

/**
 * Validate inventory for all cart items
 */
const validateInventory = async (cartItems) => {
    const validationResults = [];
    const insufficientStock = [];

    for (const item of cartItems) {
        try {
            // Fetch current product from database
            const productKey = {
                PK: `PRODUCT#${item.productId}`,
                SK: `PRODUCT#${item.productId}`
            };

            const getCommand = new GetCommand({
                TableName: PRODUCTS_TABLE,
                Key: productKey
            });

            const result = await ddbDocClient.send(getCommand);
            
            if (!result.Item) {
                insufficientStock.push({
                    productId: item.productId,
                    productName: item.productName,
                    reason: 'Product not found',
                    requested: item.quantity,
                    available: 0
                });
                continue;
            }

            const product = result.Item;

            // Check if product is active/available
            if (product.status && product.status !== 'active') {
                insufficientStock.push({
                    productId: item.productId,
                    productName: item.productName,
                    reason: 'Product not available',
                    requested: item.quantity,
                    available: 0
                });
                continue;
            }

            // Check stock availability
            if (product.stock < item.quantity) {
                insufficientStock.push({
                    productId: item.productId,
                    productName: item.productName,
                    reason: 'Insufficient stock',
                    requested: item.quantity,
                    available: product.stock
                });
                continue;
            }

            // Validation passed
            validationResults.push({
                productId: item.productId,
                productName: product.name,
                price: product.price,
                quantity: item.quantity,
                available: product.stock,
                valid: true
            });

        } catch (error) {
            console.error(`Error validating product ${item.productId}:`, error);
            insufficientStock.push({
                productId: item.productId,
                productName: item.productName,
                reason: 'Validation error',
                requested: item.quantity,
                available: 0
            });
        }
    }

    return {
        valid: insufficientStock.length === 0,
        validatedItems: validationResults,
        insufficientStock
    };
};

/**
 * Calculate order totals
 */
const calculateTotals = (items) => {
    const subtotal = items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
    }, 0);

    const tax = subtotal * TAX_RATE;
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
    const total = subtotal + tax + shipping;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        tax: parseFloat(tax.toFixed(2)),
        shipping: parseFloat(shipping.toFixed(2)),
        total: parseFloat(total.toFixed(2))
    };
};

/**
 * Lambda handler to start checkout process
 */
exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Validate environment variables
        if (!CARTS_TABLE || !PRODUCTS_TABLE || !ORDERS_TABLE || !STATE_MACHINE_ARN) {
            throw new Error('Required environment variables are not set');
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

        // Get shipping address from request
        const { shippingAddress, paymentMethod } = body;

        // Validate shipping address
        if (!shippingAddress || !shippingAddress.street || !shippingAddress.city || 
            !shippingAddress.state || !shippingAddress.zipCode) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Complete shipping address is required'
                })
            };
        }

        // Fetch user's cart
        console.log('Fetching cart for user:', userId);
        const cartItems = await fetchUserCart(userId);

        if (!cartItems || cartItems.length === 0) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Cart is empty'
                })
            };
        }

        console.log(`Found ${cartItems.length} items in cart`);

        // Validate inventory for all items
        console.log('Validating inventory...');
        const inventoryValidation = await validateInventory(cartItems);

        if (!inventoryValidation.valid) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    message: 'Inventory validation failed',
                    insufficientStock: inventoryValidation.insufficientStock
                })
            };
        }

        console.log('Inventory validation passed');

        // Calculate order totals
        const totals = calculateTotals(inventoryValidation.validatedItems);
        console.log('Order totals:', totals);

        // Generate order draft ID
        const orderDraftId = `ORDER#${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
        const timestamp = new Date().toISOString();

        // Prepare order data for Step Functions
        const orderData = {
            orderId: orderDraftId,
            userId: userId,
            status: 'pending',
            items: inventoryValidation.validatedItems.map(item => ({
                productId: item.productId,
                productName: item.productName,
                price: item.price,
                quantity: item.quantity
            })),
            pricing: {
                subtotal: totals.subtotal,
                tax: totals.tax,
                taxRate: TAX_RATE,
                shipping: totals.shipping,
                total: totals.total
            },
            shippingAddress: {
                street: shippingAddress.street,
                city: shippingAddress.city,
                state: shippingAddress.state,
                zipCode: shippingAddress.zipCode,
                country: shippingAddress.country || 'US'
            },
            paymentMethod: paymentMethod || 'card',
            createdAt: timestamp,
            updatedAt: timestamp
        };

        // Start Step Functions execution
        console.log('Starting Step Functions execution...');
        const executionName = `checkout-${userId}-${Date.now()}`;
        
        const sfnCommand = new StartExecutionCommand({
            stateMachineArn: STATE_MACHINE_ARN,
            name: executionName,
            input: JSON.stringify(orderData)
        });

        const sfnResult = await sfnClient.send(sfnCommand);
        console.log('Step Functions execution started:', sfnResult.executionArn);

        // Return success response
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Checkout started successfully',
                orderId: orderDraftId,
                executionArn: sfnResult.executionArn,
                orderSummary: {
                    itemCount: inventoryValidation.validatedItems.length,
                    totalItems: inventoryValidation.validatedItems.reduce(
                        (sum, item) => sum + item.quantity, 0
                    ),
                    pricing: totals
                },
                status: 'processing'
            })
        };

    } catch (error) {
        console.error('Error starting checkout:', error);

        // Determine appropriate status code
        let statusCode = 500;
        if (error.message.includes('authorization') || error.message.includes('User ID')) {
            statusCode = 401;
        } else if (error.message.includes('required') || error.message.includes('Invalid') || 
                   error.message.includes('empty')) {
            statusCode = 400;
        }

        return {
            statusCode,
            headers,
            body: JSON.stringify({
                message: 'Failed to start checkout',
                error: error.message
            })
        };
    }
};
