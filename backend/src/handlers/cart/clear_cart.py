"""
Clear Cart Lambda Handler
DELETE /cart - Clear all items from cart
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
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        
        # Delete cart
        carts_table.delete_item(Key={'PK': f'USER#{user_id}', 'SK': 'CART'})
        
        logger.info(f"Cart cleared for user: {user_id}")
        
        return {
            'statusCode': 204,
            'body': '',
            'headers': {'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error clearing cart")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
