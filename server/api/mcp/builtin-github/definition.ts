import type { BuiltinMcpDefinition } from '../../shared'
import type { GithubMcpContext } from './context'
import { listPullRequests, getPullRequestDetails, createIssue } from './operations'

export const githubDefinition: BuiltinMcpDefinition<GithubMcpContext> = {
  id: 'builtin-github',
  serverName: 'builtin-github-server',
  logPrefix: '[BuiltinGithubMCP]',
  context: {
    spec: {
      teamIdEnv: 'GITHUB_TEAM_ID',
      userIdEnv: 'GITHUB_USER_ID',
      agentIdEnv: 'GITHUB_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.GITHUB_TEAM_ID as string,
      userId: env.GITHUB_USER_ID as string,
      agentId: env.GITHUB_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'list_pull_requests',
      description: 'List pull requests for a given repository',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name (e.g., "koompl/app")' },
          state: { type: 'string', enum: ['open', 'closed', 'all'], default: 'open' }
        },
        required: ['repo'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const prs = await listPullRequests(context, args as any)
        return {
          success: true,
          data: prs,
          summary: `Found ${prs.length} pull requests in ${(args as any).repo}`
        }
      }
    },
    {
      name: 'get_pull_request_details',
      description: 'Get details of a specific pull request',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name' },
          prId: { type: 'string', description: 'Pull request ID' }
        },
        required: ['repo', 'prId'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const details = await getPullRequestDetails(context, args as any)
        return {
          success: true,
          data: details,
          summary: `Details for PR ${(args as any).prId} in ${(args as any).repo}`
        }
      }
    },
    {
      name: 'create_issue',
      description: 'Create a new GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository name' },
          title: { type: 'string', description: 'Title of the issue' },
          body: { type: 'string', description: 'Description of the issue' },
          labels: { type: 'array', items: { type: 'string' } }
        },
        required: ['repo', 'title'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const issue = await createIssue(context, args as any)
        return {
          success: true,
          data: issue,
          summary: `Created issue "${(args as any).title}" in ${(args as any).repo}`
        }
      }
    }
  ]
}
