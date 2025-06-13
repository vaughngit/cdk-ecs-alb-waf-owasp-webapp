# AWS WAF Cost Estimate

This document provides an estimate of the costs associated with running the AWS WAF implementation in this project. The costs are based on AWS pricing as of June 2025 and may change over time.

## Cost Components

The AWS WAF implementation includes the following cost components:

1. **AWS WAF Web ACL**: Base cost for the Web ACL
2. **AWS WAF Rules**: Cost per rule in the Web ACL
3. **AWS WAF Requests**: Cost per request processed by the WAF
4. **CloudWatch Logs**: Cost for storing WAF logs
5. **CloudWatch Metrics**: Cost for WAF metrics

## Pricing Details

### AWS WAF Base Pricing

| Component | Price (USD) | Notes |
|-----------|-------------|-------|
| Web ACL | $5.00 per month | Base price per Web ACL |
| Rule | $1.00 per rule per month | Price per rule in the Web ACL |
| Request | $0.60 per 1 million requests | Price per request processed by the WAF |
| Bot Control | $10.00 per month + $1.00 per 1 million requests | Additional cost for Bot Control rule set |

### CloudWatch Pricing

| Component | Price (USD) | Notes |
|-----------|-------------|-------|
| Logs | $0.50 per GB ingested | Price for log ingestion |
| Logs Storage | $0.03 per GB-month | Price for log storage |
| Metrics | $0.30 per metric per month | Price per custom metric |

## Cost Estimate for This Implementation

### WAF Costs

| Component | Quantity | Price (USD) | Monthly Cost (USD) |
|-----------|----------|-------------|-------------------|
| Web ACL | 1 | $5.00 per month | $5.00 |
| Rules | 4 | $1.00 per rule per month | $4.00 |
| Bot Control | 1 | $10.00 per month | $10.00 |
| Requests (1M) | 1 | $0.60 per 1M requests | $0.60 |
| Bot Control Requests (1M) | 1 | $1.00 per 1M requests | $1.00 |
| **Subtotal** | | | **$20.60** |

### CloudWatch Costs

| Component | Quantity | Price (USD) | Monthly Cost (USD) |
|-----------|----------|-------------|-------------------|
| Logs (1 GB) | 1 | $0.50 per GB | $0.50 |
| Logs Storage (1 GB) | 1 | $0.03 per GB-month | $0.03 |
| Metrics | 5 | $0.30 per metric per month | $1.50 |
| **Subtotal** | | | **$2.03** |

### Total Estimated Monthly Cost

| Component | Monthly Cost (USD) |
|-----------|-------------------|
| WAF | $20.60 |
| CloudWatch | $2.03 |
| **Total** | **$22.63** |

## Cost Optimization Tips

1. **Rule Consolidation**: Combine similar rules to reduce the number of rules in the Web ACL
2. **Log Filtering**: Configure logging to only capture relevant events
3. **Metric Consolidation**: Use fewer metrics by focusing on the most important ones
4. **Request Sampling**: Use sampling for high-volume applications to reduce costs

## Scaling Considerations

The cost estimate above is based on 1 million requests per month. For applications with higher traffic volumes, the costs will scale primarily based on the number of requests:

| Monthly Requests | WAF Cost (USD) | Bot Control Cost (USD) | Total WAF Cost (USD) |
|-----------------|----------------|------------------------|----------------------|
| 1 million | $0.60 | $1.00 | $1.60 |
| 10 million | $6.00 | $10.00 | $16.00 |
| 100 million | $60.00 | $100.00 | $160.00 |
| 1 billion | $600.00 | $1,000.00 | $1,600.00 |

## Additional Cost Factors

1. **Data Transfer**: Additional costs may apply for data transfer between AWS services
2. **AWS Shield**: Consider adding AWS Shield for additional DDoS protection (additional cost)
3. **AWS Firewall Manager**: Consider using Firewall Manager for centralized management of WAF across multiple accounts (additional cost)

## References

- [AWS WAF Pricing](https://aws.amazon.com/waf/pricing/)
- [Amazon CloudWatch Pricing](https://aws.amazon.com/cloudwatch/pricing/)
- [AWS Data Transfer Pricing](https://aws.amazon.com/ec2/pricing/on-demand/#Data_Transfer)
