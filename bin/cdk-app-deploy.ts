#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {EcsAutoscaleWebappStack} from '../lib/aws-cdk-ecs-autoscale-webapp-stack'
import {WAFv2Stack } from '../lib/aws-cdk-wafv2'
import {FirewallManagerStack} from '../lib/aws-cdk-firewall-manager-stack'


let date_ob = new Date();
const dateStamp = date_ob.toDateString()
const timestamp = date_ob.toLocaleTimeString()

const dtstamp = dateStamp+''+' '+timestamp
const aws_region = 'us-west-2'
const application = "cr3"
const solutionName = `waf-demo-${application}`
const environment = "demo"
const costcenter = "waf-demo"

// //User account details from AWS CLI credentials: 
// const account = process.env.CDK_DEFAULT_ACCOUNT;
// const region = process.env.CDK_DEFAULT_REGION
// const env = {account, region}; 

const app = new cdk.App();


// Create the ECS stack first
const ecsStack = new EcsAutoscaleWebappStack(app, 'ecs',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: `${application}-owasp-app`, 
  serviceName: `ecs-alb-${application}`,
  cname: "owasp",
  domainName: "dev.technetcentral.com",
  solutionName,
  environment,
  costcenter,
  dtstamp,
  application,
  ALBPort: 80,
  AppPort: 3000,
  HealthCheckPort: "3000",
  HealthCheckPath: "/",
  HealthCheckHttpCodes: "200",
  //testingLocation: "104.111.111.40/32" 
});

// Create the WAF stack with an explicit dependency on the ECS stack
const wafStack = new WAFv2Stack(app, 'waf',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: `${application}-waf`, 
  serviceName: `demo-${application}`,
  solutionName,
  environment,
  costcenter,
  dtstamp,
  alb: ecsStack.alb, // Pass the ALB from the ECS stack
});

// Add explicit dependency to ensure WAF stack is deployed after ECS stack
//wafStack.addDependency(ecsStack);

// Create the Firewall Manager stack in the administrator account
const fmsStack = new FirewallManagerStack(app, 'fm',
{
  env: { 
    account: '113613946666', // Firewall Manager administrator account
    region: aws_region
  },
  stackName: `firewall-manager-${application}`, 
  serviceName: `fms-${application}`,
  solutionName,
  environment,
  costcenter,
  dtstamp,
  targetAccount: '796072252262', // Pass the target account ID
});

// In a multi-account setup, we don't need a dependency between stacks in different accounts
// fmsStack.addDependency(wafStack);
