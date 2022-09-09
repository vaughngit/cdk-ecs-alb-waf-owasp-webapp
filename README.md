# CDK ECS 

# Prereqs:
    nodejs LTS: https://nodejs.org/en/download/ 
    AWS CLI Installed and configured: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_prerequisites 
    CDK v2: https://docs.aws.amazon.com/cdk/v2/guide/getting_started.html#getting_started_install
    Docker: https://www.docker.com/products/docker-desktop/ 
    
## Update the Target Region specified 
    updated region in the env varible in /bin/cdk-app-deploy.ts

## Deploy the Stack
    cdk deploy ecs-webapp 
    cdk deploy waf 

## Copy/Click the ALB Url display in terminal once stack deployment completes 
    confirm successful deployment 
    preform owsap tesing 

# Automate Testing via docker cron
    # every hour: "0 1 * * *"
    # every min: "* * * * *"
    # every 15 mins: */15 * * * *
    # every 5 mins: */5 * * * *

    docker run -d --rm  -e URL=http://wafxssblocker-alb-148388978.us-east-2.elb.amazonaws.com/?allowme  -e CRON_SCHEDULE="* * * * *" lecovi/curl-cron
    docker run -d --rm  -e URL=http://wafxssblocker-alb-148388978.us-east-2.elb.amazonaws.com/?blockme  -e CRON_SCHEDULE="*/15 * * * *" lecovi/curl-cron
    docker ps 
    docker stop {name}


## Destroy the stack: 
    cdk destroy waf
    cdk destroy ecs-webapp 
    


## WAF Solution based off: 
    https://faun.pub/blocking-xss-attacks-with-aws-waf-6336cc86ce72

### Other resources:
    https://github.com/jojje/aws-cdk-samples/blob/master/wafv2/waf2/waf2_stack.py
    https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_wafv2.CfnRuleGroup.RuleProperty.html (BlockQueriesContainingSubString example python)
    https://python.plainenglish.io/creating-a-cloudfront-waf-with-cdk-python-4b67818343ce (CDK code in TypeScript)
    Deploying an AWS AppSync API with WAF using CDK v2: https://instil.co/blog/aws-appsync-waf-cdk-v2