# Standalone WAF Implementation Diagram

```mermaid
flowchart LR
    User((End User)) -->|1. Web Request| WAF
    
    subgraph WAFProtection[WAF Protection Layer]
        WAF([AWS WAFv2 Web ACL])
        subgraph RuleSets[WAF Rule Sets]
            IPRule([Amazon IP\nReputation List])
            CommonRule([AWS Common\nRule Set])
            BotRule([Bot Control\nRule Set])
            CustomRule([Custom\nBlockQuery Rule])
        end
        
        WAF -->|2. Evaluate Request| IPRule
        WAF -->|3. Evaluate Request| CommonRule
        WAF -->|4. Evaluate Request| BotRule
        WAF -->|5. Evaluate Request| CustomRule
        
        IPRule -->|Allow/Block| WAF
        CommonRule -->|Allow/Block| WAF
        BotRule -->|Allow/Block| WAF
        CustomRule -->|Allow/Block| WAF
    end
    
    WAF -->|6. Allow Request| ALB
    WAF -.->|Log Events| CWLogs([CloudWatch Logs])
    
    subgraph Resources[Protected Resources]
        ALB([Application\nLoad Balancer])
        subgraph ECSCluster[ECS Service]
            style ECSCluster fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5
            ECS([ECS Service])
            style ECS fill:#f5f5f5,color:#999
        end
        ALB -->|7. Forward Request| ECS
    end
    
    style ECSCluster opacity:0.7
    style ECS opacity:0.7
    style WAF fill:#f9d67a,stroke:#f99c1a
    style WAFProtection fill:#fff9e6
    style RuleSets fill:#fff3d4
    
    classDef flowLabel fill:none,stroke:none,color:#666
    class flowText flowLabel
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
