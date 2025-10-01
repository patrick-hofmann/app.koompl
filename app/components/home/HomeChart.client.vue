<script setup lang="ts">
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import type { Period, Range } from '~/types'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period: Period;
  range: Range;
  direction?: 'received' | 'sent' | 'both'
}>()

type DataRecord = {
  date: Date;
  emails: number
}

const { width } = useElementSize(cardRef)

const data = ref<DataRecord[]>([])
const isLoading = ref(true)

// Function to format number without currency
const formatNumber = (value: number): string => new Intl.NumberFormat('en').format(value)

// Helper function to format dates based on period for grouping
const formatDateForPeriod = (date: Date, period: Period): string => {
  if (period === 'daily') {
    return format(date, 'yyyy-MM-dd')
  } else if (period === 'weekly') {
    return format(date, 'yyyy-\'W\'ww')
  } else if (period === 'monthly') {
    return format(date, 'yyyy-MM')
  }
  return format(date, 'yyyy-MM-dd') // Default fallback
}

// Fetch emails data based on current props period/range on-demand
watch([() => props.period, () => props.range, () => props.direction], async () => {
  console.log('props.direction', props.direction)
  isLoading.value = true

  // Get emails data from API
  try {
    const emailsData = await $fetch<{
      emails: { received: number; responded: number };
      emailData: Array<{
        timestamp: string;
        usedOpenAI: boolean;
        mailgunSent: boolean;
        domainFiltered: boolean
      }>;
      timestamp: number
    }>('/api/stats/chart', {
      query: {
        period: props.period,
        rangeStart: props.range.start.toISOString(),
        rangeEnd: props.range.end.toISOString(),
        direction: props.direction || 'both'
      }
    })

    console.log('emailsData', emailsData)

    const dates = ({
      daily: eachDayOfInterval,
      weekly: eachWeekOfInterval,
      monthly: eachMonthOfInterval
    } as Record<Period, typeof eachDayOfInterval>)[props.period](props.range)

    // Use real email activity data to build chart
    if (emailsData?.emailData && emailsData.emailData.length > 0) {
      const emailActivity = emailsData.emailData

      // Group emails by date based on the period
      const emailByDate = new Map<string, number>()

      emailActivity.forEach(email => {
        const emailDate = new Date(email.timestamp)
        const keyDate = formatDateForPeriod(emailDate, props.period)

        emailByDate.set(keyDate, (emailByDate.get(keyDate) || 0) + 1)
      })

      // Build chart data based on dates
      data.value = dates.map(date => {
        const keyDate = formatDateForPeriod(date, props.period)
        const emailsOnThisDate = emailByDate.get(keyDate) || 0

        return {
          date,
          emails: emailsOnThisDate
        }
      })
    } else {
      // If no real data, show a flat line
      data.value = dates.map(date => ({
        date,
        emails: 0
      }))
    }
  } catch (error) {
    console.error('Failed to fetch email chart data:', error)

    // Fallback to empty dataset
    const dates = ({
      daily: eachDayOfInterval,
      weekly: eachWeekOfInterval,
      monthly: eachMonthOfInterval
    } as Record<Period, typeof eachDayOfInterval>)[props.period](props.range)

    data.value = dates.map(date => ({
      date,
      emails: 0
    }))
  }

  isLoading.value = false
}, { immediate: true })

const x = (_: DataRecord, i: number) => i
const y = (d: DataRecord) => d.emails

const total = computed(() => data.value.reduce((acc: number, { emails }) => acc + emails, 0))

const formatDate = (date: Date): string => {
  return ({
    daily: format(date, 'd MMM'),
    weekly: format(date, 'd MMM'),
    monthly: format(date, 'MMM yyy')
  })[props.period]
}

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
    return ''
  }

  return formatDate(data.value[i].date)
}

const template = (d: DataRecord) => `${formatDate(d.date)}: ${formatNumber(d.emails)} emails`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div>
        <p class="text-xs text-muted uppercase mb-1.5">
          {{ props.direction === 'sent' ? 'Emails Sent' : props.direction === 'both' ? 'Emails (Received + Sent)' : 'Emails Received' }}
        </p>
        <p class="text-3xl text-highlighted font-semibold">
          {{ formatNumber(total) }}
        </p>
      </div>
    </template>

    <VisXYContainer
      :data="data"
      :padding="{ top: 40 }"
      class="h-96"
      :width="width"
    >
      <VisLine
        :x="x"
        :y="y"
        color="var(--ui-primary)"
      />
      <VisArea
        :x="x"
        :y="y"
        color="var(--ui-primary)"
        :opacity="0.1"
      />

      <VisAxis
        type="x"
        :x="x"
        :tick-format="xTicks"
      />

      <VisCrosshair
        color="var(--ui-primary)"
        :template="template"
      />

      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);

  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);

  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
