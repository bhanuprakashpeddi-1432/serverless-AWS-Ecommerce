"""
Update Inventory Lambda Handler
Step Functions task to update product inventory after order
"""
import os
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource('dynamodb')
products_table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        order_id = event.get('orderId')
        items = event.get('items', [])
        
        logger.info(f"Updating inventory for order: {order_id}")
        
        for item in items:
            product_id = item['productId']
            quantity = item['quantity']
            
            # Decrement inventory
            products_table.update_item(
                Key={
                    'PK': f'PRODUCT#{product_id}',
                    'SK': 'METADATA'
                },
                UpdateExpression='SET inventory = inventory - :qty',
                ExpressionAttributeValues={
                    ':qty': quantity
                }
            )
            
            logger.info(f"Decremented inventory for {product_id} by {quantity}")
        
        return {
            'status': 'success',
            'message': f'Inventory updated for {len(items)} items'
        }
        
    except Exception as e:
        logger.exception("Error updating inventory")
        return {
            'status': 'error',
            'message': str(e)
        }
