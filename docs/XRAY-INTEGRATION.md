# AWS X-Ray Integration for Lambda

This repo enables AWS X-Ray tracing for all Lambda functions via the SAM template.

## What’s already configured

- `template.yaml` → `Globals.Function.Tracing: Active`
- `template.yaml` → `Globals.Function.Policies: - AWSXRayDaemonWriteAccess`

This ensures traces are sampled and the Lambda role can publish segments and telemetry to X-Ray.

## Optional: API Gateway tracing

If you use API Gateway (HTTP API), enable X-Ray tracing for the API stage to get end-to-end traces.

Example (CloudFormation for HTTP API Stage):
```yaml
MyHttpApiStage:
  Type: AWS::ApiGatewayV2::Stage
  Properties:
    ApiId: !Ref EcommerceHttpApi
    StageName: $default
    AutoDeploy: true
    AccessLogSettings:
      DestinationArn: !GetAtt ApiAccessLogs.Arn
      Format: '{"requestId":"$context.requestId","ip":"$context.identity.sourceIp","requestTime":"$context.requestTime","httpMethod":"$context.httpMethod","routeKey":"$context.routeKey","status":"$context.status","protocol":"$context.protocol","responseLength":"$context.responseLength"}'
    DefaultRouteSettings:
      DataTraceEnabled: true
      DetailedMetricsEnabled: true
```

Note: For REST APIs, use `TracingEnabled: true` on the Stage resource.

## Viewing traces

1. Open AWS Console → X-Ray → Traces
2. Filter by `service("lambda")` or by function name
3. Use Service Map to navigate between API Gateway, Lambda, and downstream services (DynamoDB, S3)

## Sampling rules (optional)

To adjust trace sampling rate, define X-Ray sampling rules in the X-Ray console (or via `xray:PutSamplingRule`). Default sampling applies if none are set.

## SDK notes

Lambda integrates natively with X-Ray; you do NOT need the X-Ray SDK within the function to emit basic segments. If you want subsegments (e.g., wrapping calls to DynamoDB, S3, or external APIs), use the X-Ray SDK:

- Node.js: `aws-xray-sdk` / `aws-xray-sdk-core`
- Python: `aws_xray_sdk`

Wrap your AWS SDK client with the X-Ray SDK to get downstream subsegments.
