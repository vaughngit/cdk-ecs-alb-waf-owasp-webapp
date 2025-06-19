import { Stack, StackProps, Duration, CfnOutput, Tags,  } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as servicediscovery from 'aws-cdk-lib/aws-servicediscovery';
import {aws_ssm as ssm } from 'aws-cdk-lib' 
import {aws_certificatemanager as acm }from 'aws-cdk-lib';
import { aws_route53 as route53 }from 'aws-cdk-lib';

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
  application: string; 
  //testingLocation: string; 
  environment: string; 
  costcenter: string; 
  cname: string; 
  domainName: string 
  dtstamp: string; 
}


export class EcsAutoscaleWebappStack extends Stack {
  // Private field to store the ALB
  private _alb: elbv2.ApplicationLoadBalancer;

  // Getter to access the ALB from outside the class
  public get alb(): elbv2.ApplicationLoadBalancer {
    return this._alb;
  }

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
  const vpc = new ec2.Vpc(this, `OWASP`, { 
    vpcName: `${props.solutionName}-vpc`,
    maxAzs: 2,
    // Using ipAddresses instead of deprecated cidr
    ipAddresses: ec2.IpAddresses.cidr("172.16.0.0/16"),
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
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
      },
      {
        cidrMask: 24,
        name: `${props.solutionName}-application-2`,
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS
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
    // Using the non-deprecated approach for container insights
    // Note: containerInsights is deprecated but still supported
    containerInsights: true,
    enableFargateCapacityProviders: true,
  });   
  cluster.connections.addSecurityGroup(ecsSG) 

  const albSG = new ec2.SecurityGroup(this, `ALB-SecurityGroup`, { 
    vpc,
    securityGroupName: `${props.solutionName}-albsg`,  
    description: `${props.solutionName}-alb security group`,
  }); 
  
  // Allow inbound traffic only from specific IP address
  albSG.addIngressRule(
    ec2.Peer.ipv4('73.77.216.37/32'),
    ec2.Port.tcp(80),
    'Allow HTTP traffic from specific IP only'
  );
  
  albSG.addIngressRule(
    ec2.Peer.ipv4('73.77.216.37/32'),
    ec2.Port.tcp(443),
    'Allow HTTPS traffic from specific IP only'
  );

  //allow traffic only from specific IP address
  ecsSG.addIngressRule(
    ec2.Peer.ipv4('73.77.216.37/32'),
    ec2.Port.allTraffic(),
    'allow traffic on any port from specific IP address'
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


    this._alb = new elbv2.ApplicationLoadBalancer(this, 'ALB', {
      vpc,
      loadBalancerName: `${props.solutionName}-alb`,
      internetFacing: true,
      securityGroup: albSG, 
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC, onePerAz: true }
    });

    //create ssm params 
    new ssm.StringParameter(this, 'alb arn ssm param', {
      parameterName: `/${props.solutionName}/${props.environment}/ALB/ARN`,
      stringValue: this._alb.loadBalancerArn,
      description: `param for alb arn`,
      tier: ssm.ParameterTier.INTELLIGENT_TIERING,
      allowedPattern: '.*',
    });

    const albTargetGroup = new elbv2.ApplicationTargetGroup(this, "targetgroup",{
      vpc: vpc,
      targetGroupName: `${props.solutionName}-${props.application}-tg`,
      targets: [fargateService],
      port: props.AppPort,
      protocol: elbv2.ApplicationProtocol.HTTP,
      healthCheck: { 
        path: props.HealthCheckPath,
        healthyHttpCodes: props.HealthCheckHttpCodes,
        port: props.HealthCheckPort,
        protocol: elbv2.Protocol.HTTP,
       }
    })
    


    const alblistener = this._alb.addListener('Listener', {
      port: props.ALBPort,
      defaultTargetGroups: [albTargetGroup],
      open: false, // Restrict access - don't open to everyone
    });


    // Make DNS configuration optional
    try {
      // Try to look up the hosted zone
      const zone = route53.HostedZone.fromLookup(this, 'PrivateHostedZone', {
        domainName: props.domainName
      });

      // If zone lookup succeeds, create CNAME record
      const cnameRecord = new route53.CnameRecord(this, 'MyCnameRecord', {
        domainName: this._alb.loadBalancerDnsName,
        zone: zone,
        comment: 'cname for appmesh alb endpoint',
        recordName: props.cname,
        ttl: Duration.minutes(30),
      });

      // Create SSL certificate
      const acmcert = new acm.Certificate(this, 'AcmCertificate', {
        domainName: `${props.cname}.${props.domainName}`,
        validation: acm.CertificateValidation.fromDns(zone),
      });

      // Create HTTPS listener
      const port443AlbListener = new elbv2.ApplicationListener(this, 'secure alb listener', {
        loadBalancer: this._alb,
        defaultTargetGroups: [albTargetGroup],
        port: 443,
        sslPolicy: elbv2.SslPolicy.RECOMMENDED,
        certificates: [elbv2.ListenerCertificate.fromCertificateManager(acmcert)],
        open: false // Restrict access - don't open to everyone
      });

      // Output the Route53 CNAME
      new CfnOutput(this, 'Route53CName', { value: 'https://'+cnameRecord.domainName });
    } catch (error: any) {
      console.log(`DNS configuration skipped: ${error.message || 'Unknown error'}`);
      // Output a message indicating DNS configuration was skipped
      new CfnOutput(this, 'DNSConfigurationStatus', { 
        value: 'DNS configuration skipped - Hosted zone not found for domain: ' + props.domainName 
      });
    }


    

  Tags.of(this).add("service", props.serviceName)
  Tags.of(this).add("solution", props.solutionName)
  Tags.of(this).add("environment", props.environment)
  Tags.of(this).add("costcenter", props.costcenter)
  Tags.of(this).add("updatetimestamp", props.dtstamp)

    new CfnOutput(this, 'LoadBalancerDNS', { value: `http://${this._alb.loadBalancerDnsName}`, });
    new CfnOutput(this, 'VPCIP', { value: vpc.vpcId, exportName: `${props.solutionName}-vpcip` });
    // Route53CName output is now conditionally created in the try/catch block above
    new CfnOutput(this, 'ECS Cluster Name', { value: cluster.clusterName, exportName: `${props.solutionName}-ecsClusterName` });
    new CfnOutput(this, 'ECS Cluster Arn', { value: cluster.clusterArn, exportName: `${props.solutionName}-ecsClusterArn` });
    new CfnOutput(this, 'ECS Security Group Id', { value: ecsSG.securityGroupId, exportName: `${props.solutionName}-ecsSgId` });
  }
}
