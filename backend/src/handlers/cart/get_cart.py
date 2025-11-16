"""
Get Cart Lambda Handler
GET /cart - Get user's shopping cart
"""
import json
import os
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
        # Get user ID from authorizer context
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        
        # Get cart from DynamoDB
        response = carts_table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': 'CART'
            }
        )
        
        cart = response.get('Item', {
            'userId': user_id,
            'items': [],
            'totals': {
                'subtotal': 0,
                'tax': 0,
                'shipping': 0,
                'total': 0,
                'currency': 'USD'
            }
        })
        
        return {
            'statusCode': 200,
            'body': json.dumps(cart, default=str),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except Exception as e:
        logger.exception("Error fetching cart")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': str(e)
            })
        }
