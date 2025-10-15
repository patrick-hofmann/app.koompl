export type McpEmailContext = {
  subject: string
  text: string
  from?: string | null
  receivedAt: string
  messageId?: string
}
