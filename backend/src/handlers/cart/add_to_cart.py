"""
Add to Cart Lambda Handler
POST /cart - Add item to shopping cart
"""
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict
from decimal import Decimal
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource('dynamodb')
carts_table = dynamodb.Table(os.environ['CARTS_TABLE'])
products_table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization."""
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: decimal_to_float(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [decimal_to_float(i) for i in obj]
    return obj


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        # Get user_id from JWT claims or use guest session
        user_id = None
        try:
            user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        except (KeyError, TypeError):
            # No authentication - use guest cart with session ID from headers or generate one
            import uuid
            user_id = f"guest-{uuid.uuid4().hex[:12]}"
        
        body = json.loads(event.get('body', '{}'))
        
        product_id = body.get('productId')
        quantity = int(body.get('quantity', 1))
        
        if not product_id or quantity < 1:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'INVALID_REQUEST',
                    'message': 'Valid productId and quantity required'
                })
            }
        
        # Get product details - use correct PK/SK format
        product_response = products_table.get_item(
            Key={
                'PK': f'PRODUCT#{product_id}',
                'SK': f'PRODUCT#{product_id}'
            }
        )
        
        if 'Item' not in product_response:
            return {
                'statusCode': 404,
                'body': json.dumps({
                    'error': 'NOT_FOUND',
                    'message': 'Product not found'
                })
            }
        
        product = product_response['Item']
        
        # Check inventory
        stock = int(product.get('stock', 0))
        if stock < quantity:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'INSUFFICIENT_INVENTORY',
                    'message': 'Not enough inventory available'
                })
            }
        
        # Get current cart
        cart_response = carts_table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': 'CART'
            }
        )
        
        cart = cart_response.get('Item', {
            'PK': f'USER#{user_id}',
            'SK': 'CART',
            'userId': user_id,
            'items': []
        })
        
        # Update or add item
        items = cart.get('items', [])
        existing_item = next((item for item in items if item['productId'] == product_id), None)
        
        price_decimal = Decimal(str(product.get('price', 0)))
        
        if existing_item:
            existing_item['quantity'] += quantity
        else:
            items.append({
                'productId': product_id,
                'name': product.get('name', ''),
                'quantity': quantity,
                'price': price_decimal,
                'imageUrl': product.get('imageUrl', ''),
                'addedAt': datetime.utcnow().isoformat() + 'Z'
            })
        
        # Calculate totals using Decimal
        subtotal = sum(Decimal(str(item['price'])) * item['quantity'] for item in items)
        tax = subtotal * Decimal('0.08')  # 8% tax
        shipping = Decimal('9.99') if subtotal < 50 else Decimal('0')
        total = subtotal + tax + shipping
        
        cart['items'] = items
        cart['totals'] = {
            'subtotal': subtotal,
            'tax': tax,
            'shipping': shipping,
            'total': total
        }
        cart['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        cart['expiresAt'] = int((datetime.utcnow() + timedelta(days=30)).timestamp())
        
        # Save cart
        carts_table.put_item(Item=cart)
        
        # Convert Decimals for JSON response
        response_cart = decimal_to_float(cart)
        
        return {
            'statusCode': 200,
            'body': json.dumps(response_cart),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except Exception as e:
        logger.exception("Error adding to cart")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': str(e)
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
