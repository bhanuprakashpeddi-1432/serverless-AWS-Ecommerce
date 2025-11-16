"""
Get Products Lambda Handler
GET /products - List all products with filtering and pagination
"""
import json
import os
from typing import Any, Dict
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.event_handler import APIGatewayHttpResolver
from aws_lambda_powertools.utilities.typing import LambdaContext
import boto3
from boto3.dynamodb.conditions import Key, Attr

logger = Logger()
tracer = Tracer()
app = APIGatewayHttpResolver()

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['PRODUCTS_TABLE'])


@tracer.capture_method
def get_products(
    category: str = None,
    min_price: float = None,
    max_price: float = None,
    search: str = None,
    limit: int = 20,
    next_token: str = None
) -> Dict[str, Any]:
    """Query products from DynamoDB with filtering."""
    
    try:
        # Build query parameters
        query_params = {
            'Limit': min(limit, 100)  # Max 100 items per request
        }
        
        # Use GSI for category filtering
        if category:
            query_params['IndexName'] = 'CategoryIndex'
            query_params['KeyConditionExpression'] = Key('GSI1PK').eq(f'CATEGORY#{category}')
            
            # Add price range filter
            if min_price is not None or max_price is not None:
                filter_expressions = []
                if min_price is not None:
                    filter_expressions.append(Attr('price').gte(min_price))
                if max_price is not None:
                    filter_expressions.append(Attr('price').lte(max_price))
                
                if filter_expressions:
                    query_params['FilterExpression'] = filter_expressions[0]
                    for expr in filter_expressions[1:]:
                        query_params['FilterExpression'] &= expr
            
            response = table.query(**query_params)
        else:
            # Scan for non-category queries (less efficient)
            scan_params = {
                'Limit': query_params['Limit'],
                'FilterExpression': Attr('SK').eq('METADATA') & Attr('status').eq('active')
            }
            
            # Add price filters
            if min_price is not None:
                scan_params['FilterExpression'] &= Attr('price').gte(min_price)
            if max_price is not None:
                scan_params['FilterExpression'] &= Attr('price').lte(max_price)
            
            # Add search filter
            if search:
                search_filter = (
                    Attr('name').contains(search) | 
                    Attr('description').contains(search)
                )
                scan_params['FilterExpression'] &= search_filter
            
            if next_token:
                scan_params['ExclusiveStartKey'] = json.loads(next_token)
            
            response = table.scan(**scan_params)
        
        # Format response
        products = response.get('Items', [])
        result = {
            'products': products,
            'count': len(products)
        }
        
        # Add pagination token if there are more results
        if 'LastEvaluatedKey' in response:
            result['nextToken'] = json.dumps(response['LastEvaluatedKey'])
        
        return result
        
    except Exception as e:
        logger.exception("Error querying products")
        raise


@app.get("/products")
@tracer.capture_method
def list_products():
    """Handle GET /products request."""
    
    # Extract query parameters
    params = app.current_event.query_string_parameters or {}
    
    category = params.get('category')
    min_price = float(params['minPrice']) if params.get('minPrice') else None
    max_price = float(params['maxPrice']) if params.get('maxPrice') else None
    search = params.get('search')
    limit = int(params.get('limit', 20))
    next_token = params.get('nextToken')
    
    logger.info("Fetching products", extra={
        'category': category,
        'min_price': min_price,
        'max_price': max_price,
        'search': search,
        'limit': limit
    })
    
    try:
        result = get_products(
            category=category,
            min_price=min_price,
            max_price=max_price,
            search=search,
            limit=limit,
            next_token=next_token
        )
        
        return {
            'statusCode': 200,
            'body': json.dumps(result),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
        
    except ValueError as e:
        logger.warning(f"Invalid parameter: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({
                'error': 'INVALID_PARAMETER',
                'message': str(e)
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }
    except Exception as e:
        logger.exception("Error processing request")
        return {
            'statusCode': 500,
            'body': json.dumps({
                'error': 'INTERNAL_ERROR',
                'message': 'An error occurred while processing your request'
            }),
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        }


@logger.inject_lambda_context
@tracer.capture_lambda_handler
def handler(event: Dict[str, Any], context: LambdaContext) -> Dict[str, Any]:
    """Lambda handler entry point."""
    logger.info("Received event", extra={'event': event})
    return app.resolve(event, context)
