"""
Validate Inventory Lambda Handler
Step Functions task to validate product inventory availability
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
products_table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        order_id = event.get('orderId')
        items = event.get('items', [])
        
        logger.info(f"Validating inventory for order: {order_id}")
        
        all_available = True
        unavailable_items = []
        
        for item in items:
            product_id = item['productId']
            quantity = item['quantity']
            
            # Get product
            response = products_table.get_item(
                Key={
                    'PK': f'PRODUCT#{product_id}',
                    'SK': 'METADATA'
                }
            )
            
            if 'Item' not in response:
                all_available = False
                unavailable_items.append(product_id)
                continue
            
            product = response['Item']
            
            if product.get('inventory', 0) < quantity:
                all_available = False
                unavailable_items.append(product_id)
        
        result = {
            'status': 'success' if all_available else 'failed',
            'available': all_available,
            'message': 'All items available' if all_available else f'Insufficient inventory for: {", ".join(unavailable_items)}'
        }
        
        logger.info(f"Inventory validation result: {result}")
        
        return result
        
    except Exception as e:
        logger.exception("Error validating inventory")
        return {
            'status': 'error',
            'available': False,
            'message': str(e)
        }
