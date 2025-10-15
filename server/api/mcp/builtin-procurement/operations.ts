import * as procurement from '../../../features/procurement'
import type { ProcurementMcpContext } from './context'

export async function createPurchaseOrder(
  context: ProcurementMcpContext,
  args: Parameters<typeof procurement.createPurchaseOrder>[1]
) {
  return procurement.createPurchaseOrder(context.teamId, args)
}

export async function listPurchaseOrders(
  context: ProcurementMcpContext,
  args: Parameters<typeof procurement.listPurchaseOrders>[1]
) {
  return procurement.listPurchaseOrders(context.teamId, args.status)
}

export async function createVendor(
  context: ProcurementMcpContext,
  args: Parameters<typeof procurement.createVendor>[1]
) {
  return procurement.createVendor(context.teamId, args)
}

export async function listVendors(context: ProcurementMcpContext) {
  return procurement.listVendors(context.teamId)
}
