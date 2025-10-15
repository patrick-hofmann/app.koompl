import * as social from '../../../features/social'
import type { SocialMcpContext } from './context'

export async function createPost(
  context: SocialMcpContext,
  args: Parameters<typeof social.createPost>[1]
) {
  return social.createPost(context.teamId, args)
}

export async function listPosts(
  context: SocialMcpContext,
  args: Parameters<typeof social.listPosts>[1]
) {
  return social.listPosts(context.teamId, args.platform)
}

export async function createCampaign(
  context: SocialMcpContext,
  args: Parameters<typeof social.createCampaign>[1]
) {
  return social.createCampaign(context.teamId, args)
}

export async function listCampaigns(context: SocialMcpContext) {
  return social.listCampaigns(context.teamId)
}
