# OWASP Top 10 Protection with AWS WAF

This document explains how the AWS WAF implementation in this project helps protect against the OWASP Top 10 web application security risks. The OWASP Top 10 is a standard awareness document for developers and web application security that represents a broad consensus about the most critical security risks to web applications.

## OWASP Top 10 (2021) Overview

| Rank | Category | Description |
|------|----------|-------------|
| A01 | Broken Access Control | Restrictions on what authenticated users are allowed to do are not properly enforced |
| A02 | Cryptographic Failures | Failures related to cryptography that often lead to sensitive data exposure |
| A03 | Injection | User-supplied data is not validated, filtered, or sanitized by the application |
| A04 | Insecure Design | Flaws in design that cannot be fixed by proper implementation |
| A05 | Security Misconfiguration | Improper implementation of controls intended to keep application data safe |
| A06 | Vulnerable and Outdated Components | Using components with known vulnerabilities |
| A07 | Identification and Authentication Failures | Authentication-related attacks that target user identity |
| A08 | Software and Data Integrity Failures | Code and infrastructure that does not protect against integrity violations |
| A09 | Security Logging and Monitoring Failures | Insufficient logging and monitoring |
| A10 | Server-Side Request Forgery (SSRF) | Server-side application can be induced to make requests to an unintended location |

## AWS WAF Protection Mechanisms

### 1. AWS Managed Rules Common Rule Set

The AWS Managed Rules Common Rule Set (CRS) provides protection against exploitation of a wide range of vulnerabilities, including many in the OWASP Top 10. This rule set is included in our WAF implementation with priority 3.

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

#### CRS Protection Coverage

| OWASP Risk | CRS Rules | Protection Mechanism |
|------------|-----------|----------------------|
| A01: Broken Access Control | GenericRFI_BODY, GenericRFI_QUERYARGUMENTS | Blocks request patterns associated with directory traversal and remote file inclusion |
| A03: Injection | SQLi_BODY, SQLi_QUERYARGUMENTS | Blocks SQL injection patterns in request body and query parameters |
| A03: Injection | CrossSiteScripting_BODY, CrossSiteScripting_QUERYARGUMENTS | Blocks XSS patterns in request body and query parameters |
| A05: Security Misconfiguration | NoUserAgent_HEADER | Blocks requests with no user agent header |
| A07: Identification and Authentication Failures | EC2MetaDataSSRF_BODY, EC2MetaDataSSRF_QUERYARGUMENTS | Blocks attempts to access EC2 metadata service |
| A10: SSRF | EC2MetaDataSSRF_BODY, EC2MetaDataSSRF_QUERYARGUMENTS | Blocks SSRF attempts targeting EC2 metadata service |

### 2. AWS Managed Rules Bot Control Rule Set

The Bot Control Rule Set helps protect against automated threats and bot traffic. This rule set is included in our WAF implementation with priority 2.

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

#### Bot Control Protection Coverage

| OWASP Risk | Protection Mechanism |
|------------|----------------------|
| A01: Broken Access Control | Detects and blocks automated attempts to bypass access controls |
| A03: Injection | Blocks automated injection attacks from bots |
| A07: Identification and Authentication Failures | Blocks credential stuffing and brute force attacks |

### 3. AWS Managed Rules Amazon IP Reputation List

The IP Reputation List blocks requests from IP addresses on Amazon threat intelligence lists. This rule set is included in our WAF implementation with priority 1.

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

#### IP Reputation Protection Coverage

| OWASP Risk | Protection Mechanism |
|------------|----------------------|
| A01: Broken Access Control | Blocks requests from known malicious IP addresses |
| A03: Injection | Blocks known sources of injection attacks |
| A07: Identification and Authentication Failures | Blocks known sources of authentication attacks |

### 4. Custom Block Query Rule

The custom rule blocks requests containing specific strings in the query parameters. This rule is included in our WAF implementation with priority 4.

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

#### Custom Rule Protection Coverage

| OWASP Risk | Protection Mechanism |
|------------|----------------------|
| A03: Injection | Can be customized to block specific injection patterns |
| A10: SSRF | Can be customized to block SSRF attempts |

### 5. CloudWatch Logging and Monitoring

The WAF implementation includes comprehensive logging and monitoring to address OWASP A09: Security Logging and Monitoring Failures.

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
  redactedFields: []
});
```

## OWASP Coverage Summary

| OWASP Risk | Coverage Level | Protection Mechanisms |
|------------|----------------|----------------------|
| A01: Broken Access Control | High | IP Reputation List, Bot Control, Common Rule Set |
| A02: Cryptographic Failures | Limited | Not directly addressed by WAF (requires application-level controls) |
| A03: Injection | High | Common Rule Set (SQLi, XSS rules), Bot Control, Custom Rules |
| A04: Insecure Design | Limited | Not directly addressed by WAF (requires secure design practices) |
| A05: Security Misconfiguration | Medium | Common Rule Set (NoUserAgent_HEADER) |
| A06: Vulnerable and Outdated Components | Limited | Not directly addressed by WAF (requires application-level controls) |
| A07: Identification and Authentication Failures | Medium | IP Reputation List, Bot Control |
| A08: Software and Data Integrity Failures | Limited | Not directly addressed by WAF (requires application-level controls) |
| A09: Security Logging and Monitoring Failures | High | CloudWatch Logs, CloudWatch Metrics |
| A10: Server-Side Request Forgery | Medium | Common Rule Set (EC2MetaDataSSRF rules), Custom Rules |

## Enhancing OWASP Protection

While AWS WAF provides strong protection against many OWASP Top 10 risks, it should be part of a defense-in-depth strategy. Consider these additional measures:

1. **Application-Level Security Controls**: Implement input validation, output encoding, and proper authentication/authorization
2. **Regular Security Testing**: Conduct penetration testing and vulnerability scanning
3. **Security Headers**: Implement security headers like Content-Security-Policy, X-XSS-Protection, etc.
4. **Additional WAF Rules**: Create custom rules for application-specific vulnerabilities
5. **AWS Shield**: Add DDoS protection with AWS Shield
6. **AWS Security Hub**: Enable Security Hub for comprehensive security posture management

## References

- [OWASP Top 10 (2021)](https://owasp.org/Top10/)
- [AWS WAF Security Automations](https://aws.amazon.com/solutions/implementations/aws-waf-security-automations/)
- [AWS WAF Rules](https://docs.aws.amazon.com/waf/latest/developerguide/waf-rules.html)
- [AWS Managed Rules for WAF](https://docs.aws.amazon.com/waf/latest/developerguide/aws-managed-rule-groups-list.html)
