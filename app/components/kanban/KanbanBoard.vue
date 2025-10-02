<script setup lang="ts">
import type { KanbanBoard, KanbanCard } from '~/server/types/kanban'

defineProps<{
  board: KanbanBoard
}>()

const emit = defineEmits<{
  (e: 'update:board', board: KanbanBoard): void
  (e: 'add-card' | 'delete-column', columnId: string): void
  (e: 'edit-card', card: KanbanCard, columnId: string): void
  (e: 'delete-card', cardId: string, columnId: string): void
  (e: 'move-card', cardId: string, fromColumnId: string, toColumnId: string, position: number): void
  (e: 'add-column'): void
}>()

const draggedCard = ref<{ cardId: string; columnId: string } | null>(null)

function onDragStart(card: KanbanCard, columnId: string) {
  draggedCard.value = { cardId: card.id, columnId }
}

function onDragOver(event: DragEvent) {
  event.preventDefault()
}

function onDrop(event: DragEvent, toColumnId: string) {
  event.preventDefault()
  if (!draggedCard.value) return

  const { cardId, columnId: fromColumnId } = draggedCard.value

  if (fromColumnId !== toColumnId) {
    emit('move-card', cardId, fromColumnId, toColumnId, 0)
  }

  draggedCard.value = null
}

function getPriorityColor(priority?: string) {
  switch (priority) {
    case 'High':
      return 'red'
    case 'Medium':
      return 'orange'
    case 'Low':
      return 'blue'
    default:
      return 'gray'
  }
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-4 h-full">
    <div
      v-for="column in board.columns"
      :key="column.id"
      class="flex-shrink-0 w-80 bg-elevated rounded-lg p-4"
      @dragover="onDragOver"
      @drop="onDrop($event, column.id)"
    >
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <h3 class="font-semibold text-highlighted">{{ column.title }}</h3>
          <UBadge size="xs" color="neutral" variant="subtle">{{ column.cards.length }}</UBadge>
        </div>
        <UDropdownMenu
          :items="[
            [
              {
                label: 'Delete Column',
                icon: 'i-lucide-trash',
                color: 'error',
                onSelect: () => emit('delete-column', column.id)
              }
            ]
          ]"
        >
          <UButton icon="i-lucide-more-vertical" size="xs" color="neutral" variant="ghost" />
        </UDropdownMenu>
      </div>

      <div class="space-y-2 min-h-[100px]">
        <div
          v-for="card in column.cards"
          :key="card.id"
          draggable="true"
          class="bg-base border border-muted rounded-lg p-3 cursor-move hover:border-primary transition-colors"
          @dragstart="onDragStart(card, column.id)"
          @click="emit('edit-card', card, column.id)"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <h4 class="font-medium text-sm text-highlighted line-clamp-2">{{ card.title }}</h4>
            <UBadge
              v-if="card.priority"
              size="xs"
              :color="getPriorityColor(card.priority)"
              variant="subtle"
            >
              {{ card.priority }}
            </UBadge>
          </div>

          <p v-if="card.description" class="text-xs text-muted line-clamp-2 mb-2">
            {{ card.description }}
          </p>

          <div class="flex items-center justify-between text-xs">
            <div class="flex items-center gap-2">
              <span v-if="card.assignee" class="text-muted">
                <UIcon name="i-lucide-user" class="w-3 h-3 inline" />
                {{ card.assignee }}
              </span>
              <span v-if="card.ticket" class="text-muted">
                <UIcon name="i-lucide-ticket" class="w-3 h-3 inline" />
                {{ card.ticket }}
              </span>
            </div>
          </div>

          <div v-if="card.tags && card.tags.length" class="flex flex-wrap gap-1 mt-2">
            <UBadge v-for="tag in card.tags" :key="tag" size="xs" color="neutral" variant="subtle">
              {{ tag }}
            </UBadge>
          </div>
        </div>
      </div>

      <UButton
        label="Add Card"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="ghost"
        block
        class="mt-3"
        @click="emit('add-card', column.id)"
      />
    </div>

    <div class="flex-shrink-0 w-80">
      <UButton
        label="Add Column"
        icon="i-lucide-plus"
        size="sm"
        color="neutral"
        variant="soft"
        block
        @click="emit('add-column')"
      />
    </div>
  </div>
</template>
