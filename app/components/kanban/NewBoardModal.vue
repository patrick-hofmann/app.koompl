<script setup lang="ts">
const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'create', data: { name: string; description?: string; columns: string[] }): void
}>()

const form = reactive({
  name: '',
  description: '',
  columns: ['To Do', 'In Progress', 'Done']
})

const newColumnName = ref('')

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) {
      form.name = ''
      form.description = ''
      form.columns = ['To Do', 'In Progress', 'Done']
      newColumnName.value = ''
    }
  }
)

function addColumn() {
  const name = newColumnName.value.trim()
  if (name && !form.columns.includes(name)) {
    form.columns.push(name)
    newColumnName.value = ''
  }
}

function removeColumn(index: number) {
  form.columns.splice(index, 1)
}

function create() {
  if (!form.name.trim() || form.columns.length === 0) return

  emit('create', {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    columns: form.columns
  })

  emit('update:open', false)
}
</script>

<template>
  <UModal
    title="New Kanban Board"
    description="Create a new board for your team"
    :open="open"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <UCard>
        <UForm :state="form" @submit="create">
          <div class="space-y-3">
            <UFormField label="Board Name">
              <UInput v-model="form.name" placeholder="My Project Board" />
            </UFormField>

            <UFormField label="Description">
              <UTextarea
                v-model="form.description"
                placeholder="Optional description"
                :rows="2"
                autoresize
              />
            </UFormField>

            <UFormField label="Columns">
              <div class="space-y-2">
                <div class="flex gap-2">
                  <UInput
                    v-model="newColumnName"
                    placeholder="Column name"
                    @keyup.enter="addColumn"
                  />
                  <UButton icon="i-lucide-plus" size="sm" @click="addColumn" />
                </div>
                <div class="space-y-1">
                  <div
                    v-for="(column, index) in form.columns"
                    :key="index"
                    class="flex items-center justify-between p-2 bg-elevated rounded"
                  >
                    <span class="text-sm">{{ column }}</span>
                    <UButton
                      icon="i-lucide-x"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      @click="removeColumn(index)"
                    />
                  </div>
                </div>
              </div>
            </UFormField>

            <div class="flex items-center gap-2 justify-end">
              <UButton
                label="Cancel"
                color="neutral"
                variant="ghost"
                @click="emit('update:open', false)"
              />
              <UButton
                type="submit"
                label="Create Board"
                :disabled="!form.name.trim() || form.columns.length === 0"
              />
            </div>
          </div>
        </UForm>
      </UCard>
    </template>
  </UModal>
</template>
