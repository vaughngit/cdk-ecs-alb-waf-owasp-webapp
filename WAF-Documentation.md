# AWS WAF Implementation Documentation

This document provides detailed technical documentation for the AWS WAF implementation in this project. It covers the architecture, rule configurations, integration with the application load balancer, logging, and best practices.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [WAF Stack Implementation](#waf-stack-implementation)
3. [Rule Sets and Priorities](#rule-sets-and-priorities)
4. [Custom Rules](#custom-rules)
5. [Logging and Monitoring](#logging-and-monitoring)
6. [Integration with Application Load Balancer](#integration-with-application-load-balancer)
7. [Testing Methodology](#testing-methodology)
8. [Security Best Practices](#security-best-practices)
9. [Troubleshooting](#troubleshooting)

## Architecture Overview

The AWS WAF implementation follows a layered security approach:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  Client Request ├────►│  AWS WAF (ACL)  ├────►│  Application    │
│                 │     │                 │     │  Load Balancer  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                                                         ▼
                                               ┌─────────────────┐
                                               │                 │
                                               │  ECS Fargate    │
                                               │  Containers     │
                                               │                 │
                                               └─────────────────┘
```

The WAF is deployed as a regional Web ACL and associated with the Application Load Balancer. All incoming traffic to the ALB is first evaluated by the WAF rules before being forwarded to the application containers.

## WAF Stack Implementation

The WAF stack is implemented in `lib/aws-cdk-wafv2.ts` using AWS CDK. The stack creates:

1. A Web ACL with multiple rule sets
2. An association between the Web ACL and the Application Load Balancer
3. CloudWatch logging configuration for WAF events
4. CloudWatch metrics for monitoring rule matches

### Key Components

```typescript
// Create WAF aka Web ACL 
const exampleWebAcl = new wafv2.CfnWebACL(this, "web-acl", {
  defaultAction: {
      allow: {},
  },
  name: `${props.serviceName}-waf`, 
  description: "cdk WAF deployment", 
  scope: "REGIONAL",
  visibilityConfig: {
      cloudWatchMetricsEnabled: true,
      metricName: "webACL",
      sampledRequestsEnabled: true
  },
  rules: [
    awsManagedRulesCommonRuleSet,
    amazonIpReputationList,
    blockQueryRule,
    awsManagedRulesBotControlRuleSet
  ]
});

// Associate the WAF to the ALB
const demoWaf = new wafv2.CfnWebACLAssociation(this, "web-acl-association", {
  webAclArn: exampleWebAcl.attrArn,
  resourceArn: props.alb.loadBalancerArn,
});
```

## Rule Sets and Priorities

The WAF implementation includes multiple rule sets with specific priorities to ensure proper evaluation order:

| Rule Set | Priority | Description |
|----------|----------|-------------|
| AWS-AWSManagedRulesAmazonIpReputationList | 1 | Blocks requests from IP addresses on Amazon threat intelligence lists |
| AWS-AWSManagedRulesBotControlRuleSet | 2 | Detects and blocks bot traffic based on behavioral patterns |
| AWS-AWSManagedRulesCommonRuleSet | 3 | Provides protection against common web vulnerabilities (OWASP Top 10) |
| BlockQueriesContainingSubString | 4 | Custom rule to block requests containing 'blockme' in the query string |

### Priority Considerations

The rule priorities have been carefully chosen to optimize security and performance:

1. **IP Reputation List (Priority 1)**: Blocks known malicious IPs early in the evaluation process, reducing unnecessary processing of requests from known bad actors.

2. **Bot Control Rule Set (Priority 2)**: Identifies and manages bot traffic before more complex rule evaluations. This is particularly important for protecting against automated attacks.

3. **Common Rule Set (Priority 3)**: Provides comprehensive protection against common web vulnerabilities after known bad IPs and bots have been filtered.

4. **Custom Block Query Rule (Priority 4)**: Custom application-specific rule that runs after the managed rules.

## Custom Rules

The implementation includes a custom rule to block requests containing specific strings in the query parameters:

```typescript
const blockQueryRule: wafv2.CfnWebACL.RuleProperty = {
  name: 'BlockQueriesContainingSubString',
  priority: 4,
  action: { block: {} },
  statement: {
    byteMatchStatement: {
      searchString: 'blockme',
      fieldToMatch: {queryString: {}},
      positionalConstraint: "CONTAINS",
      textTransformations: [{
        priority: 0,
        type: 'NONE',
      }]
    }, 
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "custom__block_rule",
    sampledRequestsEnabled: true
  }
}
```

### Custom Rule Types

AWS WAF supports various types of custom rules that can be implemented:

1. **Byte Match Statements**: Match specific strings in request components
2. **Geo Match Statements**: Match requests from specific geographic locations
3. **IP Set Statements**: Match requests from specific IP addresses or ranges
4. **Regex Pattern Statements**: Match requests using regular expressions
5. **Size Constraint Statements**: Match requests based on size
6. **SQL Injection Statements**: Detect SQL injection attacks
7. **XSS Match Statements**: Detect cross-site scripting attacks

## Logging and Monitoring

The WAF implementation includes comprehensive logging and monitoring:

```typescript
// Create log group to capture and store WAF logs 
const wafLogGroup = new logs.LogGroup(this, 'create LogGroup', {
    logGroupName: `aws-waf-logs-${props.solutionName}`,
    retention: logs.RetentionDays.ONE_WEEK,
    removalPolicy: RemovalPolicy.DESTROY
});

// Associate WAF with CloudWatch Log Group for logging
new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfiguration', {
    logDestinationConfigs: [
      `arn:aws:logs:${this.region}:${this.account}:log-group:${wafLogGroup.logGroupName}`
    ],
    resourceArn: exampleWebAcl.attrArn,
    redactedFields: [
      // Uncomment and customize if you need to redact specific fields
      // { singleHeader: { name: 'authorization' } },
      // { queryString: {} }
    ]
});
```

### Log Fields

The WAF logs include the following information:

- Timestamp of the request
- Web ACL ID and name
- Rule ID and name that matched the request
- Action taken (ALLOW, BLOCK, COUNT)
- Request details (HTTP method, URI, headers, etc.)
- Client information (IP address, user agent, etc.)

### Metrics

Each rule has CloudWatch metrics enabled for monitoring:

```typescript
visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "BotControlRules",
    sampledRequestsEnabled: true
}
```

Key metrics available:

- **AllowedRequests**: Number of requests allowed by the rule
- **BlockedRequests**: Number of requests blocked by the rule
- **CountedRequests**: Number of requests counted by the rule (for rules in Count mode)
- **PassedRequests**: Number of requests that didn't match the rule

## Integration with Application Load Balancer

The WAF Web ACL is associated with the Application Load Balancer using the `CfnWebACLAssociation` construct:

```typescript
const demoWaf = new wafv2.CfnWebACLAssociation(this, "web-acl-association", {
  webAclArn: exampleWebAcl.attrArn,
  resourceArn: props.alb.loadBalancerArn,
});
```

This association ensures that all traffic to the ALB is first evaluated by the WAF rules before being forwarded to the application.

## Testing Methodology

### Automated Testing

The project includes automated testing using Docker containers:

```bash
# Test allowed traffic
docker run -d --rm -e URL=http://<your-alb-dns>/?allowme -e CRON_SCHEDULE="* * * * *" lecovi/curl-cron

# Test blocked traffic
docker run -d --rm -e URL=http://<your-alb-dns>/?blockme -e CRON_SCHEDULE="* * * * *" lecovi/curl-cron
```

### Manual Testing

1. **Custom Block Rule Testing**:
   - Access the application URL with `?blockme` in the query string
   - Verify that the request is blocked

2. **XSS Protection Testing**:
   - Attempt to inject script tags in form fields
   - Example: `<iframe src="javascript:alert(`xss`)">`
   - Verify that the request is blocked

3. **Bot Protection Testing**:
   - Use automated tools like curl or wget with custom user agents
   - Verify that suspicious bot traffic is blocked

## Security Best Practices

### Rule Configuration Best Practices

1. **Prioritize Rules Properly**: Place rules that block known bad actors early in the evaluation process
2. **Use Count Mode First**: Deploy new rules in Count mode before switching to Block mode
3. **Monitor False Positives**: Regularly review logs for false positives and adjust rules as needed
4. **Layer Security Controls**: Use WAF in conjunction with other security controls like security groups

### Logging Best Practices

1. **Enable Full Logging**: Ensure all WAF events are logged
2. **Consider Sensitive Data**: Use redacted fields to protect sensitive information
3. **Set Appropriate Retention**: Configure log retention based on compliance requirements
4. **Monitor Logs**: Set up CloudWatch Alarms for suspicious activity

## Troubleshooting

### Common Issues

1. **Rule Not Blocking Traffic**:
   - Verify rule priority and order
   - Check rule configuration for errors
   - Ensure the WAF is properly associated with the ALB

2. **High Rate of False Positives**:
   - Review rule configurations
   - Consider excluding specific rules that cause problems
   - Use more specific matching conditions

3. **Performance Issues**:
   - Optimize rule order (put simpler rules first)
   - Use rate-based rules for DDoS protection
   - Monitor WAF metrics for bottlenecks

### Debugging Steps

1. Check WAF logs in CloudWatch Logs
2. Verify WAF association with the ALB
3. Test rules individually in Count mode
4. Use AWS WAF Testing in the console

## Additional Resources

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html)
- [AWS WAF Security Automations](https://aws.amazon.com/solutions/implementations/aws-waf-security-automations/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Blog](https://aws.amazon.com/blogs/security/)
