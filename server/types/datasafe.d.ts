export type DatasafeNodeType = 'folder' | 'file'

export interface DatasafeRuleCondition {
  type:
    | 'email-domain'
    | 'mime-type'
    | 'filename-extension'
    | 'filename-prefix'
    | 'subject-keyword'
    | 'path-prefix'
  value: string
}

export interface DatasafeRule {
  id: string
  name: string
  description?: string
  targetFolder: string
  conditions: DatasafeRuleCondition[]
  autoCreateFolder?: boolean
  tags?: string[]
  createdAt: string
  updatedAt: string
}

export interface DatasafeBaseNode {
  id: string
  name: string
  path: string
  type: DatasafeNodeType
  createdAt: string
  updatedAt: string
  tags?: string[]
  ruleMatches?: string[]
}

export interface DatasafeFolderNode extends DatasafeBaseNode {
  type: 'folder'
  children: DatasafeNode[]
}

export interface DatasafeFileNode extends DatasafeBaseNode {
  type: 'file'
  size: number
  mimeType: string
  source: 'ui-upload' | 'email-attachment' | 'mcp' | 'api'
  metadata?: Record<string, unknown>
}

export type DatasafeNode = DatasafeFolderNode | DatasafeFileNode

export interface DatasafeManifest {
  teamId: string
  updatedAt: string
  root: DatasafeFolderNode
}

export interface DatasafeStoredFile {
  id: string
  teamId: string
  path: string
  filename: string
  mimeType: string
  size: number
  encoding: 'base64'
  data: string
  uploadedAt: string
  updatedAt: string
  source: 'ui-upload' | 'email-attachment' | 'mcp' | 'api'
  ruleMatches?: string[]
  metadata?: Record<string, unknown>
}

export interface DatasafeAttachmentContext {
  filename: string
  mimeType: string
  size: number
  data: string
  encoding: 'base64'
  source: 'email-attachment' | 'ui-upload' | 'mcp'
  emailMeta?: {
    messageId?: string
    from?: string
    subject?: string
  }
  tags?: string[]
  ruleHints?: string[]
}

export interface DatasafeRecommendedPlacement {
  folderPath: string
  ruleIds: string[]
  createdFolders?: string[]
}
