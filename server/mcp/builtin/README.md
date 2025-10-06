# Built-in MCP Servers

This directory hosts every first-party MCP server that ships with Koompl. Each
server follows the same layout so that adding or auditing a built-in provider is
straightforward.

```
server/mcp/builtin/
├── shared/           # lightweight runtime helpers used by every server
├── <provider>/       # e.g. kanban, calendar, datasafe
│   ├── context.ts    # context definition + high level summaries for UI
│   ├── operations.ts # domain specific read/write helpers (pure business logic)
│   ├── definition.ts # single source of truth for MCP tools
│   ├── server.ts     # tiny CLI entry point that starts the MCP server
│   └── index.ts      # re-exports for convenience
└── index.ts          # convenient barrel + shared exports
```

## Anatomy of a built-in server

1. **Context (`context.ts`)** – defines the shape of the MCP context and any
   helper that turns stored data into summaries. These helpers are consumed by
   `mcpClients.ts` when a quick preview is needed.
2. **Operations (`operations.ts`)** – pure async functions that encapsulate
   storage access. They are reusable from HTTP endpoints, direct tool execution
   (`builtinMcpTools.ts`) and MCP server handlers.
3. **Definition (`definition.ts`)** – describes every tool (name, schema,
   description) and wires the operations into the generic runner from
   `shared/`. The definition is the single source of truth for tooling metadata
   and execution.
4. **Server (`server.ts`)** – a minimal CLI wrapper that calls
   `runBuiltinServer` with the definition. No bespoke wiring per provider is
   required anymore.

The `shared/` module exposes:
- `BuiltinMcpDefinition` – a typed contract for definitions
- `BuiltinToolDefinition` / `BuiltinToolResponse`
- `runBuiltinServer` – handles stdio transport, JSON RPC wiring and
  serialization of responses.

Direct execution helpers (e.g. `tools/builtin.ts` and
`tools/calendar.ts`) now consume the exact same definitions to avoid
schema drift between MCP and HTTP usage.

## Adding a new builtin MCP server

1. Create a folder under `server/mcp/builtin/<provider>`.
2. Add `context.ts` and `operations.ts` that sit on top of existing storage
   utilities (or new ones if necessary).
3. Define the MCP tools in `definition.ts` by composing the operations and
   specifying the environment variables that provide context.
4. Add a `server.ts` that simply calls `runBuiltinServer(yourDefinition)`.
5. Export the pieces from the folder’s `index.ts` (and optionally from the root
   `index.ts` for convenience).
6. Wire the new definition where needed:
   - `tools/builtin.ts` and similar modules obtain metadata automatically when
     you import the definition.
   - Update agent spawning (`agent.ts`) or routes to point at
     `server/mcp/builtin/<provider>/server`.

Following this pattern keeps every provider consistent and makes it easy to spot
missing pieces during review.
