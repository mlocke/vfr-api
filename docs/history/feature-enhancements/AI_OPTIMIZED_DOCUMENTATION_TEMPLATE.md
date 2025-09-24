# AI-Optimized Documentation Template for VFR Platform

## Purpose and Context

This template provides a standardized structure for creating documentation optimized for AI agent comprehension and human expert use. Follow this template when creating or updating any technical documentation in the VFR platform.

## Template Structure

### 1. Context-First Header
```markdown
# [Component/Service Name] - AI Agent Context Guide

## Purpose and Business Context
**System Function**: [What this component does in business terms]
**Technical Role**: [How it fits in the system architecture]
**Business Impact**: [Why this matters to users/business]
**Dependencies**: [What this component depends on]
**Dependents**: [What depends on this component]

## Mental Model for AI Agents
**Think of this as**: [Simple analogy or metaphor]
**Core Process**: [Input → Processing → Output flow]
**Key Differentiators**: [What makes this unique]
```

### 2. Decision Framework
```markdown
## Decision Framework and Context Matrix

### Primary Use Cases
| Scenario | Context | Decision Path | Expected Outcome |
|----------|---------|---------------|------------------|
| [Scenario 1] | [When to use] | [Steps to follow] | [Success criteria] |
| [Scenario 2] | [When to use] | [Steps to follow] | [Success criteria] |

### Decision Tree
```
Task Type → Context Analysis → Action Path → Verification
    ↓           ↓                ↓            ↓
[Task 1] → [Context 1] → [Action 1] → [Verify 1]
[Task 2] → [Context 2] → [Action 2] → [Verify 2]
```
```

### 3. Implementation Context
```markdown
## Implementation Details with Context

### Architecture Overview
**Design Pattern**: [Pattern used and why]
**Performance Characteristics**: [Response times, throughput, etc.]
**Error Handling**: [How errors are managed]
**Security Considerations**: [Security measures implemented]

### Code Structure
```
[Directory/File Structure with explanations]
├── [file1] # [Purpose and context]
├── [file2] # [Purpose and context]
└── [file3] # [Purpose and context]
```

### Configuration Context
| Setting | Purpose | Default | Production | Impact |
|---------|---------|---------|------------|--------|
| [Setting 1] | [Why needed] | [Dev value] | [Prod value] | [Effect of changes] |
| [Setting 2] | [Why needed] | [Dev value] | [Prod value] | [Effect of changes] |
```

### 4. Operational Procedures
```markdown
## Operational Procedures and Error Boundaries

### Standard Operations
| Operation | When to Use | Command/Process | Success Criteria | Failure Recovery |
|-----------|-------------|-----------------|------------------|------------------|
| [Op 1] | [Trigger condition] | [How to execute] | [How to verify] | [What if it fails] |
| [Op 2] | [Trigger condition] | [How to execute] | [How to verify] | [What if it fails] |

### Error Boundaries and Recovery
| Error Type | Symptoms | Root Cause | Recovery Action | Prevention |
|------------|----------|------------|-----------------|------------|
| [Error 1] | [How to detect] | [Why it happens] | [How to fix] | [How to avoid] |
| [Error 2] | [How to detect] | [Why it happens] | [How to fix] | [How to avoid] |

### Diagnostic Decision Tree
```
Issue Detected → Categorize → Diagnose → Resolve → Verify
     ↓              ↓          ↓         ↓        ↓
[Symptom] → [Category] → [Method] → [Action] → [Check]
```
```

### 5. Integration Context
```markdown
## Integration Patterns and Dependencies

### Service Integration
**Upstream Dependencies**: [What this needs]
**Downstream Consumers**: [What needs this]
**Integration Patterns**: [How it connects]
**Data Flow**: [Information flow description]

### API Context (if applicable)
| Endpoint | Method | Purpose | Input | Output | Error Handling |
|----------|--------|---------|-------|--------|----------------|
| [Endpoint 1] | [Method] | [Function] | [Input schema] | [Output schema] | [Error responses] |

### Performance Context
- **Response Time Targets**: [SLA requirements]
- **Throughput Requirements**: [Capacity needs]
- **Resource Usage**: [CPU, memory, network]
- **Scaling Considerations**: [How it scales]
```

### 6. Testing and Validation
```markdown
## Testing Context and Validation

### Test Strategy
**Testing Philosophy**: [Approach and principles]
**Coverage Requirements**: [What must be tested]
**Test Data Policy**: [Real vs synthetic data rules]

### Test Categories
| Test Type | Purpose | Location | Success Criteria |
|-----------|---------|----------|------------------|
| [Unit Tests] | [Component testing] | [File path] | [Coverage/behavior] |
| [Integration Tests] | [System testing] | [File path] | [End-to-end validation] |
| [Performance Tests] | [Speed/load testing] | [File path] | [Performance targets] |

### Validation Procedures
```bash
# Commands to validate functionality
[command 1]  # [Purpose and expected output]
[command 2]  # [Purpose and expected output]
```
```

### 7. Troubleshooting Matrix
```markdown
## Context-Aware Troubleshooting

### Common Issues Matrix
| Issue | Frequency | Impact | Detection | Resolution | Time to Fix |
|-------|-----------|--------|-----------|------------|-------------|
| [Issue 1] | [How often] | [User impact] | [How to spot] | [How to fix] | [Duration] |
| [Issue 2] | [How often] | [User impact] | [How to spot] | [How to fix] | [Duration] |

### Escalation Path
```
Level 1: Automated Recovery → Level 2: Standard Procedures → Level 3: Expert Intervention
    ↓                           ↓                              ↓
[Auto-fixes]                [Manual procedures]            [Expert knowledge required]
```

### Debug Information
**Logging Locations**: [Where to find logs]
**Key Metrics**: [What to monitor]
**Health Checks**: [How to verify status]
```

## Template Usage Guidelines

### For AI Agents
1. **Always start with context** - Understand the business purpose before implementation
2. **Follow decision trees** - Use the provided frameworks for task routing
3. **Implement error boundaries** - Plan for failure scenarios
4. **Verify with provided criteria** - Use success metrics to validate work

### For Human Experts
1. **Context sections provide system understanding** - Useful for onboarding and knowledge transfer
2. **Decision matrices support troubleshooting** - Quick reference for issue resolution
3. **Integration patterns guide system changes** - Understand impact before modifications
4. **Performance contexts set expectations** - Clear SLAs and targets

### Template Customization
- **Adapt sections based on component type** (service, API, UI component, etc.)
- **Add domain-specific context** where relevant
- **Include visual diagrams** when they aid comprehension
- **Maintain consistency** with established patterns

## Example Implementation

See the optimized CLAUDE.md and TECHNICAL_DOCUMENTATION_INDEX.md files for examples of this template in action.