# Standalone WAF Implementation Diagram
```mermaid
flowchart LR
 subgraph RuleSets["WAF Rule Sets"]
    direction TB
        CommonRule(["AWS Common Rule Set"])
        IPRule(["Amazon IP Reputation List"])
        BotRule(["Bot Control Rule Set"])
        CustomRule(["Custom BlockQuery Rule"])
  end
 subgraph WAFProtection["WAF Protection Layer"]
        WAF(["AWS WAFv2 Web ACL"])
        RuleSets
  end
 subgraph ECSCluster["Services"]
        ECS(["App Service"])
  end
 subgraph Resources["Protected Resources"]
        ALB(["Application Load Balancer"])
        ECSCluster
  end
    User(("App User")) --> WAF
    IPRule --> CommonRule
    CommonRule --> BotRule
    BotRule --> CustomRule
    WAF --> RuleSets
    RuleSets --> ALB
    ALB --> ECS

    style WAF fill:#f9d67a,stroke:#f99c1a
    style RuleSets fill:#fff3d4
    style ECSCluster fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5,opacity:0.7
    style ECS fill:#f5f5f5,color:#999,opacity:0.7
    style WAFProtection fill:#fff9e6
    linkStyle 3 stroke-dasharray: 3 3,fill:none
```

## Key Components:

1. **Traffic Flow**
   - **Step 1**: End user sends web request to the application
   - **Step 2-5**: AWS WAF evaluates the request against each rule set
   - **Step 6**: If allowed by all rules, request passes to the ALB
   - **Step 7**: ALB forwards the request to the appropriate ECS service

2. **WAF Protection Layer**
   - **AWS WAFv2 Web ACL**: Central component that processes and filters web requests
   - **Rule Sets**:
     - **Amazon IP Reputation List**: Blocks requests from known malicious IP addresses
     - **AWS Common Rule Set**: Protects against common vulnerabilities (excl. SizeRestrictions_BODY)
     - **Bot Control Rule Set**: Identifies and manages requests from bots
     - **Custom BlockQuery Rule**: Custom rule that blocks requests containing "blockme" string

3. **Protected Resources**
   - **Application Load Balancer**: Distributes traffic to the backend ECS services
   - **ECS Service**: Container-based application (de-emphasized as not the focus)

4. **Monitoring**
   - **CloudWatch Logs**: Captures and stores WAF logs for analysis and auditing
