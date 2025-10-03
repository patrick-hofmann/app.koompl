import { getPredefinedPublic } from '../../server/utils/predefinedKoompls'

export default defineEventHandler(async () => {
  try {
    const data = getPredefinedPublic()
    return { ok: true, data }
  } catch (error) {
    console.error('[API] /api/predefined error:', error)
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
})
