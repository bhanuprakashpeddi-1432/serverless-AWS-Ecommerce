"""
Update Cart Item Lambda Handler
PUT /cart/items/{productId} - Update item quantity in cart
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


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        product_id = event['pathParameters']['productId']
        body = json.loads(event.get('body', '{}'))
        quantity = int(body.get('quantity', 0))
        
        if quantity < 0:
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'INVALID_QUANTITY', 'message': 'Quantity must be >= 0'})
            }
        
        # Get cart
        cart_response = carts_table.get_item(Key={'PK': f'USER#{user_id}', 'SK': 'CART'})
        
        if 'Item' not in cart_response:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'CART_NOT_FOUND', 'message': 'Cart not found'})
            }
        
        cart = cart_response['Item']
        items = cart.get('items', [])
        
        # Update quantity or remove item
        if quantity == 0:
            items = [item for item in items if item['productId'] != product_id]
        else:
            for item in items:
                if item['productId'] == product_id:
                    item['quantity'] = quantity
                    break
        
        # Recalculate totals
        subtotal = sum(item['price'] * item['quantity'] for item in items)
        tax = subtotal * 0.08
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
        
        carts_table.put_item(Item=cart)
        
        return {
            'statusCode': 200,
            'body': json.dumps(cart, default=str),
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error updating cart item")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
