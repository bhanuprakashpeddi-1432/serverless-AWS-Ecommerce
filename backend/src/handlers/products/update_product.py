"""
Update Product Lambda Handler
PUT /products/{id} - Update an existing product (Admin only)
"""
import json
import os
from datetime import datetime
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
        body = json.loads(event.get('body', '{}'))
        
        # Build update expression
        update_parts = []
        attr_names = {}
        attr_values = {}
        
        updateable_fields = {
            'name': 'string',
            'description': 'string',
            'price': 'float',
            'inventory': 'int',
            'status': 'string',
            'brand': 'string',
            'images': 'list',
            'attributes': 'dict'
        }
        
        for field, field_type in updateable_fields.items():
            if field in body:
                update_parts.append(f"#{field} = :{field}")
                attr_names[f'#{field}'] = field
                
                if field_type == 'float':
                    attr_values[f':{field}'] = float(body[field])
                elif field_type == 'int':
                    attr_values[f':{field}'] = int(body[field])
                else:
                    attr_values[f':{field}'] = body[field]
        
        if not update_parts:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'error': 'NO_UPDATES',
                    'message': 'No valid fields to update'
                })
            }
        
        # Always update timestamp
        update_parts.append('#updatedAt = :updatedAt')
        attr_names['#updatedAt'] = 'updatedAt'
        attr_values[':updatedAt'] = datetime.utcnow().isoformat() + 'Z'
        
        update_expression = 'SET ' + ', '.join(update_parts)
        
        # Update item
        response = table.update_item(
            Key={
                'PK': f'PRODUCT#{product_id}',
                'SK': 'METADATA'
            },
            UpdateExpression=update_expression,
            ExpressionAttributeNames=attr_names,
            ExpressionAttributeValues=attr_values,
            ReturnValues='ALL_NEW'
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(response['Attributes'], default=str),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except Exception as e:
        logger.exception("Error updating product")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': str(e)
            })
        }
