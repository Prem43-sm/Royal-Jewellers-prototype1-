export interface User {
  id: number;
  name: string;
  email: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  phone?: string;
  status?: string;
}

export interface Product {
  id: number;
  itemCode: string;
  barcode?: string;
  name: string;
  categoryId?: number | null;
  category?: { id: number; name: string } | null;
  metal: string;
  purity: number;
  fineness: number;
  grossWeight: number;
  stoneWeight: number;
  otherMaterialWeight: number;
  netWeight: number;
  fineGoldWeight: number;
  stoneType?: string | null;
  hallmark: boolean;
  huid?: string | null;
  purchaseCost?: number | null;
  sellingPrice?: number | null;
  makingCharge: number;
  wastage: number;
  wastagePercent: number;
  stoneCharge: number;
  otherCharge: number;
  discount: number;
  taxRate: number;
  supplierId?: number | null;
  supplier?: { id: number; name: string } | null;
  purchaseDate?: string | null;
  status: string;
  image?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface Customer {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  notes?: string;
  totalBalance?: number;
}

export interface Supplier {
  id: number;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  gstNumber?: string;
  bankName?: string;
  bankAccount?: string;
  ifsc?: string;
  notes?: string;
  totalBalance?: number;
}

export interface Sale {
  id: number;
  invoiceNumber: string;
  customerId?: number | null;
  customer?: { id: number; name: string; phone?: string } | null;
  totalAmount: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  status: string;
  profit: number;
  notes?: string | null;
  createdAt: string;
  items?: SaleItem[];
  payments?: SalePayment[];
  user?: { name: string };
}

export interface SaleItem {
  id: number;
  saleId: number;
  productId?: number | null;
  product?: { itemCode?: string; huid?: string; barcode?: string };
  name: string;
  metal: string;
  purity: number;
  grossWeight: number;
  netWeight: number;
  rate: number;
  metalValue: number;
  makingCharge: number;
  wastage: number;
  stoneCharge: number;
  otherCharge: number;
  discount: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  costPrice: number;
  quantity: number;
}

export interface SalePayment {
  id: number;
  saleId: number;
  amount: number;
  method: string;
  receivedBy?: number;
  user?: { name: string };
  createdAt: string;
}

export interface Purchase {
  id: number;
  purchaseNumber: string;
  supplierId: number;
  supplier?: { id: number; name: string; phone?: string };
  totalCost: number;
  paidAmount: number;
  balanceAmount: number;
  paymentMethod: string;
  status: string;
  notes?: string | null;
  createdAt: string;
  items?: PurchaseItem[];
  user?: { name: string };
}

export interface PurchaseItem {
  id: number;
  purchaseId: number;
  productId?: number | null;
  product?: { itemCode?: string; status?: string };
  name: string;
  metal: string;
  purity: number;
  grossWeight: number;
  netWeight: number;
  rate: number;
  cost: number;
  quantity: number;
}

export interface MetalRate {
  id: number;
  metal: string;
  purity: number;
  buyRate: number;
  sellRate: number;
  date: string;
  createdAt: string;
}

export interface OldGoldExchange {
  id: number;
  customerId?: number | null;
  customer?: { id: number; name: string; phone?: string } | null;
  metal: string;
  grossWeight: number;
  stoneWeight: number;
  otherMaterialWeight: number;
  netWeight: number;
  testedPurity: number;
  fineness: number;
  testingMethod?: string;
  testingNotes?: string;
  fineGoldWeight: number;
  rate: number;
  grossValue: number;
  deductions: number;
  finalValue: number;
  notes?: string | null;
  createdAt: string;
}

export interface Order {
  id: number;
  orderNumber: string;
  customerId?: number | null;
  customer?: { id: number; name: string; phone?: string } | null;
  jewelleryType?: string;
  metal: string;
  purity: number;
  estimatedWeight: number;
  estimatedPrice: number;
  makingCharge: number;
  stoneCharge: number;
  otherCharge: number;
  totalPrice: number;
  advance: number;
  balance: number;
  designRef?: string;
  notes?: string | null;
  status: string;
  orderDate: string;
  expectedDate?: string | null;
  deliveredDate?: string | null;
}

export interface JobWork {
  id: number;
  jobNumber: string;
  artisanId: number;
  artisan?: { id: number; name: string; phone?: string };
  jobDate: string;
  expectedDate?: string | null;
  status: string;
  labourCharge: number;
  notes?: string | null;
  items?: JobWorkItem[];
}

export interface JobWorkItem {
  id: number;
  jobWorkId: number;
  productId?: number | null;
  product?: { id: number; itemCode: string; name: string; huid?: string };
  metal: string;
  purity: number;
  issuedWeight: number;
  returnedWeight: number;
  finished: boolean;
}

export interface Repair {
  id: number;
  repairNumber: string;
  customerId?: number | null;
  customer?: { id: number; name: string; phone?: string };
  productId?: number | null;
  product?: { id: number; itemCode: string; name: string };
  problem: string;
  receivedDate: string;
  estimatedCost: number;
  advancePaid: number;
  artisanId?: number | null;
  expectedDelivery?: string | null;
  actualDelivery?: string | null;
  status: string;
  notes?: string | null;
}

export interface Expense {
  id: number;
  date: string;
  category: string;
  description: string;
  amount: number;
  paymentMethod: string;
  notes?: string | null;
  createdAt: string;
  user?: { name: string };
}

export interface Document {
  id: number;
  name: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  category: string;
  description?: string | null;
  relatedId?: number | null;
  createdAt: string;
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  user?: { name: string; email: string };
  action: string;
  entity: string;
  recordId?: number | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}

export interface Backup {
  id: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  notes?: string | null;
  createdAt: string;
}

export interface DashboardData {
  todaySales: number;
  todaySalesCount: number;
  todayPurchases: number;
  todayPurchasesWeight: number;
  todayExpenses: number;
  todayProfit: number | null;
  customerOutstanding: number;
  supplierOutstanding: number;
  goldStock: number;
  silverStock: number;
  todayRates: MetalRate[];
  pendingOrders: number;
  pendingJobWork: number;
  pendingRepairs: number;
  recentSales: Sale[];
  lowStock: any[];
  customerDues: any[];
  supplierDues: any[];
  salesTrend: { date: string; total: number; count: number }[];
  categorySales: any[];
  canSeeFinancial: boolean;
}

export const PRODUCT_STATUSES = ['IN_STOCK', 'SOLD', 'RESERVED', 'CUSTOM_ORDER', 'REPAIR', 'JOB_WORK', 'RETURNED', 'DAMAGED'];
export const METALS = ['GOLD', 'SILVER', 'DIAMOND', 'PLATINUM', 'OTHER'];
export const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'BANK', 'CREDIT', 'OTHER'];
export const ORDER_STATUSES = ['QUOTATION', 'ADVANCE_RECEIVED', 'DESIGN_APPROVED', 'MANUFACTURING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
export const JOB_STATUSES = ['ISSUED', 'PARTIAL_RETURN', 'COMPLETED', 'CANCELLED'];
export const REPAIR_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED'];
export const EXPENSE_CATEGORIES = ['RENT', 'ELECTRICITY', 'SALARY', 'TRANSPORT', 'PACKAGING', 'MAINTENANCE', 'REPAIR', 'ADVERTISEMENT', 'OFFICE', 'MISCELLANEOUS'];
export const DOC_CATEGORIES = ['GST', 'BUSINESS', 'SUPPLIER', 'PURCHASE_BILL', 'HALLMARK', 'INSURANCE', 'AGREEMENT', 'CUSTOMER', 'OTHER'];

export const formatMoney = (n: number): string => {
  if (n === null || n === undefined) return '₹0';
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
};

export const formatWeight = (n: number): string => {
  if (n === null || n === undefined) return '0g';
  return `${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 3 })}g`;
};

export const formatDate = (d: string | Date): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const formatDateTime = (d: string | Date): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return `${formatDate(date)} ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
};

export const statusColor = (status: string): string => {
  const map: Record<string, string> = {
    IN_STOCK: 'bg-green-100 text-green-700',
    SOLD: 'bg-blue-100 text-blue-700',
    RESERVED: 'bg-amber-100 text-amber-700',
    CUSTOM_ORDER: 'bg-purple-100 text-purple-700',
    REPAIR: 'bg-orange-100 text-orange-700',
    JOB_WORK: 'bg-indigo-100 text-indigo-700',
    RETURNED: 'bg-teal-100 text-teal-700',
    DAMAGED: 'bg-red-100 text-red-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700',
    PARTIAL: 'bg-amber-100 text-amber-700',
    QUOTATION: 'bg-gray-100 text-gray-700',
    ADVANCE_RECEIVED: 'bg-blue-100 text-blue-700',
    DESIGN_APPROVED: 'bg-indigo-100 text-indigo-700',
    MANUFACTURING: 'bg-purple-100 text-purple-700',
    READY: 'bg-amber-100 text-amber-700',
    DELIVERED: 'bg-green-100 text-green-700',
    ISSUED: 'bg-blue-100 text-blue-700',
    RECEIVED: 'bg-gray-100 text-gray-700',
    IN_PROGRESS: 'bg-indigo-100 text-indigo-700',
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-red-100 text-red-700',
  };
  return map[status] || 'bg-gray-100 text-gray-700';
};