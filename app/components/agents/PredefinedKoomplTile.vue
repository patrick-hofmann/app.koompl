<script setup lang="ts">
import type { PredefinedKoompl } from '~/composables/useAgents'

interface Props {
  koompl: PredefinedKoompl
  teamDomain: string
  mailLink?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'info' | 'testPrompt' | 'testRoundTrip'): void
}>()

const cardClass = computed(() => {
  return [
    'relative overflow-hidden transition-all duration-300 cursor-pointer group',
    'ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]'
  ]
})

const iconBgClass = computed(() => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    green: 'bg-green-500/10 text-green-600 dark:text-green-400',
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    orange: 'bg-orange-500/10 text-orange-600 dark:text-orange-400'
  }
  return colors[props.koompl.color] || colors.blue
})

// No checkbox anymore

const teamDomain = computed(() => {
  return props.teamDomain || 'agents.local'
})

// Get MCP tool info
const mcpTools = computed(() => {
  const toolMap: Record<string, { label: string; icon: string; color: string }> = {
    'builtin-calendar': {
      label: 'Calendar',
      icon: 'i-lucide-calendar',
      color: 'blue'
    },
    'builtin-kanban': {
      label: 'Tasks',
      icon: 'i-lucide-kanban',
      color: 'purple'
    },
    'builtin-datasafe': {
      label: 'Files',
      icon: 'i-lucide-folder',
      color: 'orange'
    },
    'builtin-email': {
      label: 'Email',
      icon: 'i-lucide-mail',
      color: 'green'
    },
    'builtin-agents': {
      label: 'Delegation',
      icon: 'i-lucide-users',
      color: 'primary'
    }
  }

  return (props.koompl.mcp_servers || []).map((id) => toolMap[id]).filter(Boolean)
})

const mailboxLink = computed(() => props.mailLink || `/agents/${props.koompl.id}`)
</script>

<template>
  <UCard
    :class="cardClass"
    :ui="{
      body: { base: 'h-full', padding: 'p-6' }
    }"
  >
    <!-- Decorative gradient -->
    <div
      class="absolute -right-16 -top-16 h-32 w-32 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-30"
      :class="{
        'bg-blue-500': koompl.color === 'blue',
        'bg-green-500': koompl.color === 'green',
        'bg-purple-500': koompl.color === 'purple'
      }"
    />

    <div class="relative space-y-4">
      <!-- Header -->
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <!-- Icon -->
          <div :class="['rounded-xl p-3 transition-transform group-hover:scale-110', iconBgClass]">
            <UIcon :name="koompl.icon" class="w-6 h-6" />
          </div>

          <!-- Name & Email -->
          <div class="flex-1 min-w-0">
            <h3 class="font-semibold text-lg text-highlighted truncate">
              {{ koompl.name }}
            </h3>
            <p class="text-sm text-muted truncate">{{ koompl.email }}@{{ teamDomain }}</p>
          </div>
        </div>
      </div>

      <!-- Role badge -->
      <UBadge :color="koompl.color" variant="subtle" size="sm">
        {{ koompl.role }}
      </UBadge>

      <!-- Description (short) -->
      <p class="text-sm text-muted leading-relaxed">
        {{ koompl.short_description || koompl.description }}
      </p>

      <!-- MCP Tools -->
      <div v-if="mcpTools.length > 0" class="flex flex-wrap gap-1.5">
        <UBadge v-for="tool in mcpTools" :key="tool.label" variant="soft" size="sm">
          <template #leading>
            <UIcon :name="tool.icon" class="w-3 h-3" />
          </template>
          {{ tool.label }}
        </UBadge>
      </div>

      <!-- Footer actions -->
      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
          <span>Predefined</span>
        </div>

        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-mail"
            size="xs"
            variant="ghost"
            color="primary"
            :to="mailboxLink"
            title="View mailbox"
            @click.stop
          />

          <!-- Test buttons -->
          <UButton
            icon="i-lucide-flask-conical"
            size="xs"
            variant="ghost"
            color="neutral"
            title="Test prompt"
            @click.stop="emit('testPrompt')"
          />
          <UButton
            icon="i-lucide-rotate-ccw"
            size="xs"
            variant="ghost"
            color="neutral"
            title="Test round-trip"
            @click.stop="emit('testRoundTrip')"
          />

          <!-- Info button -->
          <UButton
            icon="i-lucide-info"
            size="xs"
            variant="ghost"
            color="neutral"
            title="View prompt"
            @click.stop="emit('info')"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
