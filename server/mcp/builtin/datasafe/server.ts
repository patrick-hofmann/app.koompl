#!/usr/bin/env node
import { runBuiltinServer } from '../shared'
import { datasafeDefinition } from './definition'

runBuiltinServer(datasafeDefinition).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error('[BuiltinDatasafeMCP] Failed to start server:', message)
  process.exit(1)
})
