import { getIdentity } from '../../utils/identityStorage'
import { requireSuperAdmin } from '../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const identity = await getIdentity()

  // Also include agents for admin area
  const agentsStorage = useStorage('agents')
  const agents = (await agentsStorage.getItem<any[]>('agents.json')) || []

  return {
    ...identity,
    agents
  }
})
