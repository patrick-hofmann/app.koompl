<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~/types'

const props = defineProps<{
  period: Period
  range: Range
}>()

const UBadge = resolveComponent('UBadge')

type EmailActivity = {
  id: string
  date: string
  status: string
  email: string
  agent: string
  subject: string
}

const { data, refresh } = await useAsyncData('recent-emails', async () => {
  try {
    const emails = await $fetch<EmailActivity[]>('/api/stats/recent-emails', {
      query: {
        rangeStart: props.range.start.toISOString(),
        rangeEnd: props.range.end.toISOString()
      }
    })
    return emails || []
  } catch (error) {
    console.error('Failed to fetch recent emails:', error)
    return []
  }
}, {
  watch: [() => props.period, () => props.range],
  default: () => []
})

const columns: TableColumn<EmailActivity>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    cell: ({ row }) => {
      const id = row.getValue('id') as string
      return id.length > 20 ? `#${id.substring(0, 8)}...` : `#${id}`
    }
  },
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => {
      return new Date(row.getValue('date')).toLocaleString('en-US', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
    }
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      const color = {
        'responded': 'success' as const,
        'failed': 'error' as const,
        'blocked': 'warning' as const,
        'no-agent': 'neutral' as const,
        'received': 'info' as const
      }[status] || 'neutral'

      return h(UBadge, { class: 'capitalize', variant: 'subtle', color }, () =>
        status.replace('-', ' ')
      )
    }
  },
  {
    accessorKey: 'email',
    header: 'From Email'
  },
  {
    accessorKey: 'agent',
    header: 'Agent'
  },
  {
    accessorKey: 'subject',
    header: () => h('div', { class: 'text-left' }, 'Subject'),
    cell: ({ row }) => {
      const subject = row.getValue('subject') as string
      const truncated = subject.length > 30 ? subject.substring(0, 30) + '...' : subject
      return h('div', { class: 'max-w-xs text-left' }, truncated)
    }
  }
]
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-lg font-semibold text-highlighted">Recent Email Activity</h3>
      <UButton
        link
        icon="i-lucide-refresh-cw"
        size="sm"
        @click="refresh()"
      >
        Refresh
      </UButton>
    </div>

    <UTable
      :data="data"
      :columns="columns"
      class="shrink-0"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }"
    />
  </div>
</template>
