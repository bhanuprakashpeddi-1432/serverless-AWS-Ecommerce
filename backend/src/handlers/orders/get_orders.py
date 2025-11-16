"""
Get Orders Lambda Handler
GET /orders - Get user's order history
"""
import json
import os
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
from boto3.dynamodb.conditions import Key

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
        params = event.get('queryStringParameters') or {}
        
        limit = int(params.get('limit', 10))
        
        # Query orders for user
        query_params = {
            'KeyConditionExpression': Key('PK').eq(f'USER#{user_id}') & Key('SK').begins_with('ORDER#'),
            'Limit': min(limit, 100),
            'ScanIndexForward': False  # Most recent first
        }
        
        response = orders_table.query(**query_params)
        
        orders = response.get('Items', [])
        result = {
            'orders': orders,
            'count': len(orders)
        }
        
        if 'LastEvaluatedKey' in response:
            result['nextToken'] = json.dumps(response['LastEvaluatedKey'])
        
        return {
            'statusCode': 200,
            'body': json.dumps(result, default=str),
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error fetching orders")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
