"""
Start Checkout Lambda Handler
POST /checkout/start - Initiate checkout process
"""
import json
import os
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3

logger = Logger()
tracer = Tracer()

dynamodb = boto3.resource('dynamodb')
carts_table = dynamodb.Table(os.environ['CARTS_TABLE'])
orders_table = dynamodb.Table(os.environ['ORDERS_TABLE'])
stepfunctions = boto3.client('stepfunctions')


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    
    try:
        user_id = event['requestContext']['authorizer']['jwt']['claims']['sub']
        email = event['requestContext']['authorizer']['jwt']['claims'].get('email', '')
        body = json.loads(event.get('body', '{}'))
        
        # Get cart
        cart_response = carts_table.get_item(Key={'PK': f'USER#{user_id}', 'SK': 'CART'})
        
        if 'Item' not in cart_response or not cart_response['Item'].get('items'):
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'EMPTY_CART', 'message': 'Cart is empty'})
            }
        
        cart = cart_response['Item']
        
        # Create order
        order_id = f"ord-{uuid.uuid4().hex[:12]}"
        timestamp = datetime.utcnow().isoformat() + 'Z'
        
        order = {
            'PK': f'USER#{user_id}',
            'SK': f'ORDER#{order_id}',
            'orderId': order_id,
            'userId': user_id,
            'status': 'pending',
            'items': cart['items'],
            'totals': cart['totals'],
            'shippingAddress': body.get('shippingAddress', {}),
            'paymentMethodId': body.get('paymentMethodId', ''),
            'email': email,
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'GSI1PK': 'STATUS#pending',
            'GSI1SK': f"{timestamp}#{order_id}",
            'GSI2PK': 'ORDER',
            'GSI2SK': f"{timestamp}#{order_id}"
        }
        
        orders_table.put_item(Item=order)
        
        # Start Step Functions workflow
        state_machine_arn = os.environ.get('STATE_MACHINE_ARN')
        if state_machine_arn:
            stepfunctions.start_execution(
                stateMachineArn=state_machine_arn,
                name=f"order-{order_id}-{int(datetime.utcnow().timestamp())}",
                input=json.dumps(order, default=str)
            )
        
        # Clear cart
        carts_table.delete_item(Key={'PK': f'USER#{user_id}', 'SK': 'CART'})
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'orderId': order_id,
                'status': 'pending',
                'total': cart['totals']['total'],
                'currency': cart['totals']['currency'],
                'createdAt': timestamp
            }),
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}
        }
        
    except Exception as e:
        logger.exception("Error starting checkout")
        return {'statusCode': 500, 'body': json.dumps({'error': 'INTERNAL_ERROR', 'message': str(e)})}
