<script setup lang="ts">
import type { PredefinedKoompl } from '~/composables/usePredefinedKoompls'

interface Props {
  koompl: PredefinedKoompl
  enabled: boolean
  loading?: boolean
  teamDomain: string
  mailLink?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'toggle', value: boolean): void
  (e: 'info' | 'testPrompt' | 'testRoundTrip'): void
}>()

const cardClass = computed(() => {
  return [
    'relative overflow-hidden transition-all duration-300 cursor-pointer group',
    props.enabled
      ? 'ring-2 ring-primary bg-primary/5 shadow-lg scale-[1.02]'
      : 'hover:shadow-md hover:scale-[1.01] bg-elevated'
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

const checkboxColor = computed(() => {
  const colors: Record<string, 'primary' | 'green' | 'blue' | 'purple' | 'orange'> = {
    blue: 'blue',
    green: 'green',
    purple: 'purple',
    orange: 'orange'
  }
  return colors[props.koompl.color] || 'primary'
})

// Get checkbox UI classes based on koompl color
const checkboxClasses = computed(() => {
  const colorMap: Record<string, { border: string; icon: string; bg: string }> = {
    blue: {
      border: 'border-blue-500',
      icon: 'text-blue-500',
      bg: 'bg-blue-500'
    },
    green: {
      border: 'border-green-500',
      icon: 'text-green-500',
      bg: 'bg-green-500'
    },
    purple: {
      border: 'border-purple-500',
      icon: 'text-purple-500',
      bg: 'bg-purple-500'
    },
    orange: {
      border: 'border-orange-500',
      icon: 'text-orange-500',
      bg: 'bg-orange-500'
    }
  }
  return colorMap[props.koompl.color] || colorMap.blue
})

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

  return (props.koompl.mcpServerIds || []).map((id) => toolMap[id]).filter(Boolean)
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
      <!-- Header with checkbox -->
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

        <!-- Checkbox -->
        <UCheckbox
          :model-value="enabled"
          :disabled="loading"
          :color="checkboxColor"
          size="xl"
          :ui="{
            base: '',
            background: enabled ? checkboxClasses.bg : 'bg-transparent',
            border: `border-2 ${checkboxClasses.border}`,
            icon: enabled ? checkboxClasses.icon : 'text-transparent'
          }"
          @update:model-value="emit('toggle', $event)"
          @click.stop
        />
      </div>

      <!-- Role badge -->
      <UBadge :color="koompl.color" variant="subtle" size="sm">
        {{ koompl.role }}
      </UBadge>

      <!-- Description -->
      <p class="text-sm text-muted leading-relaxed">
        {{ koompl.description }}
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
            :color="props.enabled ? 'primary' : 'neutral'"
            :to="props.enabled ? mailboxLink : undefined"
            :disabled="!props.enabled"
            title="View mailbox"
            @click.stop
          />

          <!-- Test buttons (only when enabled) -->
          <template v-if="enabled">
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
          </template>

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

      <!-- Loading overlay -->
      <div
        v-if="loading"
        class="absolute inset-0 bg-elevated/80 backdrop-blur-sm flex items-center justify-center rounded-lg"
      >
        <UIcon name="i-lucide-loader-circle" class="w-6 h-6 animate-spin text-primary" />
      </div>
    </div>
  </UCard>
</template>
