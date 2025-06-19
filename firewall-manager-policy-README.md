# Firewall Manager Policy Deployment Instructions

This document provides instructions for deploying the Firewall Manager policy in your Firewall Manager administrator account (113613946666).

## Prerequisites

1. You must have already deployed the ECS and WAF resources in your application account.
2. You must have the ARN of the WAF Web ACL created in your application account.
3. You must have permissions to deploy CloudFormation templates in the Firewall Manager administrator account.

## Deployment Steps

### Option 1: Using the AWS Management Console

1. Sign in to the AWS Management Console using your Firewall Manager administrator account (113613946666).
2. Navigate to the CloudFormation console.
3. Click "Create stack" and select "With new resources (standard)".
4. Choose "Upload a template file" and upload the `firewall-manager-policy.yaml` file.
5. Click "Next".
6. Enter a stack name (e.g., "firewall-manager-policy").
7. Fill in the parameters:
   - **SolutionName**: The name of your solution (should match the name used in the ECS stack)
   - **WebAclArn**: The ARN of the WAF Web ACL created in your application account (copy from the WebAclArn output of the Firewall Manager stack)
   - **TargetAccount**: The AWS account ID where your ECS and WAF resources are deployed
8. Click "Next", review the stack details, and click "Create stack".

### Option 2: Using the AWS CLI

1. Configure the AWS CLI with credentials for your Firewall Manager administrator account (113613946666).
2. Run the following command:

```bash
aws cloudformation create-stack \
  --stack-name firewall-manager-policy \
  --template-body file://firewall-manager-policy.yaml \
  --parameters \
    ParameterKey=SolutionName,ParameterValue=wafxssblocker-two \
    ParameterKey=WebAclArn,ParameterValue=<WAF-WEB-ACL-ARN> \
    ParameterKey=TargetAccount,ParameterValue=<TARGET-ACCOUNT-ID> \
  --region <REGION>
```

Replace `<WAF-WEB-ACL-ARN>` with the ARN of your WAF Web ACL, `<TARGET-ACCOUNT-ID>` with your application account ID, and `<REGION>` with the appropriate AWS region.

## Verification

After deploying the CloudFormation stack:

1. Navigate to the AWS Firewall Manager console in your administrator account.
2. Go to "Security policies" and verify that the new policy appears in the list.
3. Check that the policy is correctly targeting your application account and the WAF Web ACL.
4. Verify that the policy is being applied to your ALB resources in the application account.

## Troubleshooting

If the policy deployment fails:

1. Check that your Firewall Manager administrator account is properly set up.
2. Verify that the WAF Web ACL ARN is correct and accessible from the administrator account.
3. Ensure that the target account is part of your AWS Organization and is within the scope of Firewall Manager.
4. Check CloudFormation events for specific error messages.
