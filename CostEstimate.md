# Cost Estimate for WAFv2Stack

This document provides a cost estimate for the services in the WAFv2Stack after adding the AWSManagedRulesBotControlRuleSet.

## AWS WAF Costs

1. **Web ACL**: $5.00 per month
2. **Rules**: $1.00 per rule per month
   - AWSManagedRulesCommonRuleSet: $1.00
   - AWSManagedRulesAmazonIpReputationList: $1.00
   - Custom blockQueryRule: $1.00
   - AWSManagedRulesBotControlRuleSet: $1.00
   - Total for rules: $4.00
3. **Bot Control**: $10.00 per month (subscription fee for Bot Control)
4. **Request Processing**: $0.60 per million requests
   - Varies based on your traffic volume
   - Example: 10 million requests per month = $6.00

## CloudWatch Logs Costs

1. **Log Ingestion**: $0.50 per GB after the first 5GB free tier
   - Varies based on your traffic volume and verbosity of logging
   - Example: 10GB of logs per month = $2.50 (after free tier)
2. **Log Storage**: $0.03 per GB for archived logs
   - Depends on compression ratio and retention period (ONE_WEEK in your case)
   - Example: If 10GB compresses to 2GB = $0.06

## Total Monthly Cost Estimate

**Base cost** (Web ACL + Rules + Bot Control): $19.00 per month

**Variable cost** (depends on traffic):
- 10M requests: $6.00
- 10GB logs: $2.56

**Estimated total** (with example traffic): $27.56 per month

Note: This is an estimate based on the example traffic volume. Actual costs will vary depending on:
1. The number of requests your application receives
2. The amount of log data generated
3. Any additional AWS services that interact with this stack
