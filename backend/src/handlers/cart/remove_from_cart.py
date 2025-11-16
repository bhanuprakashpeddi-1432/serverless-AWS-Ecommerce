"""
Remove from Cart Lambda Handler
DELETE /cart/items/{productId} - Remove item from cart
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
        
        # Get cart
        cart_response = carts_table.get_item(Key={'PK': f'USER#{user_id}', 'SK': 'CART'})
        
        if 'Item' not in cart_response:
            return {'statusCode': 404, 'body': json.dumps({'error': 'CART_NOT_FOUND'})}
        
        cart = cart_response['Item']
        items = [item for item in cart.get('items', []) if item['productId'] != product_id]
        
        # Recalculate totals
        subtotal = sum(item['price'] * item['quantity'] for item in items)
        tax = subtotal * 0.08
        shipping = 9.99 if subtotal < 50 else 0
        
        cart['items'] = items
        cart['totals'] = {
            'subtotal': round(subtotal, 2),
            'tax': round(tax, 2),
            'shipping': round(shipping, 2),
            'total': round(subtotal + tax + shipping, 2),
            'currency': 'USD'
        }
        cart['updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        
        carts_table.put_item(Item=cart)
        
        return {
            'statusCode': 200,
            'body': json.dumps(cart, default=str),
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error removing from cart")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
