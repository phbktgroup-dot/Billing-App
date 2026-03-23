export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'manager';
  business_id?: string;
}

export interface BusinessProfile {
  id: string;
  name: string;
  owner_name: string;
  address: string;
  mobile: string;
  email: string;
  gst_number: string;
  pan_number: string;
  logo_url?: string;
  invoice_prefix: string;
  invoice_number_format: string;
  default_notes?: string;
  default_terms?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchase_price: number;
  selling_price: number;
  gst_rate: number;
  stock_quantity: number;
  min_stock_level: number;
  business_id: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gst?: string;
  address?: string;
  business_id: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  date: string;
  due_date: string;
  subtotal: number;
  gst_total: number;
  total_amount: number;
  status: 'paid' | 'unpaid' | 'partial' | 'overdue';
  business_id: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string;
  quantity: number;
  rate: number;
  gst_rate: number;
  discount?: number;
  amount: number;
}
