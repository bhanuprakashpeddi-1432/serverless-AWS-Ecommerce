"""
Process Payment Lambda Handler
DUMMY IMPLEMENTATION - Always succeeds for demo purposes
No external payment gateway required
"""
import json
import uuid
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

logger = Logger()
tracer = Tracer()


@tracer.capture_lambda_handler
@logger.inject_lambda_context
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point - DUMMY PAYMENT (always succeeds)."""
    
    try:
        order_id = event.get('orderId')
        amount = event.get('amount')
        currency = event.get('currency', 'USD')
        payment_method_id = event.get('paymentMethodId')
        
        logger.info(f"[DEMO] Processing dummy payment for order: {order_id}, amount: {amount} {currency}", extra={
            'order_id': order_id,
            'amount': amount,
            'currency': currency,
            'demo_mode': True
        })
        
        # DUMMY IMPLEMENTATION - Always succeeds
        # In production, integrate with Stripe, PayPal, Square, etc.
        transaction_id = f"DEMO-{uuid.uuid4().hex[:12].upper()}"
        
        result = {
            'status': 'completed',
            'transactionId': transaction_id,
            'message': f'Payment of {amount} {currency} processed successfully (DEMO MODE)',
            'demoMode': True
        }
        
        logger.info(f"[DEMO] Payment processed successfully: {result}")
        
        return result
        
    except Exception as e:
        logger.exception("[DEMO] Error in dummy payment handler")
        return {
            'status': 'failed',
            'transactionId': '',
            'message': f'Payment failed: {str(e)}',
            'demoMode': True
        }
