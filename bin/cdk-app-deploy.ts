#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {EcsAutoscaleWebappStack} from '../lib/aws-cdk-ecs-autoscale-webapp-stack'
import {WAFv2Stack } from '../lib/aws-cdk-wafv2'


let date_ob = new Date();
const dateStamp = date_ob.toDateString()
const timestamp = date_ob.toLocaleTimeString()

const dtstamp = dateStamp+''+' '+timestamp
const aws_region = 'us-west-2'
const application = "two"
const solutionName = `wafxssblocker-${application}`
const environment = "demo"
const costcenter = "waf-demo"


const app = new cdk.App();


// Create the ECS stack first
const ecsStack = new EcsAutoscaleWebappStack(app, 'ecs-webapp',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: `WAF-Protected-app-demo-${application}`, 
  serviceName: `ecs-alb-${application}`,
  cname: "webapp",
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
  stackName: `WAF-with-managed-and-custom-rules-${application}`, 
  serviceName: `demo-${application}`,
  solutionName,
  environment,
  costcenter,
  dtstamp,
  alb: ecsStack.alb, // Pass the ALB from the ECS stack
});

// Add explicit dependency to ensure WAF stack is deployed after ECS stack
wafStack.addDependency(ecsStack);
