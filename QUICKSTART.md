# Multi-Round Agent System - Quick Start Guide

## Overview

This guide will help you get started with the multi-round agent system quickly. For comprehensive details, see `IMPLEMENTATION_PLAN.md`.

## Quick Setup

### 1. Enable Multi-Round for an Agent

Update your agent configuration to enable multi-round processing:

```typescript
// Example: Update agent via API
await $fetch('/api/agents/agent-a', {
  method: 'PATCH',
  body: {
    multiRoundConfig: {
      enabled: true,
      maxRounds: 10,
      timeoutMinutes: 60,
      canCommunicateWithAgents: true,
      allowedAgentIds: ['agent-b', 'agent-c'],
      autoResumeOnResponse: true
    }
  }
})
```

### 2. Create Test Agents

Use the provided test agent definitions:

```bash
# Load test agents from examples/test-agents.json
node scripts/load-test-agents.js
```

Or manually create agents:
- **Agent A** - Customer Support Coordinator (can communicate with other agents)
- **Agent B** - Product Specialist (responds to Agent A)
- **Agent C** - Technical Support (responds to Agent A)

See `examples/test-agents.json` for full configurations.

### 3. Test the System

Send a test email to Agent A:

```bash
curl -X POST http://localhost:3000/api/mailgun/inbound \
  -H "Content-Type: application/json" \
  -d '{
    "from": "customer@example.com",
    "to": "agent-a@koompl.local",
    "subject": "Question about Enterprise plan",
    "body": "Hi, I am interested in the Enterprise plan. What does it include and how much does it cost?",
    "Message-Id": "test-123@example.com"
  }'
```

### 4. Monitor the Flow

Check flow status:

```bash
# Get all flows for Agent A
curl http://localhost:3000/api/agent-flows?agentId=agent-a

# Get specific flow details
curl http://localhost:3000/api/agent-flows/flow-abc123
```

## Architecture at a Glance

```
Customer Email → Agent A (Coordinator)
                    ↓
              [Analyzes Request]
                    ↓
              Needs pricing info?
                    ↓
              Email → Agent B (Product Specialist)
                    ↓
              Agent B responds
                    ↓
              Agent A receives response
                    ↓
              Agent A sends complete answer → Customer
```

## Key Concepts

### Agent Flow
A flow represents a complete conversation from initial trigger to final response. It consists of multiple rounds where the agent makes decisions and takes actions.

### Round
A single iteration of the decision-making process:
1. Analyze current state
2. Decide next action (continue, wait, complete, fail)
3. Execute action
4. Update flow state

### Decision Types
- **CONTINUE** - Take another action in this round
- **WAIT_FOR_AGENT** - Send message to another agent and wait for response
- **WAIT_FOR_MCP** - Call MCP tool and wait for async result
- **COMPLETE** - Send final response to customer
- **FAIL** - Cannot fulfill request

### Flow Status
- **active** - Currently processing
- **waiting** - Waiting for external input (agent response, webhook, etc.)
- **completed** - Successfully finished
- **failed** - Could not complete
- **timeout** - Exceeded time limit

## Example Scenarios

### Scenario 1: Simple Inquiry

**Customer asks:** "What's the Enterprise plan pricing?"

**Flow:**
1. Agent A analyzes → needs pricing info
2. Agent A emails Agent B (Product Specialist)
3. Agent B responds with pricing details
4. Agent A composes final response with pricing
5. Agent A emails customer

**Result:** Customer gets accurate pricing information
**Rounds:** 2
**Duration:** ~30-60 seconds

### Scenario 2: Complex Multi-Agent Inquiry

**Customer asks:** "I need SSO setup help and Enterprise pricing"

**Flow:**
1. Agent A analyzes → needs both technical and pricing info
2. Agent A emails Agent C (Technical Support) about SSO
3. Agent C responds with SSO setup instructions
4. Agent A emails Agent B (Product Specialist) about pricing
5. Agent B responds with pricing details
6. Agent A composes comprehensive response
7. Agent A emails customer

**Result:** Customer gets both SSO instructions and pricing
**Rounds:** 3
**Duration:** ~60-180 seconds

## Troubleshooting

### Flow not starting?
- Check if agent has `multiRoundConfig.enabled = true`
- Verify agent email matches recipient in test email
- Check logs: `server/logs/agent-flows.log`

### Flow stuck in "waiting" status?
- Check if expected agent has multi-round enabled
- Verify webhook registration is active
- Check timeout hasn't expired
- Manually resume: `POST /api/agent-flows/{flowId}/resume`

### Timeout occurring too soon?
- Increase `timeoutMinutes` in agent config
- Default is 60 minutes
- Can extend mid-flow if needed

### Agent not receiving messages?
- Verify `allowedAgentIds` includes target agent
- Check `canCommunicateWithAgents = true`
- Verify email routing is working

## API Quick Reference

### Start Flow
```typescript
POST /api/agent-flows
{
  agentId: "agent-a",
  trigger: { /* email data */ },
  maxRounds: 10,
  timeoutMinutes: 60
}
```

### Get Flow
```typescript
GET /api/agent-flows/{flowId}
```

### List Flows
```typescript
GET /api/agent-flows?agentId=agent-a&status=active
```

### Resume Flow
```typescript
POST /api/agent-flows/{flowId}/resume
{
  type: "email_response",
  email: { /* email data */ }
}
```

### Complete Flow
```typescript
POST /api/agent-flows/{flowId}/complete
{
  finalResponse: "Thank you for your inquiry..."
}
```

### Fail Flow
```typescript
POST /api/agent-flows/{flowId}/fail
{
  reason: "Unable to reach Agent B within timeout"
}
```

## Next Steps

1. **Read the full implementation plan:** `IMPLEMENTATION_PLAN.md`
2. **Understand the architecture:** See architecture diagrams in plan
3. **Review type definitions:** `server/types/agent-flows.d.ts`
4. **Study example agents:** `examples/test-agents.json`
5. **Start implementing:** Begin with Phase 1 (Foundation)

## Support

For questions or issues:
- Check `IMPLEMENTATION_PLAN.md` for detailed specifications
- Review code comments in `server/utils/agentFlowEngine.skeleton.ts`
- See test scenarios in `examples/test-agents.json`
- Open an issue on GitHub

## License

[Your License Here]


