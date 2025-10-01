export interface McpAgentConfig {
  llmProvider: 'anthropic' | 'openai';
  model?: string;
  maxSteps?: number;
  temperature?: number;
  maxTokens?: number
}

export interface McpAgentResponse {
  success: boolean;
  result?: string;
  error?: string;
  toolCalls?: Array<{
    tool: string;
    input: unknown;
    output?: unknown
  }>
}
