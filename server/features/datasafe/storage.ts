import { nanoid } from 'nanoid'
import { createError } from 'h3'
import type {
  DatasafeAttachmentContext,
  DatasafeFileNode,
  DatasafeFolderNode,
  DatasafeManifest,
  DatasafeNode,
  DatasafeRecommendedPlacement,
  DatasafeRule,
  DatasafeRuleCondition,
  DatasafeStoredFile
} from '../../types/datasafe'
import { extractEmail } from '../../utils/mailgunHelpers'

const storage = useStorage('datasafe')

function nowIso(): string {
  return new Date().toISOString()
}

function manifestKey(teamId: string): string {
  return `teams/${teamId}/manifest.json`
}

function rulesKey(teamId: string): string {
  return `teams/${teamId}/rules.json`
}

function fileKey(teamId: string, normalizedPath: string): string {
  return `teams/${teamId}/files/${normalizedPath}.json`
}

function sanitizeFilename(raw: string): string {
  const name = String(raw || '')
    .replace(/[\\/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name) {
    return `file-${nanoid(6)}`
  }
  return name
}

function normalizePath(input: string | undefined | null): string {
  if (!input) return ''
  const segments = String(input)
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
  return segments.join('/')
}

function splitPath(path: string): { folderPath: string; filename: string } {
  const normalized = normalizePath(path)
  const segments = normalized.split('/').filter(Boolean)
  if (!segments.length) {
    return { folderPath: '', filename: sanitizeFilename(path) }
  }
  const filename = sanitizeFilename(segments.pop() || path)
  return { folderPath: segments.join('/'), filename }
}

function cloneNode<T>(node: T): T {
  return JSON.parse(JSON.stringify(node))
}

async function loadManifest(teamId: string): Promise<DatasafeManifest> {
  let manifest = await storage.getItem<DatasafeManifest>(manifestKey(teamId))
  if (manifest) {
    return manifest
  }
  const now = nowIso()
  const root: DatasafeFolderNode = {
    id: `root-${teamId}`,
    name: 'Root',
    path: '',
    type: 'folder',
    createdAt: now,
    updatedAt: now,
    children: []
  }
  manifest = {
    teamId,
    updatedAt: now,
    root
  }
  await storage.setItem(manifestKey(teamId), manifest)
  return manifest
}

async function saveManifest(teamId: string, manifest: DatasafeManifest): Promise<void> {
  manifest.updatedAt = nowIso()
  await storage.setItem(manifestKey(teamId), manifest)
}

function sortChildren(folder: DatasafeFolderNode): void {
  folder.children.sort((a, b) => {
    if (a.type === b.type) {
      return a.name.localeCompare(b.name)
    }
    return a.type === 'folder' ? -1 : 1
  })
}

function findFolderBySegments(
  root: DatasafeFolderNode,
  segments: string[]
): DatasafeFolderNode | null {
  if (!segments.length) return root
  let current: DatasafeFolderNode | null = root
  for (const segment of segments) {
    if (!current) return null
    const next = current.children.find((child) => child.type === 'folder' && child.name === segment)
    if (!next || next.type !== 'folder') {
      return null
    }
    current = next
  }
  return current
}

function ensureFolderBySegments(
  root: DatasafeFolderNode,
  segments: string[]
): {
  folder: DatasafeFolderNode
  created: string[]
} {
  const created: string[] = []
  let current = root
  for (const segment of segments) {
    let next = current.children.find((child) => child.type === 'folder' && child.name === segment)
    if (!next) {
      const now = nowIso()
      next = {
        id: `folder-${nanoid(8)}`,
        name: segment,
        path: normalizePath([current.path, segment].filter(Boolean).join('/')),
        type: 'folder',
        createdAt: now,
        updatedAt: now,
        children: []
      }
      current.children.push(next)
      sortChildren(current)
      created.push(next.path)
    }
    if (next.type !== 'folder') {
      throw createError({
        statusCode: 400,
        statusMessage: `Path segment ${segment} is not a folder`
      })
    }
    current = next
  }
  return { folder: current, created }
}

function findNodeByPath(root: DatasafeFolderNode, path: string): DatasafeNode | null {
  const normalized = normalizePath(path)
  if (!normalized) return root
  const segments = normalized.split('/')
  const filename = segments.pop()
  const folder = findFolderBySegments(root, segments)
  if (!folder) return null
  if (!filename) return folder
  return folder.children.find((child) => child.name === filename) || null
}

function ensureUniqueFilename(folder: DatasafeFolderNode, desiredName: string): string {
  if (!folder.children.find((child) => child.name === desiredName)) {
    return desiredName
  }
  const dotIndex = desiredName.lastIndexOf('.')
  const base = dotIndex === -1 ? desiredName : desiredName.slice(0, dotIndex)
  const extension = dotIndex === -1 ? '' : desiredName.slice(dotIndex)
  let counter = 1
  while (counter < 1000) {
    const candidate = `${base}-${counter}${extension}`
    if (!folder.children.find((child) => child.name === candidate)) {
      return candidate
    }
    counter += 1
  }
  return `${base}-${nanoid(4)}${extension}`
}

export async function getTree(teamId: string): Promise<DatasafeFolderNode> {
  const manifest = await loadManifest(teamId)
  return cloneNode(manifest.root)
}

export async function listFolder(teamId: string, path?: string): Promise<DatasafeFolderNode> {
  const manifest = await loadManifest(teamId)
  const normalized = normalizePath(path)
  const segments = normalized ? normalized.split('/') : []
  const folder = findFolderBySegments(manifest.root, segments)
  if (!folder) {
    throw createError({ statusCode: 404, statusMessage: `Folder not found: ${path || '/'}` })
  }
  return cloneNode(folder)
}

export async function createFolder(
  teamId: string,
  folderPath: string
): Promise<DatasafeFolderNode> {
  const manifest = await loadManifest(teamId)
  const normalized = normalizePath(folderPath)
  const segments = normalized ? normalized.split('/') : []
  const { folder } = ensureFolderBySegments(manifest.root, segments)
  await saveManifest(teamId, manifest)
  return cloneNode(folder)
}

export async function removeNode(teamId: string, path: string): Promise<void> {
  const manifest = await loadManifest(teamId)
  const normalized = normalizePath(path)
  if (!normalized) {
    throw createError({ statusCode: 400, statusMessage: 'Cannot remove root folder' })
  }
  const segments = normalized.split('/')
  const name = segments.pop()
  const parent = findFolderBySegments(manifest.root, segments)
  if (!parent || !name) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  const index = parent.children.findIndex((child) => child.name === name)
  if (index === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Node not found' })
  }
  const [removed] = parent.children.splice(index, 1)
  if (removed.type === 'file') {
    await storage.removeItem(fileKey(teamId, normalized))
  }
  await saveManifest(teamId, manifest)
}

export async function storeFile(
  teamId: string,
  filePath: string,
  payload: {
    base64: string
    mimeType: string
    size: number
    source: 'ui-upload' | 'email-attachment' | 'mcp' | 'api'
    metadata?: Record<string, unknown>
    ruleMatches?: string[]
    overwrite?: boolean
  }
): Promise<DatasafeFileNode> {
  const manifest = await loadManifest(teamId)
  const { folderPath, filename: desiredName } = splitPath(filePath)
  const segments = folderPath ? folderPath.split('/') : []
  const { folder } = ensureFolderBySegments(manifest.root, segments)

  let filename = sanitizeFilename(desiredName)
  const existingNode = folder.children.find((child) => child.name === filename)
  if (existingNode && existingNode.type === 'file') {
    if (!payload.overwrite) {
      filename = ensureUniqueFilename(folder, filename)
    }
  }

  const normalizedPath = normalizePath([folder.path, filename].filter(Boolean).join('/'))
  const now = nowIso()

  let fileNode = folder.children.find(
    (child) => child.name === filename && child.type === 'file'
  ) as DatasafeFileNode | undefined

  if (!fileNode) {
    fileNode = {
      id: `file-${nanoid(10)}`,
      name: filename,
      path: normalizedPath,
      type: 'file',
      size: payload.size,
      mimeType: payload.mimeType,
      source: payload.source,
      createdAt: now,
      updatedAt: now,
      tags: undefined,
      ruleMatches: payload.ruleMatches,
      metadata: payload.metadata
    }
    folder.children.push(fileNode)
  } else {
    fileNode.size = payload.size
    fileNode.mimeType = payload.mimeType
    fileNode.source = payload.source
    fileNode.updatedAt = now
    fileNode.ruleMatches = payload.ruleMatches
    fileNode.metadata = payload.metadata
  }

  sortChildren(folder)
  await saveManifest(teamId, manifest)

  const stored: DatasafeStoredFile = {
    id: fileNode.id,
    teamId,
    path: normalizedPath,
    filename: filename,
    mimeType: payload.mimeType,
    size: payload.size,
    encoding: 'base64',
    data: payload.base64,
    uploadedAt: fileNode.createdAt,
    updatedAt: now,
    source: payload.source,
    ruleMatches: payload.ruleMatches,
    metadata: payload.metadata
  }

  await storage.setItem(fileKey(teamId, normalizedPath), stored)

  return cloneNode(fileNode)
}

export async function readFile(
  teamId: string,
  path: string
): Promise<{ file: DatasafeStoredFile; node: DatasafeFileNode } | null> {
  const manifest = await loadManifest(teamId)
  const node = findNodeByPath(manifest.root, path)
  if (!node || node.type !== 'file') {
    return null
  }
  const stored = await storage.getItem<DatasafeStoredFile>(fileKey(teamId, node.path))
  if (!stored) {
    return null
  }
  return { file: stored, node: cloneNode(node) }
}

export async function getRules(teamId: string): Promise<DatasafeRule[]> {
  const stored = await storage.getItem<DatasafeRule[]>(rulesKey(teamId))
  if (Array.isArray(stored) && stored.length > 0) {
    return stored
  }
  const now = nowIso()
  const defaults: DatasafeRule[] = [
    {
      id: 'finance-invoices',
      name: 'Finance invoices',
      description: 'Invoices from external senders get organized under Finance/Invoices',
      targetFolder: 'Finance/Invoices',
      conditions: [
        { type: 'filename-extension', value: 'pdf' },
        { type: 'subject-keyword', value: 'invoice' }
      ],
      autoCreateFolder: true,
      tags: ['finance'],
      createdAt: now,
      updatedAt: now
    },
    {
      id: 'contracts-attachments',
      name: 'Contracts attachments',
      description: 'Attachments from legal@ domains stored under Legal/Contracts',
      targetFolder: 'Legal/Contracts',
      conditions: [{ type: 'email-domain', value: 'legal' }],
      autoCreateFolder: true,
      tags: ['legal'],
      createdAt: now,
      updatedAt: now
    }
  ]
  await storage.setItem(rulesKey(teamId), defaults)
  return defaults
}

export async function saveRules(teamId: string, rules: DatasafeRule[]): Promise<void> {
  await storage.setItem(rulesKey(teamId), rules)
}

function matchesCondition(
  condition: DatasafeRuleCondition,
  context: DatasafeAttachmentContext
): boolean {
  const value = condition.value.toLowerCase()
  switch (condition.type) {
    case 'email-domain': {
      const from = context.emailMeta?.from
      const email = extractEmail(from || '') || from || ''
      const domain = email.includes('@') ? email.split('@')[1] : email
      return domain.toLowerCase().includes(value)
    }
    case 'mime-type': {
      const mime = (context.mimeType || '').toLowerCase()
      if (value.endsWith('/*')) {
        const prefix = value.slice(0, -2)
        return mime.startsWith(prefix)
      }
      return mime === value
    }
    case 'filename-extension': {
      const parts = context.filename.toLowerCase().split('.')
      const ext = parts.length > 1 ? parts[parts.length - 1] : ''
      return ext === value.replace(/^\./, '')
    }
    case 'filename-prefix': {
      return context.filename.toLowerCase().startsWith(value)
    }
    case 'subject-keyword': {
      const subject = (context.emailMeta?.subject || '').toLowerCase()
      return subject.includes(value)
    }
    case 'path-prefix': {
      const hints = context.ruleHints || []
      return hints.some((hint) => hint.toLowerCase().startsWith(value))
    }
    default:
      return false
  }
}

function evaluateRule(rule: DatasafeRule, context: DatasafeAttachmentContext): boolean {
  if (!rule.conditions.length) return false
  return rule.conditions.every((condition) => matchesCondition(condition, context))
}

export async function recommendPlacement(
  teamId: string,
  context: DatasafeAttachmentContext
): Promise<DatasafeRecommendedPlacement | null> {
  const rules = await getRules(teamId)
  const matches = rules.filter((rule) => evaluateRule(rule, context))

  if (!matches.length) {
    return null
  }

  matches.sort((a, b) => b.conditions.length - a.conditions.length)
  const primary = matches[0]
  const folderPath = normalizePath(primary.targetFolder)
  if (!folderPath) {
    return null
  }

  const manifest = await loadManifest(teamId)
  const segments = folderPath.split('/')
  const { created } = ensureFolderBySegments(manifest.root, segments)
  if (created.length) {
    await saveManifest(teamId, manifest)
  }

  return {
    folderPath,
    ruleIds: matches.map((rule) => rule.id),
    createdFolders: created
  }
}

export async function storeAttachment(
  teamId: string,
  context: DatasafeAttachmentContext,
  options?: { overwrite?: boolean; targetFolder?: string }
): Promise<DatasafeFileNode> {
  const recommendation = options?.targetFolder
    ? { folderPath: normalizePath(options.targetFolder), ruleIds: context.ruleHints || [] }
    : await recommendPlacement(teamId, context)

  const folderPath = recommendation?.folderPath || ''
  const filePath = normalizePath([folderPath, context.filename].filter(Boolean).join('/'))

  return await storeFile(teamId, filePath, {
    base64: context.data,
    size: context.size,
    mimeType: context.mimeType,
    source: context.source,
    metadata: context.emailMeta ? { email: context.emailMeta } : undefined,
    ruleMatches: recommendation?.ruleIds,
    overwrite: options?.overwrite
  })
}

export async function moveFileNode(
  teamId: string,
  sourcePath: string,
  targetFolderPath: string
): Promise<DatasafeFileNode> {
  const manifest = await loadManifest(teamId)
  const normalizedSource = normalizePath(sourcePath)
  if (!normalizedSource) {
    throw createError({ statusCode: 400, statusMessage: 'Source path required' })
  }

  const sourceSegments = normalizedSource.split('/')
  const sourceName = sourceSegments.pop()
  if (!sourceName) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid source path' })
  }
  const sourceFolder = findFolderBySegments(manifest.root, sourceSegments)
  if (!sourceFolder) {
    throw createError({ statusCode: 404, statusMessage: 'Source folder not found' })
  }
  const sourceIndex = sourceFolder.children.findIndex((child) => child.name === sourceName)
  if (sourceIndex === -1) {
    throw createError({ statusCode: 404, statusMessage: 'Source file not found' })
  }
  const sourceNode = sourceFolder.children[sourceIndex]
  if (!sourceNode || sourceNode.type !== 'file') {
    throw createError({ statusCode: 400, statusMessage: 'Only files can be moved currently' })
  }

  const targetNormalized = normalizePath(targetFolderPath)
  const targetSegments = targetNormalized ? targetNormalized.split('/') : []
  const targetFolder = findFolderBySegments(manifest.root, targetSegments)
  if (!targetFolder) {
    throw createError({ statusCode: 404, statusMessage: 'Target folder not found' })
  }

  const currentFolderPath = sourceSegments.join('/')
  const normalizedCurrent = normalizePath(currentFolderPath)
  const normalizedTarget = normalizePath(targetFolder.path)
  if (normalizedCurrent === normalizedTarget) {
    return cloneNode(sourceNode)
  }

  const storedFile = await storage.getItem<DatasafeStoredFile>(fileKey(teamId, sourceNode.path))
  if (!storedFile) {
    throw createError({ statusCode: 404, statusMessage: 'Stored file payload missing' })
  }

  const [fileNode] = sourceFolder.children.splice(sourceIndex, 1) as [DatasafeFileNode]

  let newName = fileNode.name
  if (targetFolder.children.some((child) => child.name === newName)) {
    newName = ensureUniqueFilename(targetFolder, newName)
  }

  const newPath = normalizePath([targetFolder.path, newName].filter(Boolean).join('/'))
  const now = nowIso()
  fileNode.name = newName
  fileNode.path = newPath
  fileNode.updatedAt = now

  targetFolder.children.push(fileNode)
  sourceFolder.updatedAt = now
  targetFolder.updatedAt = now
  sortChildren(sourceFolder)
  sortChildren(targetFolder)

  storedFile.path = newPath
  storedFile.filename = newName
  storedFile.updatedAt = now
  await storage.removeItem(fileKey(teamId, normalizedSource))
  await storage.setItem(fileKey(teamId, newPath), storedFile)

  await saveManifest(teamId, manifest)
  return cloneNode(fileNode)
}

export async function ensureTeamDatasafe(teamId: string): Promise<void> {
  await loadManifest(teamId)
  await getRules(teamId)
}
