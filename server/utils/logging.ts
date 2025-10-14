/**
 * Logging utilities with timestamps
 */

/**
 * Get current timestamp in readable format
 */
export function getTimestamp(): string {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

/**
 * Log with timestamp prefix
 */
export function logWithTimestamp(prefix: string, message: string, data?: any): void {
  const timestamp = getTimestamp()
  if (data !== undefined) {
    console.log(`[${timestamp}] ${prefix} ${message}`, data)
  } else {
    console.log(`[${timestamp}] ${prefix} ${message}`)
  }
}

/**
 * Performance timer for measuring operation duration
 */
export class PerfTimer {
  private startTime: number
  private label: string

  constructor(label: string) {
    this.label = label
    this.startTime = Date.now()
  }

  end(additionalInfo?: any): void {
    const duration = Date.now() - this.startTime
    const timestamp = getTimestamp()
    if (additionalInfo) {
      console.log(`[${timestamp}] ⏱️  ${this.label}: ${duration}ms`, additionalInfo)
    } else {
      console.log(`[${timestamp}] ⏱️  ${this.label}: ${duration}ms`)
    }
  }
}
