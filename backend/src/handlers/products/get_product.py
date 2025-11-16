"""
Get Product Lambda Handler
GET /products/{id} - Get a single product by ID
"""
import json
import os
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()
app = APIGatewayHttpResolver()

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_method
def get_product_by_id(product_id: str) -> Dict[str, Any]:
    """Get a single product from DynamoDB."""
    
    try:
        response = table.get_item(
            Key={
                'PK': f'PRODUCT#{product_id}',
                'SK': 'METADATA'
            }
        )
        
        if 'Item' not in response:
            return None
        
        return response['Item']
        
    except Exception as e:
        logger.exception("Error fetching product")
        raise


@app.get("/products/<product_id>")
@tracer.capture_method
def get_product(product_id: str):
    """Handle GET /products/{id} request."""
    
    logger.info(f"Fetching product: {product_id}")
    
    try:
        product = get_product_by_id(product_id)
        
        if not product:
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'NOT_FOUND',
                    'message': f'Product {product_id} not found'
                }),
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        
        # Check if product is active
        if product.get('status') != 'active':
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'NOT_FOUND',
                    'message': 'Product not available'
                }),
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        
        return {
            'statusCode': 200,
            'body': json.dumps(product, default=str),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Cache-Control': 'max-age=300'  # Cache for 5 minutes
            }
        }
        
    except Exception as e:
        logger.exception("Error processing request")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'An error occurred while processing your request'
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    logger.info("Received event", extra={'event': event})
    return app.resolve(event, context)
