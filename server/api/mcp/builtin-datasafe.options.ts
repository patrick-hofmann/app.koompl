export default defineEventHandler((event) => {
  setResponseHeader(event, 'Access-Control-Allow-Origin', '*')
  setResponseHeader(event, 'Access-Control-Allow-Methods', 'POST, OPTIONS, GET')
  setResponseHeader(event, 'Access-Control-Allow-Headers', '*')
  setResponseStatus(event, 204)
  return null
})
