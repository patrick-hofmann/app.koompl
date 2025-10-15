import type { BuiltinMcpDefinition } from '../../shared'
import type { LegalMcpContext } from './context'
import { reviewContract, getComplianceStatus } from './operations'

export const legalDefinition: BuiltinMcpDefinition<LegalMcpContext> = {
  id: 'builtin-legal',
  serverName: 'builtin-legal-server',
  logPrefix: '[BuiltinLegalMCP]',
  context: {
    spec: {
      teamIdEnv: 'LEGAL_TEAM_ID',
      userIdEnv: 'LEGAL_USER_ID',
      agentIdEnv: 'LEGAL_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.LEGAL_TEAM_ID as string,
      userId: env.LEGAL_USER_ID as string,
      agentId: env.LEGAL_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'review_contract',
      description: 'Review a contract for legal compliance and risks',
      inputSchema: {
        type: 'object',
        properties: {
          contractId: { type: 'string', description: 'ID or name of the contract' },
          documentPath: { type: 'string', description: 'Path to the contract document in Datasafe' }
        },
        required: ['contractId', 'documentPath'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const review = await reviewContract(context, args as any)
        return {
          success: true,
          data: review,
          summary: `Contract ${(args as any).contractId} is under review`
        }
      }
    },
    {
      name: 'get_compliance_status',
      description: 'Get compliance status for a specific regulation or policy',
      inputSchema: {
        type: 'object',
        properties: {
          regulation: {
            type: 'string',
            description: 'Name of the regulation or policy (e.g., "GDPR", "HIPAA")'
          }
        },
        required: ['regulation'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const status = await getComplianceStatus(context, args as any)
        return {
          success: true,
          data: status,
          summary: `Compliance status for ${(args as any).regulation} is ${status.status}`
        }
      }
    }
  ]
}
