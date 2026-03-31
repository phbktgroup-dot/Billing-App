import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, Download, Trash2, Edit2, Loader2, AlertCircle, Receipt, Calendar, Tag, DollarSign, MoreVertical } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, getDateRange, FilterType, cn } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { ConfirmModal } from '../components/ConfirmModal';
import Drawer from '../components/Drawer';
import { motion, AnimatePresence } from 'motion/react';

const CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Marketing',
  'Office Supplies',
  'Travel',
  'Insurance',
  'Taxes',
  'Maintenance',
  'Other'
];

export default function Expenses() {
  const { profile } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const [formData, setFormData] = useState({
    category: 'Other',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [selectedExpenses, setSelectedExpenses] = useState<string[]>([]);

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchExpenses();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err: any) {
      console.error('Error fetching expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        business_id: businessId,
        created_by: profile.id,
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        date: formData.date
      };

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(payload)
          .eq('id', editingExpense.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert([payload]);
        if (error) throw error;
      }

      setShowAddModal(false);
      setEditingExpense(null);
      setFormData({
        category: 'Other',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
      });
      fetchExpenses();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setExpenseToDelete(id);
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
          .from('expenses')
          .delete()
          .in('id', selectedExpenses);
        
        if (error) throw error;
        setSelectedExpenses([]);
      } else {
        if (!expenseToDelete) return;
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', expenseToDelete);
        if (error) throw error;
      }
      fetchExpenses();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setExpenseToDelete(null);
      setIsBulkDelete(false);
      setDeleteModalOpen(false);
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount.toString(),
      description: expense.description || '',
      date: expense.date
    });
    setShowAddModal(true);
  };

  const filteredExpenses = expenses.filter(exp => 
    exp.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exp.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalExpenses = filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

  const toggleSelectAll = () => {
    if (selectedExpenses.length === filteredExpenses.length) {
      setSelectedExpenses([]);
    } else {
      setSelectedExpenses(filteredExpenses.map(e => e.id));
    }
  };

  const toggleSelectExpense = (id: string) => {
    setSelectedExpenses(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 pt-2 relative"
    >
      <PageHeader 
        title="Business Expenses" 
        description="Record and categorize your business spending to track profitability and tax deductions."
      >
        <div className="flex items-center space-x-2">
          
          <button 
            onClick={() => {
              setEditingExpense(null);
              setFormData({
                category: 'Other',
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0]
              });
              setShowAddModal(true);
            }}
            className="btn-primary h-10 sm:h-9"
          >
            <Plus size={14} className="mr-1.5" />
            Add Expense
          </button>
        </div>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-50/30 p-4 border border-blue-200 border-l-[6px] border-l-red-600 rounded-[32px] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-blue-100 flex items-center justify-center text-red-600">
              <DollarSign size={16} />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Total Expenses</p>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="bg-slate-50/30 p-4 border border-blue-200 border-l-[6px] border-l-blue-600 rounded-[32px] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-blue-100 flex items-center justify-center text-blue-600">
              <Receipt size={16} />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Expense Count</p>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">{filteredExpenses.length}</h3>
        </div>
        <div className="bg-slate-50/30 p-4 border border-blue-200 border-l-[6px] border-l-emerald-600 rounded-[32px] shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-white shadow-sm border border-blue-100 flex items-center justify-center text-emerald-600">
              <Calendar size={16} />
            </div>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">This Month</p>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">
            {formatCurrency(expenses.filter(e => e.date.startsWith(new Date().toISOString().slice(0, 7))).reduce((s, e) => s + e.amount, 0))}
          </h3>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search expenses by category or description..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-primary shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {selectedExpenses.length > 0 && (
            <button 
              onClick={confirmBulkDelete}
              className="bg-red-600 text-white px-3 h-10 sm:h-9 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-red-700 transition-all shrink-0 shadow-sm"
            >
              <Trash2 size={14} />
              Bulk Delete ({selectedExpenses.length})
            </button>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <button className="px-3 h-10 sm:h-9 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm">
            <Filter size={14} className="mr-1.5" />
            Filter
          </button>
          <button className="px-3 h-10 sm:h-9 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm">
            <Download size={14} className="mr-1.5" />
            Export
          </button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-bottom border-slate-100 text-slate-500 text-[8px] font-bold uppercase tracking-wider">
                <th className="px-2.5 py-1.5 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                    checked={filteredExpenses.length > 0 && selectedExpenses.length === filteredExpenses.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2.5 py-1.5">Date</th>
                <th className="px-2.5 py-1.5">Category</th>
                <th className="px-2.5 py-1.5">Description</th>
                <th className="px-2.5 py-1.5 text-right">Amount</th>
                <th className="px-2.5 py-1.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-xs">Loading expenses...</p>
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Receipt className="text-slate-300" size={24} />
                    </div>
                    <p className="text-slate-900 font-bold text-sm">No expenses found</p>
                    <p className="text-slate-500 text-xs mt-1">Start tracking your business spending.</p>
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr 
                    key={expense.id} 
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors group",
                      selectedExpenses.includes(expense.id) && "bg-primary/5"
                    )}
                  >
                    <td className="px-2.5 py-1.5">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-primary focus:ring-primary cursor-pointer"
                        checked={selectedExpenses.includes(expense.id)}
                        onChange={() => toggleSelectExpense(expense.id)}
                      />
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center space-x-2">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-600 font-medium">{new Date(expense.date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <div className="flex items-center space-x-2">
                        <Tag size={12} className="text-slate-400" />
                        <span className="text-[10px] font-bold text-slate-900">{expense.category}</span>
                      </div>
                    </td>
                    <td className="px-2.5 py-1.5">
                      <span className="text-[10px] text-slate-500 line-clamp-1">{expense.description || '-'}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <span className="text-[10px] font-bold text-red-600">{formatCurrency(expense.amount)}</span>
                    </td>
                    <td className="px-2.5 py-1.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => handleEdit(expense)}
                          className="p-1 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => confirmDelete(expense.id)}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                        <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all h-10 sm:h-9 w-10 flex items-center justify-center">
                          <MoreVertical size={12} />
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
      <Drawer
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingExpense ? 'Edit Expense' : 'Add New Expense'}
        icon={<Receipt size={18} />}
        maxWidth="max-w-none"
        footer={
          <button 
            type="submit" 
            form="expense-form"
            disabled={isSubmitting}
            className="w-full h-10 sm:h-9 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center transition-all hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin mr-2" size={16} />
            ) : editingExpense ? 'Update Expense' : 'Save Expense'}
          </button>
        }
      >
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start space-x-2 text-red-600 text-xs">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          <form id="expense-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Date</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Category</label>
                <select 
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                >
                  <option value="">Select Category</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]">₹</span>
                  <input 
                    type="number" 
                    step="0.01"
                    required
                    className="w-full pl-7 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">Description</label>
              <textarea 
                rows={3}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-primary outline-none text-[10px] transition-all resize-none"
                placeholder="What was this expense for?"
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
          </form>
        </div>
      </Drawer>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={isBulkDelete ? "Bulk Delete Expenses" : "Delete Expense"}
        message={isBulkDelete 
          ? `Are you sure you want to delete ${selectedExpenses.length} selected expenses? This action cannot be undone.`
          : "Are you sure you want to delete this expense? This action cannot be undone."}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setExpenseToDelete(null);
          setIsBulkDelete(false);
        }}
      />
    </div>
  );
}
