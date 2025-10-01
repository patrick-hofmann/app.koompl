/**
 * Timeout Manager - Handles Flow Timeouts
 *
 * Monitors active flows and handles timeouts gracefully.
 * Should be run periodically (e.g., every 5 minutes via cron).
 */

import { agentFlowEngine } from './agentFlowEngine'

export class TimeoutManager {
  /**
   * Check all active flows for timeouts
   * Run this periodically (e.g., every 5 minutes)
   */
  async processTimeouts(): Promise<{
    checked: number;
    timedOut: number
  }> {
    console.log('[TimeoutManager] Processing timeouts...')

    const startTime = Date.now()

    await agentFlowEngine.processTimeouts()

    const duration = Date.now() - startTime
    console.log(`[TimeoutManager] Completed in ${duration}ms`)

    return {
      checked: 0, // TODO: Track this
      timedOut: 0 // TODO: Track this
    }
  }

  /**
   * Handle a timed-out flow
   */
  async handleTimeout(flowId: string, agentId: string): Promise<void> {
    console.log(`[TimeoutManager] Handling timeout for flow ${flowId}`)

    await agentFlowEngine.failFlow(flowId, 'Flow timed out', agentId)
  }

  /**
   * Extend timeout for a flow (if needed)
   */
  async extendTimeout(flowId: string, agentId: string, additionalMinutes: number): Promise<void> {
    console.log(`[TimeoutManager] Extending timeout for flow ${flowId} by ${additionalMinutes} minutes`)

    const flow = await agentFlowEngine.getFlow(flowId, agentId)

    if (!flow) {
      throw createError({ statusCode: 404, statusMessage: 'Flow not found' })
    }

    const currentTimeout = new Date(flow.timeoutAt).getTime()
    const newTimeout = new Date(currentTimeout + additionalMinutes * 60 * 1000).toISOString()

    flow.timeoutAt = newTimeout
    flow.updatedAt = new Date().toISOString()

    // Save updated flow
    const storage = useStorage('agent-flows')
    await storage.setItem(`${agentId}/flows/${flowId}.json`, flow)

    console.log(`[TimeoutManager] Extended timeout for flow ${flowId} to ${newTimeout}`)
  }
}

// Export singleton instance
export const timeoutManager = new TimeoutManager()
