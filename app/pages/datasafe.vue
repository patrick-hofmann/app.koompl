<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { DatasafeFileNode, DatasafeNode, DatasafeRule } from '~/server/types/datasafe'

interface TreeItem {
  key: string
  label: string
  icon: string
  path: string
  node: DatasafeNode
  children?: TreeItem[]
  onSelect?: () => void
  defaultExpanded?: boolean
}

const toast = useToast()

const isRefreshing = ref(false)
const draggingFilePath = ref<string | null>(null)
const dragOverKey = ref<string | null>(null)
const movingFile = ref(false)

const {
  data: treeResponse,
  pending: _treePending,
  refresh: refreshTree
} = await useFetch<{
  node: DatasafeNode | null
}>('/api/datasafe/tree', {
  server: false,
  default: () => ({ node: null })
})

void _treePending

const { data: rulesResponse } = await useFetch<{
  ok: boolean
  rules: DatasafeRule[]
}>('/api/datasafe/rules', {
  server: false,
  default: () => ({ ok: true, rules: [] })
})

const expandedKeys = ref<string[]>(['/'])
const selectedKey = ref<string>('/')

const rootNode = computed(() => treeResponse.value?.node ?? null)

watch(
  rootNode,
  (node) => {
    if (!node) return
    if (!selectedKey.value) {
      selectedKey.value = node.path || '/'
    }
  },
  { immediate: true }
)

function getNodeKey(node: DatasafeNode): string {
  return node.path && node.path.length > 0 ? node.path : '/'
}

function getFileExtension(node: DatasafeNode): string {
  return node.name.split('.').pop()?.toLowerCase() || ''
}

function fileExtensionIcon(node: DatasafeNode): string {
  const ext = getFileExtension(node)
  return 'i-vscode-icons-file-type-' + ext
}

function createTreeItem(node: DatasafeNode): TreeItem {
  const label = node.path === '' ? 'Datasafe' : node.name
  const key = getNodeKey(node)
  const isFolder = node.type === 'folder'
  const item: TreeItem = {
    key,
    label,
    icon: isFolder ? 'i-lucide-folder' : fileExtensionIcon(node),
    path: node.path,
    node,
    defaultExpanded: key === '/' || key.split('/').length <= 2,
    onSelect: () => {
      selectedKey.value = key
    }
  }

  if (isFolder && Array.isArray(node.children)) {
    item.children = node.children.map((child) => createTreeItem(child))
  }

  return item
}

const treeItems = computed<TreeItem[]>(() => {
  if (!rootNode.value) return []
  const root = createTreeItem(rootNode.value)
  return [root]
})

const selectedNode = computed<DatasafeNode | null>(() => {
  if (!rootNode.value) return null
  const key = selectedKey.value
  if (key === '/' || !key) return rootNode.value

  function find(node: DatasafeNode): DatasafeNode | null {
    if (getNodeKey(node) === key) return node
    if (node.type === 'folder' && Array.isArray(node.children)) {
      for (const child of node.children) {
        const result = find(child)
        if (result) return result
      }
    }
    return null
  }

  return find(rootNode.value)
})

const selectedFolderPath = computed(() => {
  const node = selectedNode.value
  if (!node) return ''
  if (node.type === 'folder') {
    return node.path
  }
  const parts = node.path.split('/')
  parts.pop()
  return parts.join('/')
})

const rules = computed(() => rulesResponse.value?.rules ?? [])

function walkNodes(node: DatasafeNode, cb: (node: DatasafeNode) => void) {
  cb(node)
  if (node.type === 'folder' && Array.isArray(node.children)) {
    for (const child of node.children) {
      walkNodes(child, cb)
    }
  }
}

const allFiles = computed<DatasafeFileNode[]>(() => {
  const files: DatasafeFileNode[] = []
  const root = rootNode.value
  if (!root) return files
  walkNodes(root, (entry) => {
    if (entry.type === 'file') {
      files.push(entry as DatasafeFileNode)
    }
  })
  return files
})

const totalFiles = computed(() => allFiles.value.length)

const totalFolders = computed(() => {
  const root = rootNode.value
  if (!root) return 0
  let count = 0
  walkNodes(root, (entry) => {
    if (entry.type === 'folder') count += 1
  })
  return Math.max(count - 1, 0)
})

const totalSize = computed(() =>
  allFiles.value.reduce((sum, file) => sum + (typeof file.size === 'number' ? file.size : 0), 0)
)

const recentFiles = computed(() => {
  return allFiles.value
    .slice()
    .sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
      return bTime - aTime
    })
    .slice(0, 5)
})

const lastUpdatedAt = computed(() => {
  if (recentFiles.value.length > 0) {
    return recentFiles.value[0].updatedAt || recentFiles.value[0].createdAt
  }
  return rootNode.value?.updatedAt
})

const formattedTotalSize = computed(() => formatSize(totalSize.value))
const formattedLastUpdated = computed(() => formatDate(lastUpdatedAt.value))

const downloading = ref(false)
const uploading = ref(false)

function formatSize(bytes?: number): string {
  if (!bytes || Number.isNaN(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(date?: string): string {
  if (!date) return '—'
  try {
    return new Date(date).toLocaleString()
  } catch {
    return date
  }
}

function handleTreeSelect(value: unknown) {
  if (value == null) return
  if (Array.isArray(value)) {
    const first = value[0]
    if (typeof first === 'string') {
      selectedKey.value = first
      return
    }
    if (first && typeof first === 'object') {
      selectedKey.value = (first as any).key || (first as any).path || selectedKey.value
      return
    }
  }
  if (value instanceof Set) {
    const [first] = Array.from(value as Set<any>)
    if (typeof first === 'string') selectedKey.value = first
    else if (first && typeof first === 'object')
      selectedKey.value = first.key || first.path || selectedKey.value
    return
  }
  if (typeof value === 'string') {
    selectedKey.value = value
  } else if (value && typeof value === 'object') {
    selectedKey.value = (value as any).key || (value as any).path || selectedKey.value
  }
}

function handleExpandedChange(value: unknown) {
  const toKey = (entry: any) => {
    if (typeof entry === 'string') return entry
    if (entry && typeof entry === 'object') return entry.key || entry.path || '/'
    return '/'
  }
  if (Array.isArray(value)) {
    expandedKeys.value = value.map((entry) => toKey(entry))
    return
  }
  if (value instanceof Set) {
    expandedKeys.value = Array.from(value as Set<any>).map((entry) => toKey(entry))
    return
  }
}

async function reloadTree(showSpinner = false) {
  if (showSpinner) {
    isRefreshing.value = true
  }
  try {
    await refreshTree()
  } finally {
    if (showSpinner) {
      isRefreshing.value = false
    }
  }
}

async function handleManualRefresh() {
  await reloadTree(true)
}

function clearDragState() {
  dragOverKey.value = null
  draggingFilePath.value = null
}

function onDragStart(node: DatasafeNode, event: DragEvent) {
  if (node.type !== 'file') return
  draggingFilePath.value = node.path
  event.dataTransfer?.setData('text/plain', node.path)
  event.dataTransfer?.setDragImage?.(event.currentTarget as Element, 16, 16)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDragEnd() {
  clearDragState()
}

function onDragOver(node: DatasafeNode, event: DragEvent) {
  if (node.type !== 'folder') return
  if (!draggingFilePath.value || movingFile.value) return
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
  dragOverKey.value = getNodeKey(node)
}

function onDragLeave(node: DatasafeNode) {
  if (dragOverKey.value === getNodeKey(node)) {
    dragOverKey.value = null
  }
}

async function onDrop(node: DatasafeNode, event: DragEvent) {
  if (node.type !== 'folder') return
  if (!draggingFilePath.value || movingFile.value) return
  event.preventDefault()

  const sourcePath = draggingFilePath.value
  const targetFolder = node.path || ''
  const sourceFolder = sourcePath.split('/').slice(0, -1).join('/')

  if (sourceFolder === targetFolder) {
    clearDragState()
    return
  }

  movingFile.value = true
  try {
    const response = await $fetch<{
      ok: boolean
      node?: DatasafeFileNode
    }>('/api/datasafe/move', {
      method: 'POST',
      body: {
        sourcePath,
        targetFolder
      }
    })

    if (response.ok && response.node) {
      toast.add({
        title: 'File moved',
        description: `${response.node.name} moved to ${targetFolder || 'root'}`,
        color: 'success',
        icon: 'i-lucide-check'
      })
      selectedKey.value = response.node.path
      await reloadTree()
    }
  } catch (error) {
    toast.add({
      title: 'Move failed',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  } finally {
    movingFile.value = false
    clearDragState()
  }
}

const hiddenFileInput = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  hiddenFileInput.value?.click()
}

async function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const folder = selectedFolderPath.value
  const form = new FormData()
  form.append('file', file)
  if (folder) {
    form.append('folder', folder)
  }

  uploading.value = true
  try {
    await $fetch('/api/datasafe/upload', {
      method: 'POST',
      body: form
    })
    toast.add({
      title: 'Upload complete',
      description: `${file.name} uploaded to ${folder || 'root'}`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    await reloadTree()
  } catch (error) {
    toast.add({
      title: 'Upload failed',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function createNewFolder() {
  const base = selectedFolderPath.value
  const name = window.prompt('Folder name')?.trim()
  if (!name) return

  const path = base ? `${base}/${name}` : name
  try {
    await $fetch('/api/datasafe/folders', {
      method: 'POST',
      body: { path }
    })
    toast.add({
      title: 'Folder created',
      description: path,
      color: 'success',
      icon: 'i-lucide-check'
    })
    await reloadTree()
  } catch (error) {
    toast.add({
      title: 'Could not create folder',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const byteCharacters = atob(base64)
  const byteNumbers = new Array(byteCharacters.length)
  for (let i = 0; i < byteCharacters.length; i += 1) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }
  const byteArray = new Uint8Array(byteNumbers)
  return new Blob([byteArray], { type: mimeType })
}

async function downloadSelectedFile() {
  const node = selectedNode.value
  if (!node || node.type !== 'file' || downloading.value) return

  downloading.value = true
  try {
    const response = await $fetch<{
      ok: boolean
      file: {
        name: string
        path: string
        mimeType: string
        size: number
        base64: string
        encoding: string
      }
    }>('/api/datasafe/download', {
      query: { path: node.path }
    })

    const blob = base64ToBlob(response.file.base64, response.file.mimeType)
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = response.file.name || node.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.add({
      title: 'Download started',
      description: response.file.name,
      color: 'info',
      icon: 'i-lucide-download'
    })
  } catch (error) {
    toast.add({
      title: 'Download failed',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <UDashboardPanel id="datasafe">
    <template #header>
      <UDashboardNavbar title="Datasafe">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="ghost"
              :loading="isRefreshing"
              :disabled="isRefreshing"
              @click="handleManualRefresh"
            />
            <UButton
              icon="i-lucide-folder-plus"
              color="primary"
              variant="soft"
              @click="createNewFolder"
            >
              New folder
            </UButton>
            <UButton
              icon="i-lucide-upload"
              color="primary"
              :loading="uploading"
              @click="triggerUpload"
            >
              Upload
            </UButton>
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <UCard v-if="rootNode" class="mb-6">
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-default bg-muted/20 p-4 flex flex-col gap-1">
            <span class="text-xs uppercase tracking-wide text-muted">Documents</span>
            <span class="text-2xl font-semibold text-highlighted">{{ totalFiles }}</span>
            <span class="text-xs text-muted">Files currently stored</span>
          </div>
          <div class="rounded-lg border border-default bg-muted/20 p-4 flex flex-col gap-1">
            <span class="text-xs uppercase tracking-wide text-muted">Folders</span>
            <span class="text-2xl font-semibold text-highlighted">{{ totalFolders }}</span>
            <span class="text-xs text-muted">Team directories excluding root</span>
          </div>
          <div class="rounded-lg border border-default bg-muted/20 p-4 flex flex-col gap-1">
            <span class="text-xs uppercase tracking-wide text-muted">Storage used</span>
            <span class="text-2xl font-semibold text-highlighted">{{ formattedTotalSize }}</span>
            <span class="text-xs text-muted">Combined size of all documents</span>
          </div>
          <div class="rounded-lg border border-default bg-muted/20 p-4 flex flex-col gap-1">
            <span class="text-xs uppercase tracking-wide text-muted">Last update</span>
            <span class="text-lg font-semibold text-highlighted">{{ formattedLastUpdated }}</span>
            <span class="text-xs text-muted">Most recent file activity</span>
          </div>
        </div>
      </UCard>
      <div class="grid gap-6 lg:grid-cols-[320px,1fr]">
        <UCard class="h-full overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-highlighted">Folders</h3>
              <UPopover>
                <UButton icon="i-lucide-info" size="xs" color="neutral" variant="ghost" />
                <template #panel>
                  <div class="max-w-xs text-xs text-muted p-3">
                    Use the tree to navigate folders and files. Selecting a folder updates the
                    upload destination. Selecting a file reveals details on the right.
                  </div>
                </template>
              </UPopover>
            </div>
          </template>

          <div class="max-h-[70vh] overflow-auto pr-1">
            <UTree
              expanded-icon="i-lucide-book-open"
              collapsed-icon="i-lucide-book"
              :items="treeItems"
              :model-value="selectedKey"
              :expanded="expandedKeys"
              selection-behavior="toggle"
              :get-key="
                (item: any) => (typeof item === 'string' ? item : item.key || item.path || '/')
              "
              @update:model-value="handleTreeSelect"
              @update:expanded="handleExpandedChange"
            >
              <template #item-label="{ item }">
                <span
                  :draggable="item.node.type === 'file' && !movingFile"
                  role="button"
                  tabindex="0"
                  @click="item.onSelect?.()"
                  @keydown.enter.prevent="item.onSelect?.()"
                  @keydown.space.prevent="item.onSelect?.()"
                  @dragstart="onDragStart(item.node, $event)"
                  @dragend="onDragEnd"
                  @dragover="onDragOver(item.node, $event)"
                  @dragleave="onDragLeave(item.node)"
                  @drop="onDrop(item.node, $event)"
                >
                  <span class="truncate">{{ item.label }}</span>
                </span>
              </template>
            </UTree>
          </div>
        </UCard>

        <div class="space-y-6">
          <UCard>
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-highlighted">Quick actions</h3>
                <UBadge color="neutral" variant="subtle" size="xs"
                  >Target: {{ selectedFolderPath || 'root' }}</UBadge
                >
              </div>
            </template>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                icon="i-lucide-upload"
                color="primary"
                :loading="uploading"
                :disabled="movingFile"
                @click="triggerUpload"
              >
                Upload file here
              </UButton>
              <UButton
                icon="i-lucide-folder-plus"
                color="neutral"
                variant="soft"
                @click="createNewFolder"
              >
                New subfolder
              </UButton>
              <UButton
                icon="i-lucide-refresh-cw"
                color="neutral"
                variant="ghost"
                :loading="isRefreshing"
                :disabled="isRefreshing"
                @click="handleManualRefresh"
              >
                Refresh
              </UButton>
              <UButton
                icon="i-lucide-download"
                color="neutral"
                variant="outline"
                :disabled="!selectedNode || selectedNode.type !== 'file'"
                :loading="downloading"
                @click="downloadSelectedFile"
              >
                Download selection
              </UButton>
            </div>
          </UCard>
          <UCard v-if="selectedNode">
            <template #header>
              <div class="flex items-center justify-between">
                <div>
                  <p class="text-xs text-muted uppercase tracking-wide">
                    Selected {{ selectedNode.type }}
                  </p>
                  <h3 class="text-lg font-semibold text-highlighted">
                    {{ selectedNode.path === '' ? 'Datasafe root' : selectedNode.name }}
                  </h3>
                </div>
                <div class="flex items-center gap-2">
                  <UBadge v-if="selectedNode.type === 'file'" color="primary" variant="subtle">
                    {{ formatSize(selectedNode.size) }}
                  </UBadge>
                  <UBadge v-if="selectedNode.type === 'file'" color="neutral" variant="subtle">
                    Source: {{ selectedNode.source || 'unknown' }}
                  </UBadge>
                  <UButton
                    v-if="selectedNode.type === 'file'"
                    icon="i-lucide-download"
                    color="primary"
                    variant="soft"
                    :loading="downloading"
                    @click="downloadSelectedFile"
                  >
                    Download
                  </UButton>
                </div>
              </div>
            </template>

            <div class="space-y-4 text-sm">
              <div class="grid gap-2 md:grid-cols-2">
                <div>
                  <p class="text-muted text-xs uppercase">Full path</p>
                  <p class="text-highlighted font-medium break-all">
                    {{ selectedNode.path || '/' }}
                  </p>
                </div>
                <div>
                  <p class="text-muted text-xs uppercase">Last updated</p>
                  <p class="text-highlighted font-medium">
                    {{ formatDate(selectedNode.updatedAt) }}
                  </p>
                </div>
                <div v-if="selectedNode.type === 'file'">
                  <p class="text-muted text-xs uppercase">Created at</p>
                  <p class="text-highlighted font-medium">
                    {{ formatDate(selectedNode.createdAt) }}
                  </p>
                </div>
                <div v-if="selectedNode.type === 'file'">
                  <p class="text-muted text-xs uppercase">Rule matches</p>
                  <div class="flex flex-wrap gap-1 mt-1">
                    <UBadge
                      v-if="!selectedNode.ruleMatches?.length"
                      color="neutral"
                      variant="subtle"
                    >
                      none
                    </UBadge>
                    <UBadge
                      v-for="rule in selectedNode.ruleMatches || []"
                      :key="rule"
                      color="primary"
                      variant="solid"
                      size="xs"
                    >
                      {{ rule }}
                    </UBadge>
                  </div>
                </div>
              </div>

              <UAlert
                v-if="selectedNode.type === 'folder'"
                icon="i-lucide-lightbulb"
                color="info"
                variant="soft"
                title="Uploads"
                description="New files will be uploaded into this folder. Use rules below to keep documents organized."
              />
            </div>
          </UCard>

          <UCard v-if="recentFiles.length">
            <template #header>
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-semibold text-highlighted">Recent documents</h3>
                <UBadge color="neutral" variant="subtle" size="xs"
                  >Last {{ recentFiles.length }} uploads</UBadge
                >
              </div>
            </template>
            <ul class="space-y-3">
              <li
                v-for="file in recentFiles"
                :key="file.id"
                class="flex flex-col gap-1 rounded-lg border border-default bg-muted/10 p-3"
              >
                <div class="flex items-center justify-between gap-2">
                  <p class="font-medium text-highlighted truncate">{{ file.name }}</p>
                  <UBadge color="primary" variant="outline" size="xs">{{
                    formatSize(file.size)
                  }}</UBadge>
                </div>
                <p class="text-xs text-muted break-all">{{ file.path }}</p>
                <div class="flex items-center gap-3 text-xs text-muted">
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-clock" class="h-3.5 w-3.5" />
                    {{ formatDate(file.updatedAt || file.createdAt) }}
                  </span>
                  <span class="flex items-center gap-1">
                    <UIcon name="i-lucide-sparkles" class="h-3.5 w-3.5" />
                    {{ file.source }}
                  </span>
                </div>
              </li>
            </ul>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-highlighted">Storage rules</h3>
            </template>
            <div class="space-y-3">
              <div v-if="!rules.length" class="text-sm text-muted">
                No datasafe rules configured yet. The default automation captures invoices and legal
                documents.
              </div>
              <div
                v-for="rule in rules"
                :key="rule.id"
                class="rounded-lg border border-default p-4"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="font-semibold text-highlighted">{{ rule.name }}</h4>
                    <p class="text-muted text-xs">
                      Stores under
                      <span class="font-medium text-default">{{ rule.targetFolder }}</span>
                    </p>
                  </div>
                  <UBadge color="neutral" variant="subtle" size="xs">{{ rule.id }}</UBadge>
                </div>
                <p v-if="rule.description" class="text-sm text-default mt-2">
                  {{ rule.description }}
                </p>
                <div class="flex flex-wrap gap-1 mt-3">
                  <UBadge
                    v-for="condition in rule.conditions"
                    :key="`${rule.id}-${condition.type}-${condition.value}`"
                    color="primary"
                    variant="soft"
                    size="xs"
                  >
                    {{ condition.type }} → {{ condition.value }}
                  </UBadge>
                </div>
              </div>
            </div>
          </UCard>
        </div>
      </div>

      <input ref="hiddenFileInput" type="file" class="hidden" @change="onFileChange" />
    </template>
  </UDashboardPanel>
</template>
