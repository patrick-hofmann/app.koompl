import { mailStorage } from '../../utils/mailStorage'

export default defineEventHandler(async (event) => {
  const messageId = getRouterParam(event, 'messageId')

  if (!messageId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing message-id parameter'
    })
  }

  console.log(`[Mail API] Looking up email by message-id: ${messageId}`)

  const result = await mailStorage.getEmailByMessageId(messageId)

  if (!result) {
    throw createError({
      statusCode: 404,
      statusMessage: `Email not found for message-id: ${messageId}`
    })
  }

  console.log(`[Mail API] ✓ Found ${result.type} email: ${result.email.id}`)

  return {
    messageId,
    type: result.type,
    email: result.email,
    storagePath: `emails/${result.type}/${result.email.id}.json`
  }
})
