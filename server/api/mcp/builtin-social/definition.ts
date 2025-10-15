import type { BuiltinMcpDefinition } from '../../shared'
import type { SocialMcpContext } from './context'
import { createPost, listPosts, createCampaign, listCampaigns } from './operations'

export const socialDefinition: BuiltinMcpDefinition<SocialMcpContext> = {
  id: 'builtin-social',
  serverName: 'builtin-social-server',
  logPrefix: '[BuiltinSocialMCP]',
  context: {
    spec: {
      teamIdEnv: 'SOCIAL_TEAM_ID',
      userIdEnv: 'SOCIAL_USER_ID',
      agentIdEnv: 'SOCIAL_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.SOCIAL_TEAM_ID as string,
      userId: env.SOCIAL_USER_ID as string,
      agentId: env.SOCIAL_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_post',
      description: 'Create a social media post',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['twitter', 'linkedin', 'facebook', 'instagram'],
            description: 'Social media platform'
          },
          content: { type: 'string', description: 'Post content' },
          scheduledDate: {
            type: 'string',
            format: 'date-time',
            description: 'When to publish the post'
          },
          hashtags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Hashtags for the post'
          },
          imageUrl: { type: 'string', description: 'Optional image URL' }
        },
        required: ['platform', 'content', 'scheduledDate'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const post = await createPost(context, args as any)
        return {
          success: true,
          data: post,
          summary: `Created ${post.platform} post scheduled for ${post.scheduledDate}`
        }
      }
    },
    {
      name: 'list_posts',
      description: 'List social media posts, optionally filtered by platform',
      inputSchema: {
        type: 'object',
        properties: {
          platform: {
            type: 'string',
            enum: ['twitter', 'linkedin', 'facebook', 'instagram'],
            description: 'Optional platform filter'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { platform } = args as { platform?: string }
        const posts = await listPosts(context, { platform })
        return { success: true, data: posts, summary: `Found ${posts.length} posts` }
      }
    },
    {
      name: 'create_campaign',
      description: 'Create a social media campaign',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Campaign name' },
          description: { type: 'string', description: 'Campaign description' },
          platforms: {
            type: 'array',
            items: { type: 'string' },
            description: 'Platforms to post on'
          },
          startDate: { type: 'string', format: 'date-time', description: 'Campaign start date' },
          endDate: { type: 'string', format: 'date-time', description: 'Campaign end date' },
          posts: {
            type: 'array',
            items: { type: 'string' },
            description: 'Post IDs to include in campaign'
          }
        },
        required: ['name', 'description', 'platforms', 'startDate', 'endDate'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const campaign = await createCampaign(context, args as any)
        return { success: true, data: campaign, summary: `Created campaign: ${campaign.name}` }
      }
    },
    {
      name: 'list_campaigns',
      description: 'List all social media campaigns',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const campaigns = await listCampaigns(context)
        return { success: true, data: campaigns, summary: `Found ${campaigns.length} campaigns` }
      }
    }
  ]
}
