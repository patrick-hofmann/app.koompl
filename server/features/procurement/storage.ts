import { createStorage } from '../../utils/storage'

export interface PurchaseOrder {
  id: string
  poNumber: string
  vendor: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
    total: number
  }>
  totalAmount: number
  status: 'pending' | 'approved' | 'rejected' | 'ordered' | 'received' | 'cancelled'
  requestedBy: string
  department: string
  approvedBy?: string
  approvedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface Vendor {
  id: string
  name: string
  contactInfo: {
    email: string
    phone: string
    address?: string
  }
  category: string
  rating: number
  notes?: string
  createdAt: string
  updatedAt: string
  teamId: string
}

export interface ProcurementData {
  purchaseOrders: PurchaseOrder[]
  vendors: Vendor[]
}

const defaultProcurementData: ProcurementData = {
  purchaseOrders: [],
  vendors: []
}

export function createProcurementStorage(teamId: string) {
  return createStorage<ProcurementData>('procurement', teamId, defaultProcurementData)
}

export async function createPurchaseOrder(
  teamId: string,
  poData: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<PurchaseOrder> {
  const storage = createProcurementStorage(teamId)
  const data = await storage.read()

  // Generate PO number
  const poCount = data.purchaseOrders.length
  const poNumber = `PO-2024-${String(poCount + 1).padStart(4, '0')}`

  const purchaseOrder: PurchaseOrder = {
    id: `po_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    poNumber,
    ...poData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.purchaseOrders.push(purchaseOrder)
  await storage.write(data)

  return purchaseOrder
}

export async function listPurchaseOrders(
  teamId: string,
  status?: PurchaseOrder['status']
): Promise<PurchaseOrder[]> {
  const storage = createProcurementStorage(teamId)
  const data = await storage.read()

  if (status) {
    return data.purchaseOrders.filter((po) => po.status === status)
  }

  return data.purchaseOrders
}

export async function createVendor(
  teamId: string,
  vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt' | 'teamId'>
): Promise<Vendor> {
  const storage = createProcurementStorage(teamId)
  const data = await storage.read()

  const vendor: Vendor = {
    id: `vendor_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...vendorData,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    teamId
  }

  data.vendors.push(vendor)
  await storage.write(data)

  return vendor
}

export async function listVendors(teamId: string): Promise<Vendor[]> {
  const storage = createProcurementStorage(teamId)
  const data = await storage.read()
  return data.vendors
}
