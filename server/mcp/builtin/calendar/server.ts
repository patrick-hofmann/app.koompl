#!/usr/bin/env node
import { runBuiltinServer } from '../shared'
import { calendarDefinition } from './definition'

runBuiltinServer(calendarDefinition).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[BuiltinCalendarMCP] Failed to start server:', message)
  process.exit(1)
})
