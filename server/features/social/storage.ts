import { createStorage } from '../../utils/storage'

export interface SocialPost {
  id: string
  platform: 'twitter' | 'linkedin' | 'facebook' | 'instagram'
  content: string
  scheduledDate: string
  status: 'scheduled' | 'published' | 'failed'
  hashtags: string[]
  imageUrl?: string
  publishedAt?: string
  engagement?: {
    likes: number
    shares: number
    comments: number
  }
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface SocialCampaign {
  id: string
  name: string
  description: string
  platforms: string[]
  startDate: string
  endDate: string
  status: 'draft' | 'active' | 'completed'
  posts: string[]
  metrics: {
    reach: number
    engagement: number
    clicks: number
  }
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface SocialData {
  posts: SocialPost[]
  campaigns: SocialCampaign[]
}

const defaultSocialData: SocialData = {
  posts: [],
  campaigns: []
}

export function createSocialStorage(teamId: string) {
  return createStorage<SocialData>('social', teamId, defaultSocialData)
}

export async function createPost(
  teamId: string,
  postData: Omit<SocialPost, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<SocialPost> {
  const storage = createSocialStorage(teamId)
  const data = await storage.read()

  const post: SocialPost = {
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...postData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.posts.push(post)
  await storage.write(data)

  return post
}

export async function listPosts(teamId: string, platform?: string): Promise<SocialPost[]> {
  const storage = createSocialStorage(teamId)
  const data = await storage.read()

  if (platform) {
    return data.posts.filter((p) => p.platform === platform)
  }

  return data.posts
}

export async function createCampaign(
  teamId: string,
  campaignData: Omit<SocialCampaign, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<SocialCampaign> {
  const storage = createSocialStorage(teamId)
  const data = await storage.read()

  const campaign: SocialCampaign = {
    id: `campaign_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...campaignData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.campaigns.push(campaign)
  await storage.write(data)

  return campaign
}

export async function listCampaigns(teamId: string): Promise<SocialCampaign[]> {
  const storage = createSocialStorage(teamId)
  const data = await storage.read()
  return data.campaigns
}
