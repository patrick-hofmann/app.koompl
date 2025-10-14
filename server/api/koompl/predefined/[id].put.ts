import {
  enablePredefinedKoompl,
  disablePredefinedKoompl
} from '../../../features/koompl/predefined'

export default defineEventHandler(async (event) => {
  const { session } = await getUserSession(event)

  if (!session?.team?.id) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Not authenticated'
    })
  }

  const templateId = getRouterParam(event, 'id')
  if (!templateId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Template ID is required'
    })
  }

  const body = await readBody<{
    enabled: boolean
    name?: string
    email?: string
  }>(event)

  if (body.enabled) {
    // Enable the template
    const agent = await enablePredefinedKoompl(
      {
        teamId: session.team.id,
        userId: session.user?.id
      },
      templateId,
      {
        name: body.name,
        email: body.email
      }
    )

    return {
      ok: true,
      message: 'Predefined koompl enabled',
      agent
    }
  } else {
    // Disable the template
    const success = await disablePredefinedKoompl(
      {
        teamId: session.team.id,
        userId: session.user?.id
      },
      templateId
    )

    return {
      ok: true,
      message: success ? 'Predefined koompl disabled' : 'Koompl was not enabled',
      disabled: success
    }
  }
})
