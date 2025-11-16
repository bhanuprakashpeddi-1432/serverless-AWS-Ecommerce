"""
Get Order Lambda Handler
GET /orders/{id} - Get a specific order by ID
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
orders_table = dynamodb.Table(os.environ['ORDERS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        order_id = event['pathParameters']['id']
        
        # Get order
        response = orders_table.get_item(
            Key={
                'PK': f'USER#{user_id}',
                'SK': f'ORDER#{order_id}'
            }
        )
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'body': json.dumps({'error': 'NOT_FOUND', 'message': 'Order not found'})
            }
        
        return {
            'statusCode': 200,
            'body': json.dumps(response['Item'], default=str),
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error fetching order")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
