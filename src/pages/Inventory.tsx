import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  ArrowUpDown, 
  MoreVertical, 
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Edit,
  Trash2,
  X,
  Loader2,
  Save
} from 'lucide-react';
import { cn, formatCurrency, getDateRange, FilterType } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';

interface Product {
  id: string;
  name: string;
  sku: string;
  product_code?: string;
  hsn_code: string;
  category: string;
  purchase_price: number;
  price: number;
  gst_rate: number;
  stock: number;
  min_stock: number;
  business_id: string;
  created_at?: string;
}

export default function Inventory() {
  const { user, profile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showStockHistory, setShowStockHistory] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkFormData, setBulkFormData] = useState({
    stock: 0,
    price: 0,
    category: ''
  });
  const [lowStockAlerts, setLowStockAlerts] = useState<Product[]>([]);

  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    hsn_code: '',
    category: 'Electronics',
    purchase_price: 0,
    price: 0,
    gst_rate: 18,
    stock: 0,
    min_stock: 5
  });

  useEffect(() => {
    if (businessId) {
      fetchProducts();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        setProducts(data);
        setLowStockAlerts(data.filter(p => p.stock <= p.min_stock && p.stock > 0));
      }
    } catch (error: any) {
      console.error('Error fetching products:', error);
      alert('Failed to load products: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) {
      alert("Business ID not found. Please ensure your business setup is complete.");
      return;
    }
    setIsSaving(true);

    const productData = {
      ...formData,
      sku: formData.sku?.trim() || `SKU-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      business_id: businessId,
      created_by: user?.id
    };

    try {
      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([productData]);
        
        if (error) throw error;
      }
      setIsModalOpen(false);
      fetchProducts();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = (id: string) => {
    setProductToDelete(id);
    setIsBulkDelete(false);
    setDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    setIsBulkDelete(true);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (isBulkDelete) {
        const { error } = await supabase
          .from('products')
          .delete()
          .in('id', selectedProducts);
        
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            throw new Error('Some products cannot be deleted because they have associated records. Please delete those records first.');
          }
          throw error;
        }
        setSelectedProducts([]);
      } else {
        if (!productToDelete) return;
        const { error } = await supabase
          .from('products')
          .delete()
          .eq('id', productToDelete);
        
        if (error) {
          if (error.code === '23503' || error.message.includes('foreign key constraint')) {
            // Fetch associated invoices and purchases
            const { data: invItems } = await supabase
              .from('invoice_items')
              .select('invoice_id, invoices(invoice_number)')
              .eq('product_id', productToDelete)
              .limit(5);

            const { data: purItems } = await supabase
              .from('purchase_items')
              .select('purchase_id, purchases(invoice_number)')
              .eq('product_id', productToDelete)
              .limit(5);

            let message = 'Cannot delete this product because it has associated records.';
            
            if (invItems && invItems.length > 0) {
              const numbers = [...new Set(invItems.map((item: any) => item.invoices?.invoice_number).filter(Boolean))].join(', ');
              if (numbers) message += `\n\nAssociated Invoices: ${numbers}${invItems.length >= 5 ? '...' : ''}`;
            }

            if (purItems && purItems.length > 0) {
              const numbers = [...new Set(purItems.map((item: any) => item.purchases?.invoice_number).filter(Boolean))].join(', ');
              if (numbers) message += `\n\nAssociated Purchase Bills: ${numbers}${purItems.length >= 5 ? '...' : ''}`;
            }

            message += '\n\nPlease delete those records first or mark the product as inactive.';
            throw new Error(message);
          }
          throw error;
        }
      }
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(error.message || 'Failed to delete product.');
    } finally {
      setProductToDelete(null);
      setIsBulkDelete(false);
    }
  };

  const openModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        hsn_code: product.hsn_code || '',
        category: product.category,
        purchase_price: product.purchase_price,
        price: product.price,
        gst_rate: product.gst_rate,
        stock: product.stock,
        min_stock: product.min_stock
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        sku: '',
        hsn_code: '',
        category: 'Electronics',
        purchase_price: 0,
        price: 0,
        gst_rate: 18,
        stock: 0,
        min_stock: 5
      });
    }
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const lowStockCount = products.filter(p => p.stock <= p.min_stock && p.stock > 0).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Inventory Management" 
        description="Track stock levels, movements, and low stock alerts."
      >
        <div className="flex items-center space-x-2">
          <DateFilter 
            filterType={filterType}
            setFilterType={setFilterType}
            day={day}
            setDay={setDay}
            year={year}
            setYear={setYear}
            customRange={customRange}
            setCustomRange={setCustomRange}
          />
          <button 
            onClick={() => setShowStockHistory(true)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-medium text-slate-600 hover:bg-slate-50 flex items-center text-[10px]"
          >
            <ArrowUpDown size={14} className="mr-1" />
            Stock History
          </button>
          <button className="btn-primary flex items-center text-[10px] px-2.5 py-1.5 rounded-lg" onClick={() => openModal()}>
            <Plus size={14} className="mr-1" />
            Add Product
          </button>
        </div>
      </PageHeader>

      {lowStockAlerts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-orange-800">
            <AlertTriangle size={16} />
            <p className="text-[10px] font-bold">
              {lowStockAlerts.length} items are running low on stock!
            </p>
          </div>
          <button onClick={() => setLowStockAlerts([])} className="text-orange-600 hover:text-orange-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="glass-card p-2.5 border-l-4 border-blue-500">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Total Items</p>
          <h3 className="text-sm font-bold text-slate-900 mt-0">{products.length}</h3>
          <div className="flex items-center text-[8px] text-emerald-600 font-bold mt-0.5">
            <ArrowUpRight size={8} className="mr-1" />
            Active products
          </div>
        </div>
        <div className="glass-card p-2.5 border-l-4 border-orange-500">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Low Stock Alerts</p>
          <h3 className="text-sm font-bold text-slate-900 mt-0">{lowStockCount} Items</h3>
          <div className="flex items-center text-[8px] text-orange-600 font-bold mt-0.5">
            <AlertTriangle size={8} className="mr-1" />
            Action required
          </div>
        </div>
        <div className="glass-card p-2.5 border-l-4 border-red-500">
          <p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Out of Stock</p>
          <h3 className="text-sm font-bold text-slate-900 mt-0">{outOfStockCount} Items</h3>
          <div className="flex items-center text-[8px] text-red-600 font-bold mt-0.5">
            <ArrowDownRight size={8} className="mr-1" />
            Loss of revenue
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-2.5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
              <input 
                type="text" 
                placeholder="Search by SKU or Product Name..."
                className="w-full pl-7 pr-2.5 py-1 bg-slate-50 border border-transparent rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            {selectedProducts.length > 0 && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsBulkEditModalOpen(true)}
                  className="bg-primary text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-primary/90 transition-all"
                >
                  <Edit size={12} />
                  Bulk Edit ({selectedProducts.length})
                </button>
                <button 
                  onClick={confirmBulkDelete}
                  className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all"
                >
                  <Trash2 size={12} />
                  Bulk Delete
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={12} />
            </button>
            <div className="h-3 w-[1px] bg-slate-200"></div>
            <p className="text-[10px] text-slate-500">Showing {filteredProducts.length} of {products.length} products</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-[8px] font-bold uppercase tracking-wider">
                <th className="px-2.5 py-1.5">
                  <input 
                    type="checkbox" 
                    checked={selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedProducts(filteredProducts.map(p => p.id));
                      } else {
                        setSelectedProducts([]);
                      }
                    }}
                  />
                </th>
                <th className="px-2.5 py-1.5">Product Details</th>
                <th className="px-2.5 py-1.5">Product Code</th>
                <th className="px-2.5 py-1.5">Category</th>
                <th className="px-2.5 py-1.5">Date Added</th>
                <th className="px-2.5 py-1.5">Stock Level</th>
                <th className="px-2.5 py-1.5">Selling Price</th>
                <th className="px-2.5 py-1.5">Status</th>
                <th className="px-2.5 py-1.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-primary mb-1.5" />
                    <p className="text-slate-500 text-[10px]">Loading products...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center">
                    <Package className="w-8 h-8 mx-auto text-slate-200 mb-1.5" />
                    <p className="text-slate-500 font-medium text-[10px]">No products found</p>
                    <button onClick={() => openModal()} className="text-primary text-[10px] font-bold mt-0.5 hover:underline">Add your first product</button>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-2.5 py-1.5">
                      <input 
                        type="checkbox" 
                        checked={selectedProducts.includes(product.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProducts([...selectedProducts, product.id]);
                          } else {
                            setSelectedProducts(selectedProducts.filter(id => id !== product.id));
                          }
                        }}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center">
                        <div className="w-6 h-6 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mr-2">
                          <Package size={12} />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-slate-900">{product.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] text-slate-600 font-medium">{product.sku}</td>
                    <td className="px-2.5 py-1.5 text-[10px] text-slate-600">{product.category}</td>
                    <td className="px-2.5 py-1.5 text-[8px] text-slate-400">
                      {product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="space-y-0.5">
                        <div className="flex justify-between text-[8px] font-medium">
                          <span className={cn(
                            product.stock <= product.min_stock ? "text-orange-600" : "text-slate-600"
                          )}>
                            {product.stock} units
                          </span>
                          <span className="text-slate-400">Min: {product.min_stock}</span>
                        </div>
                        <div className="w-16 h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn(
                              "h-full rounded-full transition-all",
                              product.stock === 0 ? "bg-red-500 w-0" : 
                              product.stock <= product.min_stock ? "bg-orange-500" : "bg-emerald-500"
                            )}
                            style={{ width: `${Math.min((product.stock / (product.min_stock * 2)) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5 text-[10px] font-bold text-slate-900">{formatCurrency(product.price)}</td>
                    <td className="px-2.5 py-1.5">
                      <span className={cn(
                        "px-1 py-0.5 rounded text-[8px] font-bold uppercase",
                        product.stock > product.min_stock ? "bg-emerald-100 text-emerald-700" : 
                        product.stock > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                      )}>
                        {product.stock > product.min_stock ? 'In Stock' : 
                         product.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center space-x-1">
                        <button 
                          onClick={() => openModal(product)}
                          className="p-1 text-slate-400 hover:text-primary hover:bg-primary/5 rounded transition-all"
                        >
                          <Edit size={12} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(product.id)}
                          className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Bulk Edit ({selectedProducts.length} items)</h3>
              <button onClick={() => setIsBulkEditModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            <div className="p-3 space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-700">New Category</label>
                <input 
                  type="text" 
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px]"
                  value={bulkFormData.category}
                  onChange={e => setBulkFormData({...bulkFormData, category: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-700">New Price</label>
                <input 
                  type="number" 
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px]"
                  value={bulkFormData.price}
                  onChange={e => setBulkFormData({...bulkFormData, price: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-slate-700">New Stock</label>
                <input 
                  type="number" 
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px]"
                  value={bulkFormData.stock}
                  onChange={e => setBulkFormData({...bulkFormData, stock: Number(e.target.value)})}
                />
              </div>
            </div>
            <div className="p-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIsBulkEditModalOpen(false)} className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold text-[10px]">Cancel</button>
              <button 
                onClick={async () => {
                  const updates: any = {};
                  if (bulkFormData.category) updates.category = bulkFormData.category;
                  if (bulkFormData.price > 0) updates.price = bulkFormData.price;
                  if (bulkFormData.stock > 0) updates.stock = bulkFormData.stock;
                  
                  const { error } = await supabase
                    .from('products')
                    .update(updates)
                    .in('id', selectedProducts);
                  
                  if (error) alert(error.message);
                  else {
                    fetchProducts();
                    setIsBulkEditModalOpen(false);
                    setSelectedProducts([]);
                  }
                }}
                className="px-3 py-1.5 bg-primary text-white rounded-lg font-bold text-[10px]"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                <X size={16} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-3 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Product Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Product Code</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                    placeholder="e.g. PROD-001"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">HSN Code</label>
                  <input 
                    type="text" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.hsn_code}
                    onChange={e => setFormData({...formData, hsn_code: e.target.value})}
                    placeholder="e.g. 8471"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Category</label>
                  <select 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option>Electronics</option>
                    <option>Furniture</option>
                    <option>Accessories</option>
                    <option>Stationery</option>
                    <option>Services</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">GST Rate (%)</label>
                  <select 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.gst_rate}
                    onChange={e => setFormData({...formData, gst_rate: Number(e.target.value)})}
                  >
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Purchase Price</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.purchase_price}
                    onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Selling Price</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Initial Stock</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-700">Min Stock Level</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    value={formData.min_stock}
                    onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200 transition-all text-[10px]"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50 text-[10px]"
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Save className="w-3 h-3 mr-1.5" />}
                  {editingProduct ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock History Modal */}
      {showStockHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center">
                <ArrowUpDown className="mr-2 text-primary" size={16} />
                Recent Stock Movements
              </h2>
              <button onClick={() => setShowStockHistory(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="p-3 overflow-y-auto flex-1">
              <div className="space-y-2">
                {products.length === 0 ? (
                  <p className="text-center text-slate-500 py-4 text-[10px]">No stock history available.</p>
                ) : (
                  // Mocking stock history based on current products for demonstration
                  products.slice(0, 10).map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border border-slate-100 rounded-lg hover:border-primary/30 transition-colors">
                      <div className="flex items-center space-x-2">
                        <div className={cn(
                          "w-7 h-7 rounded-lg flex items-center justify-center",
                          index % 2 === 0 ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {index % 2 === 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-[10px]">{product.name}</p>
                          <p className="text-[9px] text-slate-500">
                            {index % 2 === 0 ? 'Stock Added' : 'Stock Removed'} • {new Date(Date.now() - index * 86400000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold text-[10px]",
                          index % 2 === 0 ? "text-emerald-600" : "text-orange-600"
                        )}>
                          {index % 2 === 0 ? '+' : '-'}{Math.floor(Math.random() * 50) + 1}
                        </p>
                        <p className="text-[9px] text-slate-500">Stock: {product.stock}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={isBulkDelete ? "Bulk Delete Products" : "Delete Product"}
        message={isBulkDelete 
          ? `Are you sure you want to delete ${selectedProducts.length} selected products? This action cannot be undone.`
          : "Are you sure you want to delete this product? This action cannot be undone."}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
          setIsBulkDelete(false);
        }}
      />
    </div>
  );
}
