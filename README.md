# AWS WAF Protection for ECS Application

This project demonstrates how to implement AWS WAF (Web Application Firewall) protection for an ECS-based web application using AWS CDK. The solution provides comprehensive protection against common web vulnerabilities including OWASP Top 10 threats, bot attacks, and malicious IP addresses.

## Architecture Overview

![Architecture Diagram](https://d1.awsstatic.com/Solutions/Solutions%20Category%20Template%20Draft/Solution%20Architecture%20Diagrams/aws-waf-security-automations-architecture.2dc7b4c8b2ed0aee0f4263b7fadec5e8b6039bd8.png)

The solution consists of two main stacks:
1. **ECS Application Stack** - Deploys a containerized web application on AWS ECS with Fargate
2. **WAF Stack** - Implements AWS WAF with multiple rule sets to protect the application

## WAF Stack Features

The WAF stack (`lib/aws-cdk-wafv2.ts`) implements a comprehensive set of protection rules:

### 1. AWS Managed Rule Sets

The WAF configuration includes the following AWS managed rule sets:

| Rule Set | Priority | Description |
|----------|----------|-------------|
| AWS-AWSManagedRulesAmazonIpReputationList | 1 | Blocks requests from IP addresses on Amazon threat intelligence lists |
| AWS-AWSManagedRulesBotControlRuleSet | 2 | Detects and blocks bot traffic based on behavioral patterns |
| AWS-AWSManagedRulesCommonRuleSet | 3 | Provides protection against common web vulnerabilities (OWASP Top 10) |

### 2. Custom Rules

| Rule | Priority | Description |
|------|----------|-------------|
| BlockQueriesContainingSubString | 4 | Blocks requests containing 'blockme' in the query string |

### 3. Logging and Monitoring

The WAF configuration includes:
- CloudWatch logging for all WAF events
- CloudWatch metrics for monitoring rule matches and blocked requests
- One-week log retention policy

## Deployment Instructions

### Prerequisites

- Node.js LTS
- AWS CLI configured with appropriate permissions
- AWS CDK v2 installed
- Docker (for local testing)

### Deployment Steps

1. Clone this repository
   ```
   git clone <repository-url>
   cd cdk-ecs-alb-waf-owasp-webapp
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Update the target AWS region (if needed)
   ```
   # Edit bin/cdk-app-deploy.ts to update the aws_region variable
   ```

4. Deploy the ECS application stack
   ```
   cdk deploy ecs-webapp
   ```

5. Deploy the WAF stack
   ```
   cdk deploy waf
   ```

6. Access the application using the ALB URL displayed in the terminal output

## WAF Rule Configuration

### IP Reputation List Rule

Blocks requests from IP addresses identified by Amazon's threat intelligence as sources of malicious activity.

```typescript
const amazonIpReputationList: wafv2.CfnWebACL.RuleProperty = {
  name: "AWS-AWSManagedRulesAmazonIpReputationList",
  priority: 1,
  overrideAction: {none: {}},
  statement: {
    managedRuleGroupStatement: {
      name: "AWSManagedRulesAmazonIpReputationList",
      vendorName: "AWS"
    }
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "AmazonIpReputationRules",
    sampledRequestsEnabled: true
  }
}
```

### Bot Control Rule Set

Detects and manages requests from bots. This rule has been prioritized as #2 to ensure bot traffic is evaluated early in the request processing.

```typescript
const awsManagedRulesBotControlRuleSet: wafv2.CfnWebACL.RuleProperty = {
  name: "AWS-AWSManagedRulesBotControlRuleSet",
  priority: 2,
  overrideAction: {none: {}},
  statement: {
    managedRuleGroupStatement: {
      name: "AWSManagedRulesBotControlRuleSet",
      vendorName: "AWS"
    }
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "BotControlRules",
    sampledRequestsEnabled: true
  }
}
```

### Common Rule Set

Provides protection against common web vulnerabilities, including those in the OWASP Top 10.

```typescript
const awsManagedRulesCommonRuleSet: wafv2.CfnWebACL.RuleProperty = { 
  name: "AWS-AWSManagedRulesCommonRuleSet",
  priority: 3,
  overrideAction: {none: {}},
  statement: {
    managedRuleGroupStatement: {
      name: "AWSManagedRulesCommonRuleSet",
      vendorName: "AWS",
      excludedRules: [{name: "SizeRestrictions_BODY"}]
    }
  },
  visibilityConfig: {
    cloudWatchMetricsEnabled: true,
    metricName: "awsCommonRules",
    sampledRequestsEnabled: true
  }
}
```

### Custom Block Query Rule

Blocks requests containing the string "blockme" in the query parameters.

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

## Testing the WAF

### Automated Testing

You can use Docker containers to automatically test the WAF rules:

```bash
# Test allowed traffic (should pass through WAF)
docker run -d --rm -e URL=http://<your-alb-dns>/?allowme -e CRON_SCHEDULE="* * * * *" lecovi/curl-cron

# Test blocked traffic (should be blocked by WAF)
docker run -d --rm -e URL=http://<your-alb-dns>/?blockme -e CRON_SCHEDULE="* * * * *" lecovi/curl-cron
```

### Manual Testing

1. Access the application using the ALB URL
2. Test the custom block rule by appending `?blockme` to the URL
3. Test XSS protection by attempting to inject script tags in form fields
4. Monitor the CloudWatch logs to see WAF rule matches and blocked requests

## Monitoring and Logging

The WAF configuration includes comprehensive logging and monitoring:

1. **CloudWatch Logs**: All WAF events are logged to a CloudWatch log group with a one-week retention period
2. **CloudWatch Metrics**: Each rule has metrics enabled for monitoring rule matches
3. **WAF Console**: You can access the WAF console directly using the URL provided in the stack outputs

## Cleanup

To remove the deployed resources:

```bash
cdk destroy waf
cdk destroy ecs-webapp
```

## Additional Resources

For more information about AWS WAF and security best practices:

- [AWS WAF Documentation](https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/architecture/security-identity-compliance/)

## Notes

For additional implementation details and original project notes, see [notes.md](./notes.md).
