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
import { cn, formatCurrency } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  purchase_price: number;
  price: number;
  gst_rate: number;
  stock: number;
  min_stock: number;
  business_id: string;
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

  const businessId = profile?.business_id;

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
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
  }, [businessId]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setProducts(data);
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
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productToDelete);
      
      if (error) {
        if (error.code === '23503' || error.message.includes('foreign key constraint')) {
          throw new Error('Cannot delete this product because it has associated invoice items or records. Please delete those first or mark the product as inactive.');
        }
        throw error;
      }
      fetchProducts();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(error.message || 'Failed to delete product.');
    } finally {
      setProductToDelete(null);
    }
  };

  const openModal = (product: Product | null = null) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
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
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const lowStockCount = products.filter(p => p.stock <= p.min_stock && p.stock > 0).length;
  const outOfStockCount = products.filter(p => p.stock === 0).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory Management</h1>
          <p className="text-slate-500">Track stock levels, movements, and low stock alerts.</p>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setShowStockHistory(true)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center"
          >
            <ArrowUpDown size={18} className="mr-2" />
            Stock History
          </button>
          <button className="btn-primary flex items-center" onClick={() => openModal()}>
            <Plus size={18} className="mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 border-l-4 border-blue-500">
          <p className="text-sm font-medium text-slate-500">Total Items</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{products.length}</h3>
          <div className="flex items-center text-xs text-emerald-600 font-bold mt-2">
            <ArrowUpRight size={14} className="mr-1" />
            Active products
          </div>
        </div>
        <div className="glass-card p-6 border-l-4 border-orange-500">
          <p className="text-sm font-medium text-slate-500">Low Stock Alerts</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{lowStockCount} Items</h3>
          <div className="flex items-center text-xs text-orange-600 font-bold mt-2">
            <AlertTriangle size={14} className="mr-1" />
            Action required
          </div>
        </div>
        <div className="glass-card p-6 border-l-4 border-red-500">
          <p className="text-sm font-medium text-slate-500">Out of Stock</p>
          <h3 className="text-2xl font-bold text-slate-900 mt-1">{outOfStockCount} Items</h3>
          <div className="flex items-center text-xs text-red-600 font-bold mt-2">
            <ArrowDownRight size={14} className="mr-1" />
            Loss of revenue
          </div>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by SKU or Product Name..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-3">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-all">
              <Filter size={20} />
            </button>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <p className="text-sm text-slate-500">Showing {filteredProducts.length} of {products.length} products</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 text-xs font-bold uppercase tracking-wider">
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Stock Level</th>
                <th className="px-6 py-4">Selling Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-sm">Loading products...</p>
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Package className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium">No products found</p>
                    <button onClick={() => openModal()} className="text-primary text-sm font-bold mt-2 hover:underline">Add your first product</button>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-400 mr-3">
                          <Package size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{product.category}</td>
                    <td className="px-6 py-4">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-medium">
                          <span className={cn(
                            product.stock <= product.min_stock ? "text-orange-600" : "text-slate-600"
                          )}>
                            {product.stock} units
                          </span>
                          <span className="text-slate-400">Min: {product.min_stock}</span>
                        </div>
                        <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{formatCurrency(product.price)}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        product.stock > product.min_stock ? "bg-emerald-100 text-emerald-700" : 
                        product.stock > 0 ? "bg-orange-100 text-orange-700" : "bg-red-100 text-red-700"
                      )}>
                        {product.stock > product.min_stock ? 'In Stock' : 
                         product.stock > 0 ? 'Low Stock' : 'Out of Stock'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => openModal(product)}
                          className="p-1.5 text-slate-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                        >
                          <Edit size={16} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(product.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Product Name</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">SKU / Item Code</label>
                  <input 
                    required
                    type="text" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.sku}
                    onChange={e => setFormData({...formData, sku: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Category</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">GST Rate (%)</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
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
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Purchase Price</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.purchase_price}
                    onChange={e => setFormData({...formData, purchase_price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Selling Price</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.price}
                    onChange={e => setFormData({...formData, price: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Initial Stock</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.stock}
                    onChange={e => setFormData({...formData, stock: Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">Min Stock Level</label>
                  <input 
                    required
                    type="number" 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-primary outline-none text-sm transition-all"
                    value={formData.min_stock}
                    onChange={e => setFormData({...formData, min_stock: Number(e.target.value)})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-100">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="px-6 py-2 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-all flex items-center disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
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
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center">
                <ArrowUpDown className="mr-2 text-primary" />
                Recent Stock Movements
              </h2>
              <button onClick={() => setShowStockHistory(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                {products.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No stock history available.</p>
                ) : (
                  // Mocking stock history based on current products for demonstration
                  products.slice(0, 10).map((product, index) => (
                    <div key={index} className="flex items-center justify-between p-4 border border-slate-100 rounded-xl hover:border-primary/30 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center",
                          index % 2 === 0 ? "bg-emerald-100 text-emerald-600" : "bg-orange-100 text-orange-600"
                        )}>
                          {index % 2 === 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{product.name}</p>
                          <p className="text-xs text-slate-500">
                            {index % 2 === 0 ? 'Stock Added (Purchase)' : 'Stock Removed (Sale)'} • {new Date(Date.now() - index * 86400000).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={cn(
                          "font-bold",
                          index % 2 === 0 ? "text-emerald-600" : "text-orange-600"
                        )}>
                          {index % 2 === 0 ? '+' : '-'}{Math.floor(Math.random() * 50) + 1} units
                        </p>
                        <p className="text-xs text-slate-500">Current: {product.stock}</p>
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
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setProductToDelete(null);
        }}
      />
    </div>
  );
}
