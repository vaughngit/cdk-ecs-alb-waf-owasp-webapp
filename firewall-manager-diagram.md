# Firewall Manager Implementation Diagram

```mermaid
flowchart TB
    User((End User)) --> WAF

    subgraph ParentAccount["AWS Organizations - Parent Account"]
        direction LR
        FMS([AWS Firewall Manager])
        CustomRuleGroup([Custom Rule Group])
        FMSPolicy([Firewall Manager Policy])
        Lambda([Cleanup Lambda Function])
        
        subgraph IPSets[IP Sets]
            AllowedIPs([Allowed IPs])
            BlockedIPs([Blocked IPs])
        end

        FMS --> FMSPolicy
        CustomRuleGroup --> FMSPolicy
        AllowedIPs --> CustomRuleGroup
        BlockedIPs --> CustomRuleGroup
        Lambda -.->|Cleanup| FMSPolicy
    end

    subgraph ChildAccount["AWS Organizations - Child Account"]
        WAF([AWS WAFv2 Web ACL])
        
        subgraph ProtectedResources[Protected Resources]
            ALB([Application Load Balancer])
            
            subgraph ECSCluster[ECS Service]
                style ECSCluster fill:#f5f5f5,stroke:#999,stroke-dasharray: 5 5
                ECS([ECS Service])
                style ECS fill:#f5f5f5,color:#999
            end
            
            ALB --> ECS
        end
        
        CWLogs([CloudWatch Logs])
        WAF --> ALB
        WAF -.->|Logging| CWLogs
    end

    FMSPolicy -->|Applies WAF policy to| ChildAccount
    FMSPolicy -.->|Creates & manages| WAF
    
    style ECSCluster opacity:0.7
    style ECS opacity:0.7
    style WAF fill:#f9d67a,stroke:#f99c1a
    style FMS fill:#f9d67a,stroke:#f99c1a
    style ParentAccount fill:#e6f7ff,stroke:#bde3ff
    style ChildAccount fill:#fff3e0,stroke:#ffe0b2
    style FMSPolicy fill:#e6f7ff
    style CustomRuleGroup fill:#e6f7ff
```

## Key Components:

### Parent Account (Firewall Manager Administrator)
1. **AWS Firewall Manager**: Central service for managing WAF rules across accounts
2. **Custom Rule Group**: Contains custom WAF rules:
   - Allowed IPs Set (whitelist)
   - Blocked IPs Set (blacklist)
   - SQL Injection Protection
3. **Firewall Manager Policy**: Policy that applies WAF protection to resources in specified accounts
4. **Cleanup Lambda Function**: Handles proper resource cleanup during stack deletion

### Child Account (Application Account)
1. **AWS WAFv2 Web ACL**: Created and managed by Firewall Manager
   - Includes both custom rules from parent account
   - Includes AWS managed rule groups:
     - Amazon IP Reputation List
     - Bot Control Rule Set
     - Common Rule Set
2. **Protected Resources**:
   - **Application Load Balancer**: Distributes traffic to backend services
   - **ECS Service**: Container-based application (de-emphasized as not the focus)
3. **CloudWatch Logs**: Captures and stores WAF logs for analysis and auditing

### Benefits of this Architecture
- Centralized security policy management
- Consistent WAF protection across multiple accounts
- Automated deployment of security controls to new resources
- Organization-wide security compliance enforcement
