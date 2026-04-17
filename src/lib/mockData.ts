export type ProductCategory = 'barna' | 'front'

export interface MockProduct {
  id: string
  name: string
  supplier: string
  category: ProductCategory
  genericName?: string
  aliases?: string[]
  unitPrice?: number
  leadTimeDays?: number
  minOrderQty?: number
  offerPriority?: number
  isActiveOffer?: boolean
  minStock?: number
  reorderPoint?: number
  currentStock?: number
}

export type MockStockMovementType =
  | 'INITIAL_COUNT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'MANUAL_CORRECTION'

export interface MockStockMovement {
  id: string
  productId: string
  quantityDelta: number
  movementType: MockStockMovementType
  note: string
  createdAt: string
}

export interface MissingItem {
  id: string
  product: MockProduct
  urgent: boolean
  note: string
  addedCount: number
  suggestedQty: number
}

export interface OwnerOrder {
  id: number
  supplier: string
  items: string[]
}

const STORAGE_KEY = 'smartmanage_mock_shortages'
const PRODUCTS_STORAGE_KEY = 'smartmanage_mock_products'
const STOCK_MOVEMENTS_STORAGE_KEY = 'smartmanage_mock_stock_movements'

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: '1',
    name: 'AUGMENTIN 1g TAB 14',
    supplier: 'DONIKA',
    category: 'barna',
    genericName: 'Amoxicillin clavulanic acid',
    aliases: ['augmentin', 'amoksiklav'],
    unitPrice: 5.4,
    leadTimeDays: 1,
    minOrderQty: 1,
    offerPriority: 28,
    isActiveOffer: true,
    minStock: 6,
    reorderPoint: 8,
  },
  {
    id: '2',
    name: 'AUGMENTIN 1g TAB 14',
    supplier: 'ABCOM',
    category: 'barna',
    genericName: 'Amoxicillin clavulanic acid',
    aliases: ['augmentin', 'amoksiklav'],
    unitPrice: 5.1,
    leadTimeDays: 2,
    minOrderQty: 2,
    offerPriority: 34,
    isActiveOffer: true,
    minStock: 3,
    reorderPoint: 5,
  },
  {
    id: '3',
    name: 'BRUFEN 400mg TAB 20',
    supplier: 'ABCOM',
    category: 'barna',
    genericName: 'Ibuprofen',
    aliases: ['brufen', 'ibuprofen'],
    unitPrice: 2.4,
    leadTimeDays: 2,
    minOrderQty: 1,
    offerPriority: 45,
    isActiveOffer: true,
    minStock: 4,
    reorderPoint: 6,
  },
  {
    id: '4',
    name: 'BRUFEN 400mg TAB 20',
    supplier: 'DONIKA',
    category: 'barna',
    genericName: 'Ibuprofen',
    aliases: ['brufen', 'ibuprofen'],
    unitPrice: 2.2,
    leadTimeDays: 1,
    minOrderQty: 1,
    offerPriority: 22,
    isActiveOffer: true,
    minStock: 4,
    reorderPoint: 5,
  },
  {
    id: '5',
    name: 'PARACETAMOL 500mg TAB 10',
    supplier: 'ABCOM',
    category: 'barna',
    genericName: 'Paracetamol',
    aliases: ['paracetamol', 'dafalgan'],
    unitPrice: 1.3,
    leadTimeDays: 2,
    minOrderQty: 1,
    offerPriority: 42,
    isActiveOffer: true,
    minStock: 5,
    reorderPoint: 7,
  },
  {
    id: '6',
    name: 'PARACETAMOL 500mg TAB 10',
    supplier: 'DONIKA',
    category: 'barna',
    genericName: 'Paracetamol',
    aliases: ['paracetamol', 'acetaminophen'],
    unitPrice: 1.15,
    leadTimeDays: 1,
    minOrderQty: 1,
    offerPriority: 18,
    isActiveOffer: true,
    minStock: 5,
    reorderPoint: 6,
  },
  {
    id: '7',
    name: 'VITAMIN C 500mg',
    supplier: 'VITA',
    category: 'front',
    aliases: ['vit c'],
    unitPrice: 3.2,
    leadTimeDays: 3,
    minOrderQty: 1,
    offerPriority: 60,
    isActiveOffer: true,
    minStock: 2,
    reorderPoint: 3,
  },
]

const MOCK_STOCK_MOVEMENTS: MockStockMovement[] = [
  {
    id: 'stock-1',
    productId: '1',
    quantityDelta: 14,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:00:00.000Z',
  },
  {
    id: 'stock-2',
    productId: '2',
    quantityDelta: 3,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:05:00.000Z',
  },
  {
    id: 'stock-3',
    productId: '3',
    quantityDelta: 9,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:10:00.000Z',
  },
  {
    id: 'stock-4',
    productId: '4',
    quantityDelta: 1,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:15:00.000Z',
  },
  {
    id: 'stock-5',
    productId: '6',
    quantityDelta: 11,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:20:00.000Z',
  },
  {
    id: 'stock-6',
    productId: '7',
    quantityDelta: 2,
    movementType: 'INITIAL_COUNT',
    note: 'Stok fillestar',
    createdAt: '2026-04-01T08:25:00.000Z',
  },
]

function normalize(text: string): string {
  return text.toLocaleLowerCase('sq-AL').trim()
}

function readStoredProducts(): MockProduct[] {
  try {
    const raw = localStorage.getItem(PRODUCTS_STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockProduct[]
    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(MOCK_PRODUCTS))
    return [...MOCK_PRODUCTS]
  } catch {
    return [...MOCK_PRODUCTS]
  }
}

function readStoredStockMovements(): MockStockMovement[] {
  try {
    const raw = localStorage.getItem(STOCK_MOVEMENTS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockStockMovement[]
      return parsed.filter((row) => Number(row.quantityDelta ?? 0) !== 0)
    }
    localStorage.setItem(STOCK_MOVEMENTS_STORAGE_KEY, JSON.stringify(MOCK_STOCK_MOVEMENTS))
    return [...MOCK_STOCK_MOVEMENTS]
  } catch {
    return [...MOCK_STOCK_MOVEMENTS]
  }
}

function setStoredProducts(items: MockProduct[]): void {
  localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(items))
}

function setStoredStockMovements(items: MockStockMovement[]): void {
  localStorage.setItem(
    STOCK_MOVEMENTS_STORAGE_KEY,
    JSON.stringify(items.filter((row) => Number(row.quantityDelta ?? 0) !== 0))
  )
}

function getStockByProduct(): Map<string, number> {
  const totals = new Map<string, number>()
  readStoredStockMovements().forEach((row) => {
    if (!row.productId) return
    totals.set(row.productId, (totals.get(row.productId) ?? 0) + Number(row.quantityDelta ?? 0))
  })
  return totals
}

export function getProducts(): MockProduct[] {
  const stockByProduct = getStockByProduct()
  return readStoredProducts().map((product) => ({
    ...product,
    minStock: Math.max(0, Math.round(Number(product.minStock ?? 0))),
    reorderPoint: Math.max(0, Math.round(Number(product.reorderPoint ?? product.minStock ?? 0))),
    currentStock: stockByProduct.get(product.id) ?? 0,
  }))
}

export function searchProducts(query: string): MockProduct[] {
  const q = normalize(query)
  if (!q) return []
  return getProducts()
    .filter((p) => {
      if (normalize(p.name).includes(q)) return true
      if (p.aliases?.some((a) => normalize(a).includes(q))) return true
      return false
    })
    .slice(0, 8)
}

export function addProduct(input: {
  name: string
  supplier: string
  category: ProductCategory
  aliases?: string[]
  producerName?: string
  lastPaidPrice?: number
  lastPriceDate?: string
  defaultOrderQty?: number
  minStock?: number
  reorderPoint?: number
}): { ok: true; products: MockProduct[] } | { ok: false; message: string } {
  const name = input.name.trim()
  const supplier = input.supplier.trim()
  if (!name) return { ok: false, message: 'Shkruaj emrin e barit.' }
  if (!supplier) return { ok: false, message: 'Shkruaj furnitorin.' }

  const products = readStoredProducts()
  const exists = products.some(
    (p) => normalize(p.name) === normalize(name) && normalize(p.supplier) === normalize(supplier)
  )
  if (exists) return { ok: false, message: 'Ky bar ekziston per kete furnitor.' }

  const next: MockProduct = {
    id: crypto.randomUUID(),
    name,
    supplier,
    category: input.category,
    aliases: input.aliases?.filter(Boolean),
    minStock: Math.max(0, Math.round(Number(input.minStock ?? 0))),
    reorderPoint: Math.max(0, Math.round(Number(input.reorderPoint ?? input.minStock ?? 0))),
  }
  setStoredProducts([next, ...products])
  return { ok: true, products: getProducts() }
}

export function updateProduct(
  id: string,
  input: {
    name: string
    supplier: string
    category: ProductCategory
    aliases?: string[]
    minStock?: number
    reorderPoint?: number
  }
): { ok: true; products: MockProduct[] } | { ok: false; message: string } {
  const name = input.name.trim()
  const supplier = input.supplier.trim()
  if (!name) return { ok: false, message: 'Shkruaj emrin e barit.' }
  if (!supplier) return { ok: false, message: 'Shkruaj furnitorin.' }

  const products = readStoredProducts()
  const idx = products.findIndex((p) => p.id === id)
  if (idx === -1) return { ok: false, message: 'Produkti nuk u gjet.' }

  const duplicate = products.some(
    (p) =>
      p.id !== id &&
      normalize(p.name) === normalize(name) &&
      normalize(p.supplier) === normalize(supplier)
  )
  if (duplicate) return { ok: false, message: 'Ekziston produkt me kete emer per te njejtin furnitor.' }

  const next: MockProduct = {
    ...products[idx],
    name,
    supplier,
    category: input.category,
    aliases: input.aliases?.filter(Boolean) ?? [],
    minStock: Math.max(0, Math.round(Number(input.minStock ?? products[idx].minStock ?? 0))),
    reorderPoint: Math.max(
      0,
      Math.round(Number(input.reorderPoint ?? input.minStock ?? products[idx].reorderPoint ?? products[idx].minStock ?? 0))
    ),
  }
  const updated = [...products]
  updated[idx] = next
  setStoredProducts(updated)

  const shortages = getShortages()
  let shortageTouched = false
  shortages.forEach((row) => {
    if (row.product.id !== id) return
    row.product = { ...row.product, ...next, currentStock: row.product.currentStock }
    shortageTouched = true
  })
  if (shortageTouched) setShortages(shortages)

  return { ok: true, products: getProducts() }
}

export function deleteProduct(id: string): { ok: true; products: MockProduct[] } | { ok: false; message: string } {
  const products = readStoredProducts()
  const exists = products.some((p) => p.id === id)
  if (!exists) return { ok: false, message: 'Produkti nuk u gjet.' }

  setStoredProducts(products.filter((p) => p.id !== id))
  setStoredStockMovements(readStoredStockMovements().filter((row) => row.productId !== id))

  const shortages = getShortages().filter((row) => row.product.id !== id)
  setShortages(shortages)

  return { ok: true, products: getProducts() }
}

export function adjustProductStock(
  productId: string,
  quantityDelta: number,
  note = '',
  movementType: MockStockMovementType = 'MANUAL_CORRECTION'
): { ok: true; products: MockProduct[] } | { ok: false; message: string } {
  const id = productId.trim()
  const delta = Math.trunc(Number(quantityDelta))
  if (!id) return { ok: false, message: 'Produkti mungon.' }
  if (!Number.isFinite(delta) || delta === 0) return { ok: false, message: 'Shkruaj nje levizje valide.' }
  const exists = readStoredProducts().some((product) => product.id === id)
  if (!exists) return { ok: false, message: 'Produkti nuk u gjet.' }
  const next = readStoredStockMovements()
  next.push({
    id: crypto.randomUUID(),
    productId: id,
    quantityDelta: delta,
    movementType,
    note: note.trim(),
    createdAt: new Date().toISOString(),
  })
  setStoredStockMovements(next)
  return { ok: true, products: getProducts() }
}

export function getShortages(): MissingItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as MissingItem[]
  } catch {
    return []
  }
}

function setShortages(items: MissingItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function addShortage(productId: string, urgent: boolean, note: string): MissingItem[] {
  const product = getProducts().find((p) => p.id === productId)
  if (!product) return getShortages()

  const items = getShortages()
  const existing = items.find((m) => m.product.id === product.id)
  const incomingNote = note.trim()

  if (existing) {
    existing.addedCount += 1
    existing.urgent = existing.urgent || urgent
    existing.suggestedQty = Math.max(existing.suggestedQty, existing.addedCount)
    if (incomingNote) {
      existing.note = existing.note ? `${existing.note} | ${incomingNote}` : incomingNote
    }
  } else {
    items.push({
      id: crypto.randomUUID(),
      product,
      urgent,
      note: incomingNote,
      addedCount: 1,
      suggestedQty: 1,
    })
  }

  setShortages(items)
  return items
}

export function updateSuggestedQty(id: string, delta: number): MissingItem[] {
  const items = getShortages()
  const row = items.find((i) => i.id === id)
  if (!row) return items
  row.suggestedQty = Math.max(1, row.suggestedQty + delta)
  setShortages(items)
  return items
}

export function updateShortageMeta(
  id: string,
  patch: { urgent?: boolean; note?: string }
): MissingItem[] {
  const items = getShortages()
  const row = items.find((i) => i.id === id)
  if (!row) return items
  if (typeof patch.urgent === 'boolean') row.urgent = patch.urgent
  if (typeof patch.note === 'string') row.note = patch.note.trim()
  setShortages(items)
  return items
}

export function deleteShortage(id: string): MissingItem[] {
  const items = getShortages().filter((i) => i.id !== id)
  setShortages(items)
  return items
}

export function buildOrdersFromShortages(rows: MissingItem[]): OwnerOrder[] {
  const groups = new Map<string, MissingItem[]>()
  rows
    .filter((r) => r.suggestedQty > 0)
    .forEach((r) => {
      const current = groups.get(r.product.supplier) ?? []
      current.push(r)
      groups.set(r.product.supplier, current)
    })

  const sortedSuppliers = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'sq-AL'))
  return sortedSuppliers.map((supplier, idx) => {
    const items = (groups.get(supplier) ?? []).map(
      (r) => `${r.suggestedQty} x ${r.product.name}${r.urgent ? ' (URGJENT)' : ''}`
    )
    return { id: 100 + idx, supplier, items }
  })
}
