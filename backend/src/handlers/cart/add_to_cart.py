"""
Add to Cart Lambda Handler
POST /cart - Add item to shopping cart
"""
import json
import os
from datetime import datetime, timedelta
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource('dynamodb')
carts_table = dynamodb.Table(os.environ['CARTS_TABLE'])
products_table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
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
        
        # Get product details
        product_response = products_table.get_item(
            Key={
                'PK': f'PRODUCT#{product_id}',
                'SK': 'METADATA'
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
        if product['inventory'] < quantity:
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
        
        if existing_item:
            existing_item['quantity'] += quantity
        else:
            items.append({
                'productId': product_id,
                'productName': product['name'],
                'quantity': quantity,
                'price': product['price'],
                'currency': product['currency'],
                'imageUrl': product.get('images', [''])[0] if product.get('images') else '',
                'addedAt': datetime.utcnow().isoformat() + 'Z'
            })
        
        # Calculate totals
        subtotal = sum(item['price'] * item['quantity'] for item in items)
        tax = subtotal * 0.08  # 8% tax
        shipping = 9.99 if subtotal < 50 else 0
        total = subtotal + tax + shipping
        
        cart['items'] = items
        cart['totals'] = {
            'subtotal': round(subtotal, 2),
            'tax': round(tax, 2),
            'shipping': round(shipping, 2),
            'total': round(total, 2),
            'currency': 'USD'
        }
        cart['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        cart['expiresAt'] = int((datetime.utcnow() + timedelta(days=30)).timestamp())
        
        # Save cart
        carts_table.put_item(Item=cart)
        
        return {
            'statusCode': 200,
            'body': json.dumps(cart, default=str),
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
            })
        }
