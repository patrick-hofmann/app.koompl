import { getIdentityData } from '../../features/team'
import { listAgents } from '../../features/agent'
import { requireSuperAdmin } from '../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  const identity = await getIdentityData()
  const agents = await listAgents({})

  return {
    ...identity,
    agents
  }
})
