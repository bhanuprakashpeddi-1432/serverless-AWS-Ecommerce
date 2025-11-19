/**
 * Jest unit tests for startCheckout.js
 */

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

const mockDdbSend = jest.fn();
const mockSfnSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockDdbSend })) },
    QueryCommand: jest.fn((params) => ({ __type: 'QueryCommand', params })),
    GetCommand: jest.fn((params) => ({ __type: 'GetCommand', params }))
  };
});

jest.mock('@aws-sdk/client-sfn', () => ({
  SFNClient: jest.fn().mockImplementation(() => ({})),
  StartExecutionCommand: jest.fn((params) => ({ __type: 'StartExecutionCommand', params }))
}));

const path = require('path');
const handler = require(path.resolve(__dirname, '../../../src/handlers/checkout/startCheckout.js')).handler;

const OLD_ENV = process.env;

describe('startCheckout.handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...OLD_ENV,
      CARTS_TABLE: 'dev-ecommerce-carts',
      PRODUCTS_TABLE: 'dev-ecommerce-products',
      ORDERS_TABLE: 'dev-ecommerce-orders',
      STATE_MACHINE_ARN: 'arn:aws:states:us-east-1:111122223333:stateMachine:order-processing'
    };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  const makeEvent = (tokenClaims = {}, body = {}) => ({
    requestContext: {
      authorizer: {
        jwt: { claims: tokenClaims }
      }
    },
    body: JSON.stringify(body)
  });

  test('returns 401 if no auth claims', async () => {
    const res = await handler({ requestContext: {} });
    expect(res.statusCode).toBe(401);
  });

  test('returns 400 for invalid body', async () => {
    const event = { requestContext: { authorizer: { jwt: { claims: { sub: 'user-1' } } } }, body: '{' };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });

  test('returns 400 when shipping address incomplete', async () => {
    const event = makeEvent({ sub: 'user-1' }, { shippingAddress: { city: 'X' } });
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Complete shipping address is required/);
  });

  test('returns 400 when cart is empty', async () => {
    // Query for cart returns no items
    mockDdbSend.mockResolvedValueOnce({ Items: [] });

    const event = makeEvent(
      { sub: 'user-1' },
      { shippingAddress: { street: '1 a', city: 'c', state: 's', zipCode: '00000' } }
    );

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Cart is empty/);
  });

  test('returns 400 when inventory validation fails', async () => {
    // Query for cart returns one item
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ productId: 'p1', productName: 'Tee', quantity: 3 }] }) // fetchUserCart
      .mockResolvedValueOnce({ Item: { name: 'Tee', stock: 1, price: 10, status: 'active' } }); // validateInventory -> Get

    const event = makeEvent(
      { sub: 'user-1' },
      { shippingAddress: { street: '1 a', city: 'c', state: 's', zipCode: '00000' } }
    );

    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Inventory validation failed/);
    expect(body.insufficientStock).toBeDefined();
  });

  test('starts step function on valid cart and inventory', async () => {
    // Cart items
    mockDdbSend
      .mockResolvedValueOnce({ Items: [{ productId: 'p1', productName: 'Tee', quantity: 2 }] }) // fetchUserCart
      .mockResolvedValueOnce({ Item: { name: 'Tee', stock: 10, price: 15, status: 'active' } }); // validateInventory -> Get

    // StartExecution returns executionArn
    mockSfnSend.mockResolvedValueOnce({ executionArn: 'arn:aws:states:us-east-1:acct:execution:sm:123' });

    // Patch the imported SFN client send via prototype (mocked in module)
    const { SFNClient } = require('@aws-sdk/client-sfn');
    SFNClient.mockImplementation(() => ({ send: mockSfnSend }));

    const event = makeEvent(
      { sub: 'user-1' },
      { shippingAddress: { street: '1 a', city: 'c', state: 's', zipCode: '00000' }, paymentMethod: 'card' }
    );

    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Checkout started successfully/);
    expect(body.executionArn).toBeDefined();
    expect(body.orderSummary.pricing.total).toBeGreaterThan(0);
  });
});
