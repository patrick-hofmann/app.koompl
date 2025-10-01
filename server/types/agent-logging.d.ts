export interface McpUsageLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentEmail: string;
  type: 'mcp_usage';
  serverId: string;
  serverName: string;
  provider: string;
  category: string;
  input: {
    query: string;
    context?: Record<string, unknown>;
    parameters?: Record<string, unknown>
  };
  output: {
    result: unknown;
    success: boolean;
    error?: string
  };
  metadata: {
    responseTime?: number;
    contextCount?: number
  }
}

export interface AiUsageLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentEmail: string;
  type: 'ai_usage';
  provider: 'openai';
  model: string;
  input: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number
  };
  output: {
    result: string;
    success: boolean;
    error?: string;
    tokens?: {
      prompt?: number;
      completion?: number;
      total?: number
    }
  };
  metadata: {
    responseTime?: number;
    promptLength?: number;
    responseLength?: number
  }
}

export interface EmailActivityLog {
  id: string;
  timestamp: string;
  agentId: string;
  agentEmail: string;
  type: 'email_activity';
  direction: 'inbound' | 'outbound';
  email: {
    messageId: string;
    from: string;
    to: string;
    subject: string;
    body: string
  };
  metadata: {
    mailgunSent?: boolean;
    isAutomatic?: boolean;
    mcpContextCount?: number
  }
}

export type AgentLogEntry = McpUsageLog | AiUsageLog | EmailActivityLog
