#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import {EcsAutoscaleWebappStack} from '../lib/aws-cdk-ecs-autoscale-webapp-stack'
import {WAFv2Stack } from '../lib/aws-cdk-wafv2'


let date_ob = new Date();
const dateStamp = date_ob.toDateString()
const timestamp = date_ob.toLocaleTimeString()

const dtstamp = dateStamp+''+' '+timestamp
const aws_region = 'us-east-2'
const solutionName = "wafxssblocker"
const environment = "demo"
const costcenter = "0014z00001gWOCPAA4"

const app = new cdk.App();


new EcsAutoscaleWebappStack(app, 'ecs-webapp',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: "WAF-Protected-APP", 
  serviceName: "ecs-alb",
  solutionName,
  environment,
  costcenter,
  dtstamp,
  ALBPort: 80,
  AppPort: 3000,
  HealthCheckPort: "3000",
  HealthCheckPath: "/",
  HealthCheckHttpCodes: "200",
  testingLocation: "104.111.111.40/32" 
});

new WAFv2Stack(app, 'waf',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: "WAF-with-managed-and-custom-rules", 
  serviceName: "demo",
  solutionName,
  environment,
  costcenter,
  dtstamp,
});

