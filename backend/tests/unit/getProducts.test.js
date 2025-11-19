/**
 * Jest unit tests for getProducts.js
 */

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
    ScanCommand: jest.fn((params) => ({ __type: 'ScanCommand', params }))
  };
});

const { ScanCommand } = require('@aws-sdk/lib-dynamodb');
const path = require('path');
const handler = require(path.resolve(__dirname, '../../../src/handlers/products/getProducts.js')).handler;

const OLD_ENV = process.env;

describe('getProducts.handler', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...OLD_ENV, PRODUCTS_TABLE: 'dev-ecommerce-products' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test('returns 400 when limit is invalid', async () => {
    const event = { queryStringParameters: { limit: '1000' } };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Limit must be between 1 and 100/);
  });

  test('scans table with default limit and returns items', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [{ PK: 'PRODUCT#1' }],
      Count: 1,
      ScannedCount: 1
    });

    const res = await handler({});
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.items).toHaveLength(1);
    expect(body.count).toBe(1);
    expect(ScanCommand).toHaveBeenCalled();
    const callArg = ScanCommand.mock.calls[0][0];
    expect(callArg.TableName).toBe('dev-ecommerce-products');
    expect(callArg.Limit).toBe(20);
  });

  test('supports pagination via lastKey', async () => {
    const lastKey = encodeURIComponent(JSON.stringify({ PK: 'X', SK: 'X' }));
    mockSend.mockResolvedValueOnce({
      Items: [],
      Count: 0,
      ScannedCount: 0,
      LastEvaluatedKey: { PK: 'Y', SK: 'Y' }
    });

    const res = await handler({ queryStringParameters: { lastKey } });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.lastKey).toBeDefined();
  });

  test('returns 500 on unexpected error', async () => {
    mockSend.mockRejectedValueOnce(new Error('boom'));
    const res = await handler({});
    expect(res.statusCode).toBe(500);
    const body = JSON.parse(res.body);
    expect(body.message).toMatch(/Failed to retrieve products/);
  });

  test('returns 400 if PRODUCTS_TABLE missing', async () => {
    delete process.env.PRODUCTS_TABLE;
    const res = await handler({});
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error).toMatch(/PRODUCTS_TABLE/);
  });
});
