"""
Delete Product Lambda Handler
DELETE /products/{id} - Delete a product (Admin only)
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
table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        product_id = event['pathParameters']['id']
        
        # Delete from DynamoDB
        table.delete_item(
            Key={
                'PK': f'PRODUCT#{product_id}',
                'SK': 'METADATA'
            }
        )
        
        logger.info(f"Product deleted: {product_id}")
        
        return {
            'statusCode': 204,
            'body': '',
            'headers': {
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except Exception as e:
        logger.exception("Error deleting product")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': str(e)
            })
        }
