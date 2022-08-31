import { Stack, StackProps, Duration, CfnOutput, Tags } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import {aws_ssm as ssm } from 'aws-cdk-lib' 

//const hostname = "foo.example.com";

interface IStackProps extends StackProps {
  solutionName: string;
  serviceName: string;  
  ALBPort: number; 
  AppPort: number;
  HealthCheckPath: string;
  HealthCheckPort: string;
  HealthCheckHttpCodes: string;
  env: object; 
  testingLocation: string; 
  environment: string; 
}


export class EcsAutoscaleWebappStack extends Stack {

  constructor(scope: Construct, id: string, props: IStackProps) {
    super(scope, id, props);

  // import default vpc in account 
  // const vpc = ec2.Vpc.fromLookup(this, "VPC", {
  //   isDefault: true,
  // });

  // import vpc by id
  // const vpc = ec2.Vpc.fromLookup(this, 'VPC', {
  //     vpcId: props.VpcId
  //   })


  // Create new VPC
  const vpc = new ec2.Vpc(this, `createNewVPC`, { 
    vpcName: `${props.solutionName}-vpc`,
    maxAzs: 2,
    cidr: "172.16.0.0/16",
    natGateways: 2,
    enableDnsHostnames: true,
    enableDnsSupport: true,
    subnetConfiguration: [
      {
        cidrMask: 24,
        name: `${props.solutionName}-ingress-1`,
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,

      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-ingress-2`,
        mapPublicIpOnLaunch: true,
        subnetType: ec2.SubnetType.PUBLIC,
      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-application-1`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-application-2`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_NAT
      }
    ]
  });

  // const cloudMapNamespace = new servicediscovery.PrivateDnsNamespace(this, `ServiceDiscoveryNamespace`, {
  //   name: `${props.solutionName}.local`, // The domain your want to use in the DNS lookup
  //   vpc,
  // });

    //task execution role ― is a general role that grants permissions to start the containers defined in a task. 
   //Those permissions are granted to the ECS agent so it can call AWS APIs on your behalf.
   const generalExecutionRole = new iam.Role(this, `General-Task-ExecutionRole`, {
    roleName: `${props.solutionName}-ECS-Task-ExecutionRole`,
    description: "A general role that grants permissions to start the containers defined in a task.",
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchLogsFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryReadOnly"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy")
    ]
  });


// task role ― grants permissions to the actual application once the containers are started.
  const generalTaskRole = new iam.Role(this, "ecsContainerRole", {
    roleName: `${props.solutionName}-ECS-Container-TaskRole`,
    description: "Grants permissions to the actual application once the containers are started.",
    assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
    managedPolicies: [
      iam.ManagedPolicy.fromAwsManagedPolicyName("CloudWatchFullAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AWSXRayDaemonWriteAccess"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
      iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonEC2ContainerRegistryPowerUser"),
      //iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess")
    ]
  });


    const fargateTaskDefinition = new ecs.FargateTaskDefinition(this, 'FargateTask', {
      taskRole: generalTaskRole,
      executionRole: generalExecutionRole,
    });

    // add container to taskdef 
    fargateTaskDefinition.addContainer('WFEContainer', {
      //image: ecs.ContainerImage.fromAsset('./SampleApp'),
      //image: ecs.ContainerImage.fromRegistry('amazon/amazon-ecs-sample'),
      //image: ecs.ContainerImage.fromAsset('./SourceCode/reactServer'),
      //image: ecs.ContainerImage.fromAsset('./SourceCode/pythonWebApp_Api'),
      image: ecs.ContainerImage.fromRegistry('bkimminich/juice-shop'),
      portMappings: [{ containerPort: props.AppPort}],
      memoryReservationMiB: 256,
      cpu : 256,
      logging: ecs.LogDriver.awsLogs({ streamPrefix: `${props.solutionName}-fargate-service` }),
    });


  //Create ECS Container Security Group 
  const ecsSG = new ec2.SecurityGroup(this, `ECS-Service-SG`, { 
    vpc,
    securityGroupName: `${props.solutionName}-ecs-sg`,  
    description: `${props.solutionName} ecs cluster securitygroup`,
  });

  const cluster = new ecs.Cluster(this, 'create cluster', {
    vpc: vpc,
    clusterName: `${props.solutionName}-ecscluster`,
    containerInsights: true,
    enableFargateCapacityProviders: true,
  });   
  cluster.connections.addSecurityGroup(ecsSG) 

  const albSG = new ec2.SecurityGroup(this, `ALB-SecurityGroup`, { 
    vpc,
    securityGroupName: `${props.solutionName}-albsg`,  
    description: `${props.solutionName}-alb security group`,
  }); 

  //allow traffic on any port from the ALB security group
  ecsSG.connections.allowFrom(
    new ec2.Connections({
      securityGroups: [albSG],
    }),
    ec2.Port.allTraffic(),
    `allow traffic on any port from the ALB security group`,
  )


  const fargateService = new ecs.FargateService(this, 'Service', {
    serviceName: `${props.solutionName}-webapp`,    
    cluster,
    taskDefinition: fargateTaskDefinition,
    desiredCount: 2,
    assignPublicIp: false,
    securityGroups: [albSG]
  });


    // Setup AutoScaling policy
    const fargatescaling = fargateService.autoScaleTaskCount({ maxCapacity: 3, minCapacity: 1 });

    fargatescaling.scaleOnCpuUtilization('fargate_autoscale_cpu', {
      policyName: `${props.solutionName}-asg-cpu-scaling-policy`,
      targetUtilizationPercent: 50,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60)  
    });


    const alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      loadBalancerName: `${props.solutionName}-alb`,
      internetFacing: true,
      securityGroup: albSG, 
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }
    });

    //create ssm params 
    new ssm.StringParameter(this, 'alb arn ssm param', {
      parameterName: `/${props.solutionName}/${props.environment}/ALB/ARN`,
      stringValue: alb.loadBalancerArn,
      description: `param for alb arn`,
      type: ssm.ParameterType.STRING,
      tier: ssm.ParameterTier.INTELLIGENT_TIERING,
      allowedPattern: '.*',
    });


    const alblistener = alb.addListener('Listener', {
      port: props.ALBPort,
      open: false,
    });

    alblistener.addTargets('Target', {
      port: props.AppPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targetGroupName: `${props.solutionName}-tg`,
      targets: [fargateService],
      //healthCheck: { path: '/api/' }
      healthCheck: { 
        path: props.HealthCheckPath,
        healthyHttpCodes: props.HealthCheckHttpCodes,
        port: props.HealthCheckPort,
        protocol: elbv2.Protocol.HTTP,
       }
  
    });

          //allow ingress from test location only 
  //albSG.addIngressRule(ec2.Peer.ipv4(props.testingLocation), ec2.Port.tcp(props.ALBPort), 'allow HTTP traffic from test location only' ); 
    alblistener.connections.allowDefaultPortFromAnyIpv4('Open to the world');


    
  Tags.of(this).add("service", "ECS")

    new CfnOutput(this, 'LoadBalancerDNS', { value: 'http://'+alb.loadBalancerDnsName, });
    new CfnOutput(this, 'VPCIP', { value: vpc.vpcId, exportName: `${props.solutionName}-vpcip` });
    //new CfnOutput(this, 'CloudMapNamespaceArn', { value: cloudMapNamespace.namespaceArn, exportName: `${props.solutionName}-nsarn` });
    //new CfnOutput(this, 'CloudMapNamespaceId', { value: cloudMapNamespace.namespaceId, exportName: `${props.solutionName}-nsId` });
    //new CfnOutput(this, 'CloudMapNamespaceName', { value: cloudMapNamespace.namespaceName, exportName: `${props.solutionName}-nsName` });
    new CfnOutput(this, 'ECS Cluster Name', { value: cluster.clusterName, exportName: `${props.solutionName}-ecsClusterName` });
    new CfnOutput(this, 'ECS Cluster Arn', { value: cluster.clusterArn, exportName: `${props.solutionName}-ecsClusterArn` });
    new CfnOutput(this, 'ECS Security Group Id', { value: ecsSG.securityGroupId, exportName: `${props.solutionName}-ecsSgId` });
  }
}
