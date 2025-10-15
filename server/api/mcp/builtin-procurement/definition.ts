import type { BuiltinMcpDefinition } from '../../shared'
import type { ProcurementMcpContext } from './context'
import { createPurchaseOrder, listPurchaseOrders, createVendor, listVendors } from './operations'

export const procurementDefinition: BuiltinMcpDefinition<ProcurementMcpContext> = {
  id: 'builtin-procurement',
  serverName: 'builtin-procurement-server',
  logPrefix: '[BuiltinProcurementMCP]',
  context: {
    spec: {
      teamIdEnv: 'PROCUREMENT_TEAM_ID',
      userIdEnv: 'PROCUREMENT_USER_ID',
      agentIdEnv: 'PROCUREMENT_AGENT_ID'
    },
    resolve: (env) => ({
      teamId: env.PROCUREMENT_TEAM_ID as string,
      userId: env.PROCUREMENT_USER_ID as string,
      agentId: env.PROCUREMENT_AGENT_ID || undefined
    })
  },
  tools: [
    {
      name: 'create_purchase_order',
      description: 'Create a new purchase order',
      inputSchema: {
        type: 'object',
        properties: {
          vendor: { type: 'string', description: 'Vendor name' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                unitPrice: { type: 'number' }
              },
              required: ['description', 'quantity', 'unitPrice']
            }
          },
          totalAmount: { type: 'number', description: 'Total amount' },
          requestedBy: { type: 'string', description: 'Person requesting the order' },
          department: { type: 'string', description: 'Department' },
          notes: { type: 'string', description: 'Optional notes' }
        },
        required: ['vendor', 'items', 'totalAmount', 'requestedBy', 'department'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const purchaseOrder = await createPurchaseOrder(context, args as any)
        return {
          success: true,
          data: purchaseOrder,
          summary: `Created purchase order ${purchaseOrder.poNumber} for ${purchaseOrder.vendor}`
        }
      }
    },
    {
      name: 'list_purchase_orders',
      description: 'List purchase orders, optionally filtered by status',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['pending', 'approved', 'rejected', 'ordered', 'received', 'cancelled'],
            description: 'Optional status filter'
          }
        },
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const { status } = args as { status?: string }
        const purchaseOrders = await listPurchaseOrders(context, { status })
        return {
          success: true,
          data: purchaseOrders,
          summary: `Found ${purchaseOrders.length} purchase orders`
        }
      }
    },
    {
      name: 'create_vendor',
      description: 'Create a new vendor record',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Vendor name' },
          contactInfo: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              phone: { type: 'string' },
              address: { type: 'string' }
            },
            required: ['email', 'phone']
          },
          category: { type: 'string', description: 'Vendor category' },
          rating: { type: 'number', minimum: 1, maximum: 5, description: 'Vendor rating (1-5)' },
          notes: { type: 'string', description: 'Optional notes about the vendor' }
        },
        required: ['name', 'contactInfo', 'category', 'rating'],
        additionalProperties: false
      },
      execute: async ({ context, args }) => {
        const vendor = await createVendor(context, args as any)
        return { success: true, data: vendor, summary: `Created vendor: ${vendor.name}` }
      }
    },
    {
      name: 'list_vendors',
      description: 'List all vendors',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async ({ context }) => {
        const vendors = await listVendors(context)
        return { success: true, data: vendors, summary: `Found ${vendors.length} vendors` }
      }
    }
  ]
}
