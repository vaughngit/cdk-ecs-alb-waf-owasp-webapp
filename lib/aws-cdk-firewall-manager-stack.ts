import { Stack, StackProps, Duration, CfnOutput, Tags, RemovalPolicy, CustomResource } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_wafv2 as wafv2 } from 'aws-cdk-lib';
import { aws_fms as fms } from 'aws-cdk-lib';
import { aws_ssm as ssm } from 'aws-cdk-lib';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cr from 'aws-cdk-lib/custom-resources';

interface IFirewallManagerStackProps extends StackProps {
  solutionName: string;
  serviceName: string;
  env: object;
  environment: string;
  costcenter: string;
  dtstamp: string;
  targetAccount: string; // Account ID where the ALB is deployed
}

export class FirewallManagerStack extends Stack {
  constructor(scope: Construct, id: string, props: IFirewallManagerStackProps) {
    super(scope, id, props);

    // Generate a unique timestamp to avoid name conflicts
    const timestamp = new Date().getTime();
    
    // Create an IP set for allowed IP addresses with a unique name
    const allowedIpSet = new wafv2.CfnIPSet(this, 'AllowedIpSet', {
      name: `${props.solutionName}-allowed-ips-${timestamp}`,
      description: 'IP addresses that are allowed to access the application',
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: [
        '73.77.216.37/32', // Example IP - replace with your allowed IPs
      ],
    });
    
    // Add removal policy to ensure it gets deleted
    allowedIpSet.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Create an IP set for blocked IP addresses with a unique name
    const blockedIpSet = new wafv2.CfnIPSet(this, 'BlockedIpSet', {
      name: `${props.solutionName}-blocked-ips-${timestamp}`,
      description: 'IP addresses that are blocked from accessing the application',
      scope: 'REGIONAL',
      ipAddressVersion: 'IPV4',
      addresses: [
        '192.0.2.0/24', // Example IP range - replace with your blocked IPs
      ],
    });
    
    // Add removal policy to ensure it gets deleted
    blockedIpSet.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Create a WAF rule group with custom rules and a unique name
    const customRuleGroup = new wafv2.CfnRuleGroup(this, 'CustomRuleGroup', {
      name: `${props.solutionName}-custom-rule-group-${timestamp}`,
      scope: 'REGIONAL',
      capacity: 100,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${props.solutionName}-custom-rule-group-metrics`,
        sampledRequestsEnabled: true,
      },
      rules: [
        // Rule to allow specific IPs
        {
          name: 'AllowListRule',
          priority: 0,
          action: {
            allow: {},
          },
          statement: {
            ipSetReferenceStatement: {
              arn: allowedIpSet.attrArn,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${props.solutionName}-allow-list-rule-metrics`,
            sampledRequestsEnabled: true,
          },
        },
        // Rule to block specific IPs
        {
          name: 'BlockListRule',
          priority: 1,
          action: {
            block: {},
          },
          statement: {
            ipSetReferenceStatement: {
              arn: blockedIpSet.attrArn,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${props.solutionName}-block-list-rule-metrics`,
            sampledRequestsEnabled: true,
          },
        },
        // Rule to block SQL injection attacks
        {
          name: 'SQLiRule',
          priority: 2,
          action: {
            block: {},
          },
          statement: {
            sqliMatchStatement: {
              fieldToMatch: {
                allQueryArguments: {},
              },
              textTransformations: [
                {
                  priority: 0,
                  type: 'URL_DECODE',
                },
                {
                  priority: 1,
                  type: 'HTML_ENTITY_DECODE',
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${props.solutionName}-sqli-rule-metrics`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // Create a log group for WAF logs with a unique name
    const wafLogGroup = new logs.LogGroup(this, 'WafLogGroup', {
      logGroupName: `aws-waf-logs-${props.solutionName}-${timestamp}`, // WAF logs must begin with aws-waf-logs-
      retention: logs.RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY,
    });
    
    // Add explicit dependency to ensure IP sets are deleted after rule group
    customRuleGroup.addDependsOn(allowedIpSet);
    customRuleGroup.addDependsOn(blockedIpSet);
    
    // Add removal policy to ensure it gets deleted
    customRuleGroup.applyRemovalPolicy(RemovalPolicy.DESTROY);

    // Create a WAF Web ACL that will be managed by Firewall Manager
    // const webAcl = new wafv2.CfnWebACL(this, 'ManagedWebAcl', {
    //   name: `${props.solutionName}-managed-waf`,
    //   description: 'Web ACL managed by Firewall Manager',
    //   scope: 'REGIONAL',
    //   defaultAction: {
    //     allow: {},
    //   },
    //   visibilityConfig: {
    //     cloudWatchMetricsEnabled: true,
    //     metricName: `${props.solutionName}-managed-waf-metrics`,
    //     sampledRequestsEnabled: true,
    //   },
    //   rules: [
    //     // Reference the custom rule group
    //     {
    //       name: 'CustomRuleGroupReference',
    //       priority: 0,
    //       overrideAction: {
    //         none: {},
    //       },
    //       statement: {
    //         ruleGroupReferenceStatement: {
    //           arn: customRuleGroup.attrArn,
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${props.solutionName}-custom-rule-group-reference-metrics`,
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //     // AWS Managed Rule - Amazon IP Reputation List
    //     {
    //       name: 'AWSManagedRulesAmazonIpReputationList',
    //       priority: 1,
    //       overrideAction: {
    //         none: {},
    //       },
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesAmazonIpReputationList',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: `${props.solutionName}-aws-ip-reputation-metrics`,
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //     // Bot Control Rule Set
    //     {
    //       name: 'AWS-AWSManagedRulesBotControlRuleSet',
    //       priority: 2,
    //       overrideAction: {
    //         none: {},
    //       },
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesBotControlRuleSet',
    //           vendorName: 'AWS',
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: 'BotControlRules',
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //     // Common Rule Set
    //     {
    //       name: 'AWS-AWSManagedRulesCommonRuleSet',
    //       priority: 3,
    //       overrideAction: {
    //         none: {},
    //       },
    //       statement: {
    //         managedRuleGroupStatement: {
    //           name: 'AWSManagedRulesCommonRuleSet',
    //           vendorName: 'AWS',
    //           excludedRules: [
    //             { name: 'SizeRestrictions_BODY' },
    //           ],
    //         },
    //       },
    //       visibilityConfig: {
    //         cloudWatchMetricsEnabled: true,
    //         metricName: 'awsCommonRules',
    //         sampledRequestsEnabled: true,
    //       },
    //     },
    //   ],
    // });

    // // Add removal policy to ensure it gets deleted
    // webAcl.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // // Associate WAF with CloudWatch Log Group for logging
    // const loggingConfig = new wafv2.CfnLoggingConfiguration(this, 'WafLoggingConfiguration', {
    //   logDestinationConfigs: [
    //     wafLogGroup.logGroupArn // Use the ARN directly without modification
    //   ],
    //   resourceArn: webAcl.attrArn,
    // });
    
    // // Add removal policy to ensure it gets deleted
    // loggingConfig.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // // Add dependency to ensure logging configuration is deleted before Web ACL
    // loggingConfig.addDependsOn(webAcl);

    // Create an IAM role for Firewall Manager with a unique name
    const firewallManagerRole = new iam.Role(this, 'FirewallManagerRole', {
      roleName: `${props.solutionName}-firewall-manager-role-${timestamp}`,
      description: 'Role used by Firewall Manager to manage WAF resources',
      assumedBy: new iam.ServicePrincipal('fms.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSWAFFullAccess'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AWSFMAdminFullAccess'),
      ],
    });

    // This stack is now configured to deploy to the Firewall Manager administrator account (113613946666)
    // while referencing resources in the ECS account
    
    // Note: In a cross-account scenario, we can't directly access SSM parameters from another account
    // We would need to set up cross-account parameter sharing or use a custom resource
    // For this example, we'll just create a placeholder for the parameter name
    const albParameterName = `/${props.solutionName}/${props.environment}/ALB/ARN`;
    
    // Create a Lambda function to clean up Firewall Manager policy and WAF resources before deletion
    const cleanupFunction = new lambda.Function(this, 'CleanupFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        // In Node.js 18.x, we need to use AWS SDK v3 which is available in the runtime
        const { FMSClient, DeletePolicyCommand, GetPolicyCommand, ListComplianceStatusCommand } = require('@aws-sdk/client-fms');
        const { WAFV2Client, ListWebACLsCommand, GetWebACLCommand, UpdateWebACLCommand, 
                ListResourcesForWebACLCommand, DisassociateWebACLCommand } = require('@aws-sdk/client-wafv2');
        const { STSClient, AssumeRoleCommand } = require('@aws-sdk/client-sts');
        
        exports.handler = async (event, context) => {
          console.log('Event:', JSON.stringify(event, null, 2));
          
          // Only process DELETE events
          if (event.RequestType !== 'Delete') {
            return await sendResponse(event, context, 'SUCCESS', {});
          }
          
          try {
            const region = process.env.AWS_REGION || 'us-west-2';
            const targetAccount = event.ResourceProperties.TargetAccount;
            const policyId = event.ResourceProperties.PolicyId;
            const ruleGroupArn = event.ResourceProperties.RuleGroupArn;
            const webAclArn = event.ResourceProperties.WebAclArn;
            
            console.log(\`Target Account: \${targetAccount}\`);
            console.log(\`Policy ID: \${policyId}\`);
            console.log(\`Rule Group ARN: \${ruleGroupArn}\`);
            console.log(\`Web ACL ARN: \${webAclArn}\`);
            
            // Step 1: Get cross-account credentials for target account
            let targetAccountCredentials = null;
            if (targetAccount) {
              try {
                console.log(\`Attempting to assume role in target account \${targetAccount}\`);
                const stsClient = new STSClient({ region });
                const assumeRoleCommand = new AssumeRoleCommand({
                  RoleArn: \`arn:aws:iam::\${targetAccount}:role/OrganizationAccountAccessRole\`,
                  RoleSessionName: 'FirewallManagerCleanup',
                  DurationSeconds: 900
                });
                
                const assumeRoleResponse = await stsClient.send(assumeRoleCommand);
                targetAccountCredentials = {
                  accessKeyId: assumeRoleResponse.Credentials.AccessKeyId,
                  secretAccessKey: assumeRoleResponse.Credentials.SecretAccessKey,
                  sessionToken: assumeRoleResponse.Credentials.SessionToken
                };
                console.log('Successfully assumed role in target account');
              } catch (error) {
                console.error(\`Error assuming role in target account: \${error.message}\`);
                console.log('Will continue with cleanup in management account only');
              }
            }
            
            // Step 2: Check for and remove any Firewall Manager policy associations in target account
            if (policyId && targetAccountCredentials) {
              try {
                console.log(\`Checking for policy associations in target account for policy \${policyId}\`);
                const fmsClient = new FMSClient({ 
                  region,
                  credentials: targetAccountCredentials
                });
                
                // Get policy details to find associated resources
                const getPolicyCommand = new GetPolicyCommand({ PolicyId: policyId });
                const policyDetails = await fmsClient.send(getPolicyCommand);
                console.log(\`Policy details retrieved: \${JSON.stringify(policyDetails)}\`);
                
                // List compliance status to find resources associated with the policy
                const listComplianceCommand = new ListComplianceStatusCommand({ 
                  PolicyId: policyId,
                  MaxResults: 100
                });
                
                const complianceStatus = await fmsClient.send(listComplianceCommand);
                console.log(\`Compliance status: \${JSON.stringify(complianceStatus)}\`);
                
                // For each resource, we need to disassociate the Web ACL
                if (complianceStatus.PolicyComplianceStatusList) {
                  for (const compliance of complianceStatus.PolicyComplianceStatusList) {
                    console.log(\`Processing resource: \${compliance.MemberAccount} - \${compliance.EvaluationResults}\`);
                    // Here we would need to disassociate the Web ACL from the resource
                    // This depends on the specific resource type and structure
                  }
                }
              } catch (error) {
                console.error(\`Error handling policy associations in target account: \${error.message}\`);
                // Continue with cleanup even if this step fails
              }
            }
            
            // Step 3: Delete Firewall Manager policy in management account
            if (policyId) {
              console.log(\`Deleting Firewall Manager policy: \${policyId}\`);
              const fmsClient = new FMSClient({ region });
              const deleteCommand = new DeletePolicyCommand({ PolicyId: policyId });
              await fmsClient.send(deleteCommand);
              console.log('Policy deleted successfully');
              
              // Wait for policy deletion to complete
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
            // Step 4: Handle WAF resources in management account
            if (webAclArn) {
              console.log(\`Processing Web ACL in management account: \${webAclArn}\`);
              const wafClient = new WAFV2Client({ region });
              
              // Check for and remove any resource associations
              try {
                const resourcesCommand = new ListResourcesForWebACLCommand({
                  WebACLArn: webAclArn,
                  ResourceType: 'APPLICATION_LOAD_BALANCER'
                });
                
                const resourcesResponse = await wafClient.send(resourcesCommand);
                const resources = resourcesResponse.ResourceArns || [];
                
                for (const resourceArn of resources) {
                  console.log(\`Disassociating Web ACL from resource: \${resourceArn}\`);
                  const disassociateCommand = new DisassociateWebACLCommand({
                    ResourceArn: resourceArn
                  });
                  await wafClient.send(disassociateCommand);
                }
                
                if (resources.length > 0) {
                  console.log('Waiting for disassociations to complete...');
                  await new Promise(resolve => setTimeout(resolve, 5000));
                }
              } catch (error) {
                console.log(\`Error checking resource associations: \${error.message}\`);
                // Continue with cleanup even if this step fails
              }
            }
            
            // Step 5: Handle WAF resources in target account
            if (webAclArn && targetAccountCredentials) {
              console.log(\`Processing Web ACL in target account: \${webAclArn}\`);
              const targetWafClient = new WAFV2Client({ 
                region,
                credentials: targetAccountCredentials
              });
              
              // List all Web ACLs in target account
              try {
                const listCommand = new ListWebACLsCommand({ Scope: 'REGIONAL', Limit: 100 });
                const listResponse = await targetWafClient.send(listCommand);
                const webAcls = listResponse.WebACLs || [];
                
                console.log(\`Found \${webAcls.length} Web ACLs in target account\`);
                
                // For each Web ACL, check for resources and disassociate
                for (const acl of webAcls) {
                  console.log(\`Checking Web ACL: \${acl.Name}\`);
                  
                  // Check for resources associated with this Web ACL
                  try {
                    const resourcesCommand = new ListResourcesForWebACLCommand({
                      WebACLArn: acl.ARN,
                      ResourceType: 'APPLICATION_LOAD_BALANCER'
                    });
                    
                    const resourcesResponse = await targetWafClient.send(resourcesCommand);
                    const resources = resourcesResponse.ResourceArns || [];
                    
                    for (const resourceArn of resources) {
                      console.log(\`Disassociating Web ACL from resource in target account: \${resourceArn}\`);
                      const disassociateCommand = new DisassociateWebACLCommand({
                        ResourceArn: resourceArn
                      });
                      await targetWafClient.send(disassociateCommand);
                    }
                    
                    if (resources.length > 0) {
                      console.log('Waiting for target account disassociations to complete...');
                      await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                  } catch (error) {
                    console.log(\`Error checking resource associations in target account: \${error.message}\`);
                    // Continue with cleanup even if this step fails
                  }
                  
                  // Check if this Web ACL references our Rule Group
                  try {
                    const getCommand = new GetWebACLCommand({
                      Name: acl.Name,
                      Scope: 'REGIONAL',
                      Id: acl.Id
                    });
                    
                    const aclDetails = await targetWafClient.send(getCommand);
                    const rules = aclDetails.WebACL.Rules || [];
                    
                    // Check if any rules reference our Rule Group
                    const referencesRuleGroup = rules.some(rule => {
                      if (rule.Statement && rule.Statement.RuleGroupReferenceStatement) {
                        return rule.Statement.RuleGroupReferenceStatement.ARN === ruleGroupArn;
                      }
                      return false;
                    });
                    
                    if (referencesRuleGroup) {
                      console.log(\`Web ACL \${acl.Name} in target account references our Rule Group. Updating...\`);
                      
                      // Filter out rules that reference our Rule Group
                      const updatedRules = rules.filter(rule => {
                        if (rule.Statement && rule.Statement.RuleGroupReferenceStatement) {
                          return rule.Statement.RuleGroupReferenceStatement.ARN !== ruleGroupArn;
                        }
                        return true;
                      });
                      
                      // Update the Web ACL with the filtered rules
                      const updateCommand = new UpdateWebACLCommand({
                        Name: acl.Name,
                        Scope: 'REGIONAL',
                        Id: acl.Id,
                        DefaultAction: aclDetails.WebACL.DefaultAction,
                        Rules: updatedRules,
                        LockToken: aclDetails.LockToken,
                        VisibilityConfig: aclDetails.WebACL.VisibilityConfig
                      });
                      
                      await targetWafClient.send(updateCommand);
                      console.log(\`Updated Web ACL \${acl.Name} in target account to remove Rule Group reference\`);
                    }
                  } catch (error) {
                    console.log(\`Error processing Web ACL \${acl.Name} in target account: \${error.message}\`);
                    // Continue with other Web ACLs even if one fails
                  }
                }
              } catch (error) {
                console.log(\`Error listing Web ACLs in target account: \${error.message}\`);
                // Continue with cleanup even if this step fails
              }
            }
            
            // Step 6: Check for and update any Web ACLs in management account that reference our Rule Group
            if (ruleGroupArn) {
              console.log(\`Checking for Web ACLs in management account using Rule Group: \${ruleGroupArn}\`);
              const wafClient = new WAFV2Client({ region });
              
              try {
                // List all Web ACLs
                const listCommand = new ListWebACLsCommand({ Scope: 'REGIONAL', Limit: 100 });
                const listResponse = await wafClient.send(listCommand);
                const webAcls = listResponse.WebACLs || [];
                
                for (const acl of webAcls) {
                  try {
                    // Get detailed Web ACL configuration
                    const getCommand = new GetWebACLCommand({
                      Name: acl.Name,
                      Scope: 'REGIONAL',
                      Id: acl.Id
                    });
                    
                    const aclDetails = await wafClient.send(getCommand);
                    const rules = aclDetails.WebACL.Rules || [];
                    
                    // Check if any rules reference our Rule Group
                    const referencesRuleGroup = rules.some(rule => {
                      if (rule.Statement && rule.Statement.RuleGroupReferenceStatement) {
                        return rule.Statement.RuleGroupReferenceStatement.ARN === ruleGroupArn;
                      }
                      return false;
                    });
                    
                    if (referencesRuleGroup) {
                      console.log(\`Web ACL \${acl.Name} references our Rule Group. Updating...\`);
                      
                      // Filter out rules that reference our Rule Group
                      const updatedRules = rules.filter(rule => {
                        if (rule.Statement && rule.Statement.RuleGroupReferenceStatement) {
                          return rule.Statement.RuleGroupReferenceStatement.ARN !== ruleGroupArn;
                        }
                        return true;
                      });
                      
                      // Update the Web ACL with the filtered rules
                      const updateCommand = new UpdateWebACLCommand({
                        Name: acl.Name,
                        Scope: 'REGIONAL',
                        Id: acl.Id,
                        DefaultAction: aclDetails.WebACL.DefaultAction,
                        Rules: updatedRules,
                        LockToken: aclDetails.LockToken,
                        VisibilityConfig: aclDetails.WebACL.VisibilityConfig
                      });
                      
                      await wafClient.send(updateCommand);
                      console.log(\`Updated Web ACL \${acl.Name} to remove Rule Group reference\`);
                    }
                  } catch (error) {
                    console.log(\`Error processing Web ACL \${acl.Name}: \${error.message}\`);
                    // Continue with other Web ACLs even if one fails
                  }
                }
              } catch (error) {
                console.log(\`Error listing Web ACLs: \${error.message}\`);
                // Continue with cleanup even if this step fails
              }
            }
            
            // Wait a bit to ensure all operations have completed
            console.log('Waiting for all operations to complete...');
            await new Promise(resolve => setTimeout(resolve, 15000));
            
            return await sendResponse(event, context, 'SUCCESS', {});
          } catch (error) {
            console.error('Error during cleanup:', error);
            // Still return success to allow stack deletion to proceed
            return await sendResponse(event, context, 'SUCCESS', {});
          }
        };
        
        async function sendResponse(event, context, responseStatus, responseData) {
          const responseBody = {
            Status: responseStatus,
            Reason: 'See the details in CloudWatch Log Stream: ' + context.logStreamName,
            PhysicalResourceId: context.logStreamName,
            StackId: event.StackId,
            RequestId: event.RequestId,
            LogicalResourceId: event.LogicalResourceId,
            Data: responseData,
          };
          
          console.log('Response Body:', JSON.stringify(responseBody));
          
          const https = require('https');
          const url = require('url');
          
          return new Promise((resolve, reject) => {
            const parsedUrl = url.parse(event.ResponseURL);
            const options = {
              hostname: parsedUrl.hostname,
              port: 443,
              path: parsedUrl.path,
              method: 'PUT',
              headers: {
                'content-type': '',
                'content-length': Buffer.byteLength(JSON.stringify(responseBody)),
              },
            };
            
            const request = https.request(options, (response) => {
              console.log(\`Status code: \${response.statusCode}\`);
              resolve();
            });
            
            request.on('error', (error) => {
              console.log(\`Send response error: \${error}\`);
              resolve(); // Still resolve to allow stack deletion
            });
            
            request.write(JSON.stringify(responseBody));
            request.end();
          });
        }
      `),
      timeout: Duration.seconds(120), // Increased timeout for more complex operations
      memorySize: 512, // Increased memory for more complex operations
    });
    
    // Grant the Lambda function permissions to manage Firewall Manager policies and WAF resources
    cleanupFunction.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'fms:DeletePolicy',
        'fms:GetPolicy',
        'fms:ListComplianceStatus',
        'wafv2:ListWebACLs',
        'wafv2:GetWebACL',
        'wafv2:UpdateWebACL',
        'wafv2:ListResourcesForWebACL',
        'wafv2:DisassociateWebACL',
        'sts:AssumeRole'
      ],
      resources: ['*'],
    }));
    
    // Create a Firewall Manager security policy for WAF
    const fmsPolicy = new fms.CfnPolicy(this, 'FmsWafPolicy', {
      policyName: `${props.solutionName}-waf-policy`,
      remediationEnabled: true,
      resourceType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      securityServicePolicyData: {
        type: 'WAFV2',
        managedServiceData: JSON.stringify({
          type: 'WAFV2',
          defaultAction: { type: 'ALLOW' },
          // Include both custom rule group and AWS managed rules in preProcessRuleGroups
          preProcessRuleGroups: [
            // Custom Rule Group
            // {
            //   ruleGroupArn: customRuleGroup.attrArn,
            //   overrideAction: { type: 'NONE' },
            //   ruleGroupType: 'RuleGroup'
            // },
            // AWS IP Reputation List
            {
              ruleGroupArn: null,
              overrideAction: { type: 'NONE' },
              ruleGroupType: 'ManagedRuleGroup',
              managedRuleGroupIdentifier: {
                vendorName: 'AWS',
                managedRuleGroupName: 'AWSManagedRulesAmazonIpReputationList',
                version: null
              }
            },
            // Bot Control Rule Set
            {
              ruleGroupArn: null,
              overrideAction: { type: 'NONE' },
              ruleGroupType: 'ManagedRuleGroup',
              managedRuleGroupIdentifier: {
                vendorName: 'AWS',
                managedRuleGroupName: 'AWSManagedRulesBotControlRuleSet',
                version: null
              }
            },
            // Common Rule Set
            {
              ruleGroupArn: null,
              overrideAction: { type: 'NONE' },
              ruleGroupType: 'ManagedRuleGroup',
              managedRuleGroupIdentifier: {
                vendorName: 'AWS',
                managedRuleGroupName: 'AWSManagedRulesCommonRuleSet',
                version: null
              },
              excludedRules: [
                { name: 'SizeRestrictions_BODY' }
              ]
            }
          ],
          postProcessRuleGroups: [],
          overrideCustomerWebACLAssociation: false,
          // loggingConfiguration: {
          //   logDestinationConfigs: [
          //     // Format: arn:aws:logs:region:account-id:log-group:log-group-name
          //     `arn:aws:logs:${this.region}:${this.account}:log-group:${wafLogGroup.logGroupName}`
          //   ]
          // }
        }),
      },
      includeMap: {
        // Target the ECS account
        account: [props.targetAccount],
      },
      excludeResourceTags: false,
    });
    
    // Add removal policy to ensure it gets deleted
    fmsPolicy.applyRemovalPolicy(RemovalPolicy.DESTROY);
    
    // // Create a custom resource to clean up the Firewall Manager policy before stack deletion
    const cleanupProvider = new cr.Provider(this, 'CleanupProvider', {
      onEventHandler: cleanupFunction,
    });
    
    const cleanupResource = new CustomResource(this, 'CleanupResource', {
      serviceToken: cleanupProvider.serviceToken,
      properties: {
        PolicyId: fmsPolicy.attrId,
        RuleGroupArn: customRuleGroup.attrArn,
       // WebAclArn: webAcl.attrArn,
        TargetAccount: props.targetAccount,
        // Add a timestamp to force the custom resource to be updated on each deployment
        Timestamp: new Date().toISOString(),
      },
    });
    
    // // Add dependency to ensure the cleanup resource is processed before the policy is deleted
      cleanupResource.node.addDependency(fmsPolicy);

   
    // Output the ALB parameter name for reference
    new CfnOutput(this, 'AlbArnParameterName', {
      value: albParameterName,
      description: 'SSM Parameter name for the ALB ARN in the target account',
    });
    
    new CfnOutput(this, 'CrossAccountSetupNote', {
      value: `To access this parameter from account ${props.targetAccount}, you need to set up cross-account parameter sharing`,
      description: 'Cross-account setup information',
    });

    // Add tags to resources - ensure values meet AWS tag constraints
    Tags.of(this).add('service', props.serviceName);
    Tags.of(this).add('solution', props.solutionName);
    Tags.of(this).add('environment', props.environment);
    Tags.of(this).add('costcenter', props.costcenter);
    // Format timestamp to ensure it meets AWS tag value requirements
    const formattedTimestamp = props.dtstamp.replace(/[^a-zA-Z0-9+\-=._:/@]/g, '-');
    Tags.of(this).add('updatetimestamp', formattedTimestamp);

    // Output the ARNs of created resources
    new CfnOutput(this, 'CustomRuleGroupArn', {
      value: customRuleGroup.attrArn,
      description: 'ARN of the custom WAF rule group',
    });

    // new CfnOutput(this, 'WebAclArn', {
    //   value: webAcl.attrArn,
    //   description: 'ARN of the WAF Web ACL',
    // });


      // Output the ALB ARN for reference
      // new CfnOutput(this, 'AlbArn', {
      //   value: props.alb.loadBalancerArn,
      //   description: 'ARN of the Application Load Balancer'
      // });
  


    // Output Firewall Manager policy information
    new CfnOutput(this, 'FirewallManagerPolicyId', {
      value: fmsPolicy.attrId,
      description: 'ID of the Firewall Manager policy',
    });

    new CfnOutput(this, 'FirewallManagerConsoleUrl', {
      value: `https://console.aws.amazon.com/wafv2/fms#/security-policies/list?region=${this.region}`,
      description: 'URL to access the Firewall Manager console',
    });
    
    new CfnOutput(this, 'DeploymentNote', {
      value: 'This stack is deployed to the Firewall Manager administrator account (113613946666)',
      description: 'Deployment information',
    });
  }
}
