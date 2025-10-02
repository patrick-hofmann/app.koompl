<script setup lang="ts">
import type { KanbanBoard as KanbanBoardType, KanbanCard } from '~/server/types/kanban'
import CardModal from '~/components/kanban/CardModal.vue'
import NewBoardModal from '~/components/kanban/NewBoardModal.vue'
import KanbanBoard from '~/components/kanban/KanbanBoard.vue'

const toast = useToast()

const { data, pending, refresh } = await useFetch<{ boards: KanbanBoardType[] }>(
  '/api/kanban/boards',
  {
    server: false,
    default: () => ({ boards: [] })
  }
)

const boards = computed(() => data.value?.boards ?? [])
const selectedBoardId = ref<string | null>(null)
const selectedBoard = computed(
  () => boards.value.find((b) => b.id === selectedBoardId.value) || null
)

// Modals
const showNewBoardModal = ref(false)
const showCardModal = ref(false)
const showNewColumnModal = ref(false)
const editingCard = ref<(KanbanCard & { columnId: string }) | null>(null)
const editingColumnId = ref<string | null>(null)
const newColumnName = ref('')

// Select first board by default
watch(
  boards,
  (newBoards) => {
    if (newBoards.length > 0 && !selectedBoardId.value) {
      selectedBoardId.value = newBoards[0].id
    }
  },
  { immediate: true }
)

async function createBoard(data: { name: string; description?: string; columns: string[] }) {
  try {
    await $fetch('/api/kanban/boards', {
      method: 'POST',
      body: data
    })
    toast.add({
      title: 'Board created',
      description: `${data.name} has been created`,
      color: 'success',
      icon: 'i-lucide-check'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to create board',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

async function deleteBoard(boardId: string) {
  try {
    await $fetch(`/api/kanban/boards/${boardId}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Board deleted',
      color: 'success',
      icon: 'i-lucide-check'
    })
    selectedBoardId.value = null
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to delete board',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

function openCardModal(card?: KanbanCard, columnId?: string) {
  if (card && columnId) {
    editingCard.value = { ...card, columnId }
  } else if (columnId) {
    editingCard.value = null
    editingColumnId.value = columnId
  }
  showCardModal.value = true
}

async function saveCard(cardData: Partial<KanbanCard>) {
  if (!selectedBoard.value) return

  try {
    if (editingCard.value) {
      // Update existing card
      await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/cards/${editingCard.value.id}`, {
        method: 'PATCH',
        body: {
          columnId: editingCard.value.columnId,
          ...cardData
        }
      })
      toast.add({
        title: 'Card updated',
        color: 'success',
        icon: 'i-lucide-check'
      })
    } else if (editingColumnId.value) {
      // Create new card
      await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/cards`, {
        method: 'POST',
        body: {
          columnId: editingColumnId.value,
          ...cardData
        }
      })
      toast.add({
        title: 'Card created',
        color: 'success',
        icon: 'i-lucide-check'
      })
    }
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to save card',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

async function deleteCard() {
  if (!selectedBoard.value || !editingCard.value) return

  try {
    await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/cards/${editingCard.value.id}`, {
      method: 'DELETE',
      body: {
        columnId: editingCard.value.columnId
      }
    })
    toast.add({
      title: 'Card deleted',
      color: 'success',
      icon: 'i-lucide-check'
    })
    showCardModal.value = false
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to delete card',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

async function moveCard(
  cardId: string,
  fromColumnId: string,
  toColumnId: string,
  position: number
) {
  if (!selectedBoard.value) return

  try {
    await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/cards/move`, {
      method: 'POST',
      body: {
        cardId,
        fromColumnId,
        toColumnId,
        position
      }
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to move card',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

async function addColumn() {
  if (!selectedBoard.value) return
  showNewColumnModal.value = true
}

async function createColumn() {
  if (!selectedBoard.value || !newColumnName.value.trim()) return

  try {
    await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/columns`, {
      method: 'POST',
      body: {
        title: newColumnName.value.trim()
      }
    })
    toast.add({
      title: 'Column added',
      color: 'success',
      icon: 'i-lucide-check'
    })
    showNewColumnModal.value = false
    newColumnName.value = ''
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to add column',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

async function deleteColumn(columnId: string) {
  if (!selectedBoard.value) return

  try {
    await $fetch(`/api/kanban/boards/${selectedBoard.value.id}/columns/${columnId}`, {
      method: 'DELETE'
    })
    toast.add({
      title: 'Column deleted',
      color: 'success',
      icon: 'i-lucide-check'
    })
    await refresh()
  } catch (error) {
    toast.add({
      title: 'Failed to delete column',
      description: String(error),
      color: 'error',
      icon: 'i-lucide-alert-triangle'
    })
  }
}

const boardOptions = computed(() =>
  boards.value.map((b) => ({
    label: b.name,
    value: b.id
  }))
)
</script>

<template>
  <UDashboardPanel id="kanban">
    <template #header>
      <UDashboardNavbar title="Kanban Boards">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <USelect
            v-if="boards.length > 0"
            v-model="selectedBoardId"
            :items="boardOptions"
            class="w-64"
          />
          <UButton
            v-if="selectedBoard"
            label="Delete Board"
            icon="i-lucide-trash"
            color="error"
            variant="ghost"
            @click="deleteBoard(selectedBoard.id)"
          />
          <UButton label="New Board" icon="i-lucide-plus" @click="showNewBoardModal = true" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col h-full">
        <ClientOnly>
          <div v-if="pending" class="flex items-center justify-center flex-1">
            <div class="flex flex-col items-center gap-4">
              <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin" />
              <p class="text-muted">Loading boards...</p>
            </div>
          </div>

          <div
            v-else-if="boards.length === 0"
            class="flex flex-col items-center justify-center flex-1"
          >
            <UIcon name="i-lucide-kanban" class="w-16 h-16 text-muted mb-4" />
            <h2 class="text-xl font-semibold mb-2">No boards yet</h2>
            <p class="text-muted mb-4">Create your first Kanban board to get started</p>
            <UButton label="Create Board" icon="i-lucide-plus" @click="showNewBoardModal = true" />
          </div>

          <div v-else-if="selectedBoard" class="flex-1 overflow-hidden">
            <KanbanBoard
              :board="selectedBoard"
              @add-card="(columnId) => openCardModal(undefined, columnId)"
              @edit-card="(card, columnId) => openCardModal(card, columnId)"
              @delete-card="deleteCard"
              @move-card="moveCard"
              @add-column="addColumn"
              @delete-column="deleteColumn"
            />
          </div>
        </ClientOnly>

        <NewBoardModal
          :open="showNewBoardModal"
          @update:open="showNewBoardModal = $event"
          @create="createBoard"
        />

        <CardModal
          :open="showCardModal"
          :card="editingCard || undefined"
          :column-id="editingCard?.columnId || editingColumnId || ''"
          :board-id="selectedBoard?.id || ''"
          @update:open="showCardModal = $event"
          @save="saveCard"
          @delete="deleteCard"
        />

        <UModal
          title="Add Column"
          :open="showNewColumnModal"
          @update:open="showNewColumnModal = $event"
        >
          <template #content>
            <UCard>
              <UForm @submit="createColumn">
                <div class="space-y-3">
                  <UFormField label="Column Name">
                    <UInput v-model="newColumnName" placeholder="e.g. Review" />
                  </UFormField>

                  <div class="flex items-center gap-2 justify-end">
                    <UButton
                      label="Cancel"
                      color="neutral"
                      variant="ghost"
                      @click="showNewColumnModal = false"
                    />
                    <UButton type="submit" label="Add Column" :disabled="!newColumnName.trim()" />
                  </div>
                </div>
              </UForm>
            </UCard>
          </template>
        </UModal>
      </div>
    </template>
  </UDashboardPanel>
</template>
