<script setup lang="ts">
import type { PredefinedKoompl } from '~/composables/usePredefinedKoompls'

interface Props {
  koompl: PredefinedKoompl
  enabled: boolean
  loading?: boolean
  teamDomain: string
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
    purple: 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
  }
  return colors[props.koompl.color] || colors.blue
})

const checkboxColor = computed(() => {
  const colors: Record<string, 'primary' | 'green' | 'blue' | 'purple'> = {
    blue: 'blue',
    green: 'green',
    purple: 'purple'
  }
  return colors[props.koompl.color] || 'primary'
})

const teamDomain = computed(() => {
  return props.teamDomain || 'agents.local'
})
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
            background: enabled ? 'bg-primary' : 'bg-transparent',
            border: 'border-2 border-green-500',
            icon: enabled ? 'text-green-500' : 'text-transparent'
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

      <!-- Footer actions -->
      <div class="flex items-center justify-between pt-2">
        <div class="flex items-center gap-2 text-xs text-muted">
          <UIcon name="i-lucide-sparkles" class="w-3.5 h-3.5" />
          <span>Predefined</span>
        </div>

        <div class="flex items-center gap-1">
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
