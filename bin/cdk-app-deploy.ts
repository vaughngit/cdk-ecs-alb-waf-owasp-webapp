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
const environment = "testing"

const app = new cdk.App();

cdk.Tags.of(app).add("solution", solutionName)
cdk.Tags.of(app).add("environment", "dev")
cdk.Tags.of(app).add("costcenter", "lalith")
cdk.Tags.of(app).add("updatetimestamp", dtstamp)

new EcsAutoscaleWebappStack(app, 'ecs-webapp',
{
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: aws_region
  },
  stackName: "Blocking-XSS-Attacks-APP", 
  serviceName: "ecs",
  solutionName,
  environment,
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
  stackName: "Blocking-XSS-Attacks-WAF", 
  serviceName: "waf",
  solutionName,
  environment
});

