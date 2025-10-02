export default defineEventHandler(async () => {
  return {
    ok: true,
    message: 'Builtin Calendar MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
  }
})
