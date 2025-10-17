import { defineContentConfig, defineCollection } from '@nuxt/content'
import { z } from 'zod'

export default defineContentConfig({
  collections: {
    agents: defineCollection({
      // data-only collection (no routes/pages generated)
      type: 'data',
      source: 'agents/*.md',
      schema: z.object({
        id: z.string(),
        agentId: z.string(), // This will map to the frontmatter 'id' field
        name: z.string(),
        email: z.string(),
        role: z.string(),
        description: z.string(),
        short_description: z.string(),
        long_description: z.string().optional(),
        system_prompt: z.string(),
        icon: z.string(),
        color: z.string(),
        provider: z.string(),
        model: z.string(),
        temperature: z.number(),
        max_tokens: z.number(),
        max_steps: z.number(),
        mcp_servers: z.array(z.string())
      })
    })
  }
})
