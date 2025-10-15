// Public API for Procurement feature
export * from './storage'

export interface ProcurementApi {
  // Purchase Order management
  createPurchaseOrder: typeof import('./storage').createPurchaseOrder
  listPurchaseOrders: typeof import('./storage').listPurchaseOrders

  // Vendor management
  createVendor: typeof import('./storage').createVendor
  listVendors: typeof import('./storage').listVendors
}

// Re-export all storage functions for easy access
export { createPurchaseOrder, listPurchaseOrders, createVendor, listVendors } from './storage'
