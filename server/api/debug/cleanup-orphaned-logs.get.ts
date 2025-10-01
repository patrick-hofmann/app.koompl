import { mailStorage } from '../../utils/mailStorage'

export default defineEventHandler(async (event) => {
  try {
    // Get all logs from unified storage
    const allLogs = await mailStorage.getAllLogs()
    
    // Get existing agents
    const agentsStorage = useStorage('agents')
    const agents = await agentsStorage.getItem<Array<{ id?: string }>>('agents.json') || []
    const existingAgentIds = new Set(agents.map(a => a.id).filter(Boolean))
    
    // Find orphaned logs (no agentId or agentId doesn't exist)
    const orphanedLogs = allLogs.filter(log => 
      !log.agentId || !existingAgentIds.has(log.agentId)
    )
    
    console.log(`[Debug] Found ${orphanedLogs.length} orphaned logs out of ${allLogs.length} total`)
    
    if (orphanedLogs.length === 0) {
      return { 
        message: 'No orphaned logs found',
        totalLogs: allLogs.length,
        orphanedLogs: 0
      }
    }
    
    // Remove orphaned logs from unified log
    const validLogs = allLogs.filter(log => 
      log.agentId && existingAgentIds.has(log.agentId)
    )
    
    // Update the unified log file
    await mailStorage.storage.setItem('logs/unified.json', validLogs)
    
    // Also try to delete individual email files for orphaned logs
    let deletedFiles = 0
    for (const log of orphanedLogs) {
      try {
        if (log.type === 'inbound') {
          await mailStorage.storage.removeItem(`emails/inbound/${log.id}.json`)
        } else if (log.type === 'outgoing') {
          await mailStorage.storage.removeItem(`emails/outbound/${log.id}.json`)
        }
        deletedFiles++
      } catch (error) {
        console.warn(`Failed to delete email file for orphaned log ${log.id}:`, error)
      }
    }
    
    return {
      message: `Cleaned up ${orphanedLogs.length} orphaned logs`,
      totalLogs: allLogs.length,
      orphanedLogs: orphanedLogs.length,
      remainingLogs: validLogs.length,
      deletedFiles,
      orphanedSample: orphanedLogs.slice(0, 5).map(l => ({
        id: l.id,
        type: l.type,
        agentId: l.agentId,
        timestamp: l.timestamp,
        messageId: l.messageId
      }))
    }
  } catch (error) {
    return { error: String(error) }
  }
})
