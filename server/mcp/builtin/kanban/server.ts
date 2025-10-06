#!/usr/bin/env node
import { runBuiltinServer } from '../shared'
import { kanbanDefinition } from './definition'

runBuiltinServer(kanbanDefinition).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[BuiltinKanbanMCP] Failed to start server:', message)
  process.exit(1)
})
