import type { BuiltinMcpDefinition } from '../../shared'
import type { DeploymentMcpContext } from './context'
import { deployApplication, getDeploymentStatus, rollbackDeployment } from './operations'

export const deploymentDefinition: BuiltinMcpDefinition<DeploymentMcpContext> = {
  id: 'builtin-deployment',
  serverName: 'builtin-deployment-server',
  logPrefix: '[BuiltinDeploymentMCP]',
  context: {
    spec: {
      teamIdEnv: 'DEPLOYMENT_TEAM_ID',
      userIdEnv: 'DEPLOYMENT_USER_ID',
      agentIdEnv: 'DEPLOYMENT_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.DEPLOYMENT_TEAM_ID as string,
      userId: env.DEPLOYMENT_USER_ID as string,
      agentId: env.DEPLOYMENT_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'deploy_application',
      description: 'Deploy a specific application version',
      inputSchema: {
        type: 'object',
        properties: {
          application: { type: 'string', description: 'Name of the application to deploy' },
          version: { type: 'string', description: 'Version to deploy (e.g., "1.0.0", "latest")' },
          environment: { type: 'string', enum: ['staging', 'production'], default: 'staging' }
        },
        required: ['application', 'version'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const deployment = await deployApplication(context, args as any)
        return {
          success: true,
          data: deployment,
          summary: `Initiated deployment of ${(args as any).application} v${(args as any).version}`
        }
      }
    },
    {
      name: 'get_deployment_status',
      description: 'Get the status of a specific deployment',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: { type: 'string', description: 'ID of the deployment' }
        },
        required: ['deploymentId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const status = await getDeploymentStatus(context, args as any)
        return {
          success: true,
          data: status,
          summary: `Status for deployment ${(args as any).deploymentId}: ${status.status}`
        }
      }
    },
    {
      name: 'rollback_deployment',
      description: 'Rollback a deployment to a previous version',
      inputSchema: {
        type: 'object',
        properties: {
          deploymentId: { type: 'string', description: 'ID of the deployment to rollback' },
          targetVersion: {
            type: 'string',
            description: 'Optional: specific version to rollback to'
          }
        },
        required: ['deploymentId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const rollback = await rollbackDeployment(context, args as any)
        return {
          success: true,
          data: rollback,
          summary: `Initiated rollback for deployment ${(args as any).deploymentId}`
        }
      }
    }
  ]
}
