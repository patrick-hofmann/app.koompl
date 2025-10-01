/**
 * GET /api/cron/process-timeouts
 * Cron job to process flow timeouts
 *
 * Run this periodically (e.g., every 5 minutes) via:
 * - Vercel Cron Jobs
 * - External cron service
 * - Scheduled task
 */

import { timeoutManager } from '../../utils/timeoutManager'

export default defineEventHandler(async event => {
  // Optional: Add authentication/secret token to prevent unauthorized access
  const authHeader = getHeader(event, 'authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  console.log('[Cron] Processing timeouts...')

  const result = await timeoutManager.processTimeouts()

  console.log(`[Cron] Completed: ${result.checked} checked, ${result.timedOut} timed out`)

  return {
    ok: true,
    ...result,
    timestamp: new Date().toISOString()
  }
})
