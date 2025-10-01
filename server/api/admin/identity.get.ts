import { getIdentity } from '../../utils/identityStorage'
import { requireSuperAdmin } from '../../utils/authSession'

export default defineEventHandler(async (event) => {
  await requireSuperAdmin(event)
  return await getIdentity()
})
