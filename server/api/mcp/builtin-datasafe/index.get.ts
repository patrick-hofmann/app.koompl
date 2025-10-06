export default defineEventHandler(async () => {
  return {
    ok: true,
    message: 'Builtin Datasafe MCP endpoint. Send JSON-RPC 2.0 requests via POST.'
  }
})
