"""
Create Product Lambda Handler
POST /products - Create a new product (Admin only)
"""
import json
import os
import uuid
from datetime import datetime
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    logger.info("Create product request", extra={'event': event})
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        # Validate required fields
        required_fields = ['name', 'price', 'currency', 'category', 'inventory']
        for field in required_fields:
            if field not in body:
                return {
                    'statusCode': 400,
                    'body': json.dumps({
                        'error': 'INVALID_REQUEST',
                        'message': f'Missing required field: {field}'
                    })
                }
        
        # Generate product ID
        product_id = f"prod-{uuid.uuid4().hex[:12]}"
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        # Build product item
        product = {
            'PK': f'PRODUCT#{product_id}',
            'SK': 'METADATA',
            'productId': product_id,
            'name': body['name'],
            'price': float(body['price']),
            'currency': body['currency'],
            'category': body['category'],
            'inventory': int(body['inventory']),
            'status': body.get('status', 'active'),
            'createdAt': timestamp,
            'updatedAt': timestamp,
            # GSI keys
            'GSI1PK': f"CATEGORY#{body['category']}",
            'GSI1SK': f"{float(body['price'])}#{product_id}",
            'GSI2PK': f"STATUS#{body.get('status', 'active')}",
            'GSI2SK': timestamp
        }
        
        # Add optional fields
        if 'description' in body:
            product['description'] = body['description']
        if 'subCategory' in body:
            product['subCategory'] = body['subCategory']
        if 'brand' in body:
            product['brand'] = body['brand']
        if 'images' in body:
            product['images'] = body['images']
        if 'sku' in body:
            product['sku'] = body['sku']
        if 'attributes' in body:
            product['attributes'] = body['attributes']
        
        # Save to DynamoDB
        table.put_item(Item=product)
        
        logger.info(f"Product created: {product_id}")
        
        return {
            'statusCode': 201,
            'body': json.dumps(product, default=str),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'INVALID_JSON',
                'message': 'Request body is not valid JSON'
            })
        }
    except Exception as e:
        logger.exception("Error creating product")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'An error occurred while creating the product'
            })
        }
