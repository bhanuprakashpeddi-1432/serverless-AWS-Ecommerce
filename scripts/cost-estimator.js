#!/usr/bin/env node

/*
  AWS Monthly Cost Estimator (rough order-of-magnitude)
  - Lambda requests + optional compute (memory/duration)
  - DynamoDB on-demand (reads/writes) or provisioned (RCU/WCU)
  - S3 & CloudFront bandwidth (GB egress)

  Defaults target us-east-1 ballpark pricing as of 2025-11; override via CLI args.

  Usage examples:
    node scripts/cost-estimator.js \
      --lambda-invocations 5000000 \
      --lambda-memory-mb 512 --lambda-duration-ms 200 \
      --dynamo-mode on-demand --dynamo-reads 20000000 --dynamo-writes 2000000 \
      --s3-egress-gb 50 --cf-egress-gb 500

    node scripts/cost-estimator.js \
      --dynamo-mode provisioned --rcu 200 --wcu 50

  Pricing overrides (optional):
    --price-lambda-requests-per-1m 0.20
    --price-lambda-gbsec 0.0000166667
    --price-dynamo-rru-per-1m 0.25
    --price-dynamo-wru-per-1m 1.25
    --price-dynamo-rcu-hour 0.00013
    --price-dynamo-wcu-hour 0.00065
    --price-s3-egress-gb 0.085
    --price-cf-egress-gb 0.085
*/

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.includes('=') ? a.split('=') : [a, argv[i + 1]];
      const key = k.replace(/^--/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (!a.includes('=') && (v === undefined || v.startsWith('--'))) {
        args[key] = true; // boolean flag
      } else {
        args[key] = isNaN(Number(v)) ? v : Number(v);
        if (!a.includes('=') && v !== undefined && !v.startsWith('--')) i++;
      }
    }
  }
  return args;
}

const HOURS_IN_MONTH = 730; // average

// Default unit prices (us-east-1 ballpark)
const PRICES = {
  lambdaRequestsPer1m: 0.20, // $0.20 per 1M requests
  lambdaGbsec: 0.0000166667, // $ per GB-second (x86)
  dynamoRruPer1m: 0.25,      // On-demand reads per 1M RRU
  dynamoWruPer1m: 1.25,      // On-demand writes per 1M WRU
  dynamoRcuHour: 0.00013,    // Provisioned RCU per hour
  dynamoWcuHour: 0.00065,    // Provisioned WCU per hour
  s3EgressGb: 0.085,         // S3 egress per GB (first 10TB)
  cfEgressGb: 0.085          // CloudFront egress per GB (US/EU PriceClass_100)
};

function currency(n) {
  return `$${n.toFixed(2)}`;
}

function computeLambdaCost({
  invocations = 0,
  avgDurationMs,
  memoryMB,
  priceRequestsPer1m = PRICES.lambdaRequestsPer1m,
  priceGbsec = PRICES.lambdaGbsec
}) {
  const requestCost = (invocations / 1_000_000) * priceRequestsPer1m;
  let computeCost = 0;
  if (avgDurationMs && memoryMB) {
    const gb = memoryMB / 1024;
    const seconds = avgDurationMs / 1000;
    const gbSeconds = gb * seconds * invocations;
    computeCost = gbSeconds * priceGbsec;
  }
  return { requestCost, computeCost, total: requestCost + computeCost };
}

function computeDynamoOnDemand({
  readRequests = 0,
  writeRequests = 0,
  priceRruPer1m = PRICES.dynamoRruPer1m,
  priceWruPer1m = PRICES.dynamoWruPer1m
}) {
  const readCost = (readRequests / 1_000_000) * priceRruPer1m;
  const writeCost = (writeRequests / 1_000_000) * priceWruPer1m;
  return { readCost, writeCost, total: readCost + writeCost };
}

function computeDynamoProvisioned({
  rcu = 0,
  wcu = 0,
  priceRcuHour = PRICES.dynamoRcuHour,
  priceWcuHour = PRICES.dynamoWcuHour
}) {
  const readCost = rcu * priceRcuHour * HOURS_IN_MONTH;
  const writeCost = wcu * priceWcuHour * HOURS_IN_MONTH;
  return { readCost, writeCost, total: readCost + writeCost };
}

function computeBandwidth({ s3Gb = 0, cfGb = 0, priceS3 = PRICES.s3EgressGb, priceCf = PRICES.cfEgressGb }) {
  const s3Cost = s3Gb * priceS3;
  const cfCost = cfGb * priceCf;
  return { s3Cost, cfCost, total: s3Cost + cfCost };
}

function main() {
  const a = parseArgs(process.argv);

  // Lambda
  const lambda = computeLambdaCost({
    invocations: a.lambdaInvocations || 0,
    avgDurationMs: a.lambdaDurationMs,
    memoryMB: a.lambdaMemoryMb,
    priceRequestsPer1m: a.priceLambdaRequestsPer1m || PRICES.lambdaRequestsPer1m,
    priceGbsec: a.priceLambdaGbsec || PRICES.lambdaGbsec
  });

  // DynamoDB
  let dynamo;
  const mode = (a.dynamoMode || 'on-demand').toString();
  if (mode === 'on-demand') {
    dynamo = computeDynamoOnDemand({
      readRequests: a.dynamoReads || 0,
      writeRequests: a.dynamoWrites || 0,
      priceRruPer1m: a.priceDynamoRruPer1m || PRICES.dynamoRruPer1m,
      priceWruPer1m: a.priceDynamoWruPer1m || PRICES.dynamoWruPer1m
    });
  } else if (mode === 'provisioned') {
    dynamo = computeDynamoProvisioned({
      rcu: a.rcu || 0,
      wcu: a.wcu || 0,
      priceRcuHour: a.priceDynamoRcuHour || PRICES.dynamoRcuHour,
      priceWcuHour: a.priceDynamoWcuHour || PRICES.dynamoWcuHour
    });
  } else {
    throw new Error(`Unknown --dynamo-mode: ${mode} (use on-demand|provisioned)`);
  }

  // Bandwidth
  const bw = computeBandwidth({
    s3Gb: a.s3EgressGb || 0,
    cfGb: a.cfEgressGb || 0,
    priceS3: a.priceS3EgressGb || PRICES.s3EgressGb,
    priceCf: a.priceCfEgressGb || PRICES.cfEgressGb
  });

  const total = lambda.total + dynamo.total + bw.total;

  const out = {
    params: {
      lambdaInvocations: a.lambdaInvocations || 0,
      lambdaDurationMs: a.lambdaDurationMs || null,
      lambdaMemoryMb: a.lambdaMemoryMb || null,
      dynamoMode: mode,
      dynamoReads: a.dynamoReads || null,
      dynamoWrites: a.dynamoWrites || null,
      rcu: a.rcu || null,
      wcu: a.wcu || null,
      s3EgressGb: a.s3EgressGb || 0,
      cfEgressGb: a.cfEgressGb || 0
    },
    estimates: {
      lambda: {
        requestCost: lambda.requestCost,
        computeCost: lambda.computeCost,
        total: lambda.total
      },
      dynamodb: {
        readCost: dynamo.readCost,
        writeCost: dynamo.writeCost,
        total: dynamo.total,
        mode
      },
      bandwidth: {
        s3Cost: bw.s3Cost,
        cfCost: bw.cfCost,
        total: bw.total
      },
      monthlyTotal: total
    }
  };

  // Pretty print
  console.log('\nAWS Monthly Cost Estimate (rough):');
  console.log(`  Lambda Requests:        ${currency(lambda.requestCost)}`);
  if (lambda.computeCost) console.log(`  Lambda Compute:         ${currency(lambda.computeCost)}`);
  console.log(`  DynamoDB (${mode}):        ${currency(dynamo.total)} (R: ${currency(dynamo.readCost)} W: ${currency(dynamo.writeCost)})`);
  console.log(`  Bandwidth (S3+CF):      ${currency(bw.total)} (S3: ${currency(bw.s3Cost)} CF: ${currency(bw.cfCost)})`);
  console.log(`  ---------------------------------------------`);
  console.log(`  Monthly Total:          ${currency(total)}`);

  // Guidance
  console.log('\nCaching Suggestions:');
  console.log('- CloudFront: cache static assets aggressively (immutable, 1y), index.html no-cache.');
  console.log('- CloudFront: enable compression; consider small TTL for dynamic JSON if cacheable.');
  console.log('- API Gateway: consider stage-level cache for popular GETs (idempotent, predictable).');
  console.log('- Client: leverage HTTP caching (ETag/Last-Modified) on product listings.');

  console.log('\nDynamoDB Mode Guidance:');
  console.log('- On-Demand: best for unpredictable/spiky traffic; pay per request.');
  console.log('- Provisioned: cheaper for steady high traffic; set RCU/WCU with autoscaling.');
  console.log('- Rule of thumb: if monthly RRU/WRU are predictable and high, evaluate provisioned.');

  if (a.json) {
    // Emit machine-readable JSON if requested
    console.log('\nJSON Output:');
    console.log(JSON.stringify(out, null, 2));
  }
}

main();
