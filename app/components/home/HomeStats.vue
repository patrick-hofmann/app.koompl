<script setup lang="ts">
import type { Period, Range, Stat } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
  direction?: 'received' | 'sent' | 'both'
}>()

function formatPercentage(value: number): string {
  return `${value}%`
}

function getStatLink(title: string): string {
  switch (title) {
    case 'Koompls':
      return '/agents'
    case 'Email Responses':
      return '/agents'
    case 'Active Domains':
      return '/domains'
    case 'Success Rate':
      return '/agents'
    default:
      return '/'
  }
}

function getStatColor(variation: number, title?: string): string {
  // For Success Rate, lower percentage means worse performance
  if (title === 'Success Rate') {
    return variation < 0 ? 'error' : 'success'
  }

  // For other metrics, positive variation is good
  if (variation > 0) return 'success'
  if (variation < 0) return 'error'
  return 'neutral'
}

const { data: stats } = await useAsyncData<Stat[]>('dashboard-stats', async () => {
  try {
    // Fetch real dashboard data
    const statsData = await $fetch<{
      agents: { count: number, variation: number }
      emails: { received: number, responded: number, variation: number }
      domains: { active: number, total: number, variation: number }
      successRate: { percentage: number, variation: number }
    }>('/api/stats/overview', {
      query: {
        period: props.period,
        rangeStart: props.range.start.toISOString(),
        rangeEnd: props.range.end.toISOString(),
        direction: props.direction || 'both'
      }
    })

    const newStats: Stat[] = [
      {
        title: 'Koompls',
        icon: 'i-lucide-bot',
        value: statsData.agents.count,
        variation: statsData.agents.variation
      },
      {
        title: 'Email Responses',
        icon: 'i-lucide-mail-fast',
        value: statsData.emails.responded,
        variation: statsData.emails.variation
      },
      {
        title: 'Active Domains',
        icon: 'i-lucide-globe',
        value: statsData.domains.active,
        variation: statsData.domains.variation
      },
      {
        title: 'Success Rate',
        icon: 'i-lucide-check-circle',
        value: formatPercentage(statsData.successRate.percentage),
        variation: statsData.successRate.variation
      }
    ]

    return newStats
  } catch (error) {
    // Fallback to basic stats if API is not available
    console.error('Failed to fetch dashboard stats:', error)
    return [
      {
        title: 'Koompls',
        icon: 'i-lucide-bot',
        value: 0,
        variation: 0
      },
      {
        title: 'Email Responses',
        icon: 'i-lucide-mail-fast',
        value: 0,
        variation: 0
      },
      {
        title: 'Active Domains',
        icon: 'i-lucide-globe',
        value: 0,
        variation: 0
      },
      {
        title: 'Success Rate',
        icon: 'i-lucide-check-circle',
        value: formatPercentage(0),
        variation: 0
      }
    ]
  }
}, {
  watch: [() => props.period, () => props.range, () => props.direction],
  default: () => []
})
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard
      v-for="(stat, index) in stats"
      :key="index"
      :icon="stat.icon"
      :title="stat.title"
      :to="getStatLink(stat.title)"
      variant="subtle"
      :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs uppercase'
      }"
      class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
    >
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>

        <UBadge
          v-if="stat.variation !== 0"
          :color="getStatColor(stat.variation, stat.title)"
          variant="subtle"
          class="text-xs"
        >
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
