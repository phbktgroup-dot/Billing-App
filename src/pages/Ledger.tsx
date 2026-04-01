import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  User,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Printer,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatCurrency, cn, getDateRange, FilterType } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';

interface LedgerEntry {
  id: string;
  date: string;
  particulars: string;
  voucherType: 'Sales' | 'Receipt' | 'Purchase' | 'Payment';
  voucherNo: string;
  debit: number;
  credit: number;
  balance: number;
}

interface Party {
  id: string;
  name: string;
  phone?: string;
  gstin?: string;
  address?: string;
}

export default function Ledger() {
  const { profile } = useAuth();
  const [ledgerType, setLedgerType] = useState<'customer' | 'supplier'>('customer');
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const businessId = profile?.business_id;

  const fetchParties = React.useCallback(async () => {
    if (!businessId) return;
    setParties([]);
    try {
      const isCustomer = ledgerType === 'customer';
      const table = isCustomer ? 'customers' : 'suppliers';
      const gstField = isCustomer ? 'gstin' : 'gst_number';
      
      console.log(`Ledger: Fetching ${ledgerType}s from table: ${table} using field: ${gstField}`);
      
      const { data, error } = await supabase
        .from(table)
        .select(`id, name, phone, ${gstField}, address`)
        .eq('business_id', businessId)
        .order('name');

      if (error) {
        console.error(`Ledger: Error fetching ${ledgerType}s:`, error);
        throw error;
      }
      
      console.log(`Ledger: Fetched ${data?.length || 0} ${ledgerType}s:`, data);
      
      // Map gst_number to gstin for consistent UI usage if needed
      const mappedData = data?.map((item: any) => ({
        ...item,
        gstin: isCustomer ? item.gstin : item.gst_number
      }));
      
      if (mappedData) setParties(mappedData);
    } catch (error) {
      console.error(`Ledger: Error in fetchParties:`, error);
    }
  }, [businessId, ledgerType]);

  useEffect(() => {
    fetchParties();
    setSelectedPartyId('');
  }, [fetchParties]);

  useEffect(() => {
    if (businessId && selectedPartyId) {
      fetchLedger();
    } else {
      setLedgerEntries([]);
    }
  }, [businessId, selectedPartyId, filterType, customRange, day, year]);

  const fetchLedger = async () => {
    if (!selectedPartyId || !businessId) return;
    setLoading(true);
    console.log(`Ledger: Fetching ledger for ${ledgerType}: partyId=${selectedPartyId}, businessId=${businessId}`);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];

      let entries: LedgerEntry[] = [];

      if (ledgerType === 'customer') {
        // Fetch Invoices (Sales)
        const { data: invoices, error: invError } = await supabase
          .from('invoices')
          .select('id, invoice_number, date, total')
          .eq('customer_id', selectedPartyId)
          .gte('date', startStr)
          .lte('date', endStr);

        if (invError) throw invError;

        // Fetch Receipts (Customer Payments)
        const { data: receipts, error: recError } = await supabase
          .from('customer_payments')
          .select('id, reference_number, date, amount, payment_mode, notes')
          .eq('customer_id', selectedPartyId)
          .gte('date', startStr)
          .lte('date', endStr);

        if (recError) throw recError;

        entries = [
          ...(invoices || []).map(inv => ({
            id: inv.id,
            date: inv.date,
            particulars: inv.invoice_number,
            voucherType: 'Sales' as const,
            voucherNo: inv.invoice_number,
            debit: inv.total,
            credit: 0,
            balance: 0
          })),
          ...(receipts || []).map(rec => {
            // Extract bank/UPI info from notes if present
            let displayParticulars = rec.payment_mode;
            if (rec.notes) {
              const bankMatch = rec.notes.match(/Bank: (.*)/);
              const upiMatch = rec.notes.match(/UPI: (.*)/);
              if (bankMatch) displayParticulars = bankMatch[1];
              else if (upiMatch) displayParticulars = upiMatch[1];
            }

            return {
              id: rec.id,
              date: rec.date,
              particulars: displayParticulars,
              voucherType: 'Receipt' as const,
              voucherNo: rec.reference_number || '-',
              debit: 0,
              credit: rec.amount,
              balance: 0
            };
          })
        ];
      } else {
        // Fetch Purchases
        const { data: purchases, error: purError } = await supabase
          .from('purchases')
          .select('id, invoice_number, date, total_amount')
          .eq('supplier_id', selectedPartyId)
          .gte('date', startStr)
          .lte('date', endStr);

        if (purError) throw purError;

        // Fetch Payments (Supplier Payments)
        const { data: payments, error: payError } = await supabase
          .from('supplier_payments')
          .select('id, reference_number, date, amount, payment_mode, notes')
          .eq('supplier_id', selectedPartyId)
          .gte('date', startStr)
          .lte('date', endStr);

        if (payError) throw payError;

        entries = [
          ...(purchases || []).map(pur => ({
            id: pur.id,
            date: pur.date,
            particulars: pur.invoice_number,
            voucherType: 'Purchase' as const,
            voucherNo: pur.invoice_number || '-',
            debit: 0,
            credit: pur.total_amount,
            balance: 0
          })),
          ...(payments || []).map(pay => {
            // Extract bank/UPI info from notes if present
            let displayParticulars = pay.payment_mode;
            if (pay.notes) {
              const bankMatch = pay.notes.match(/Bank: (.*)/);
              const upiMatch = pay.notes.match(/UPI: (.*)/);
              if (bankMatch) displayParticulars = bankMatch[1];
              else if (upiMatch) displayParticulars = upiMatch[1];
            }

            return {
              id: pay.id,
              date: pay.date,
              particulars: displayParticulars,
              voucherType: 'Payment' as const,
              voucherNo: pay.reference_number || '-',
              debit: pay.amount,
              credit: 0,
              balance: 0
            };
          })
        ];
      }

      // Sort by date
      entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate Running Balance
      let currentBalance = 0;
      const entriesWithBalance = entries.map(entry => {
        currentBalance += (entry.debit - entry.credit);
        return { ...entry, balance: currentBalance };
      });

      setLedgerEntries(entriesWithBalance);
    } catch (error: any) {
      console.error('Error fetching ledger:', error);
      alert('Failed to load ledger: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const totalDebit = ledgerEntries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredit = ledgerEntries.reduce((sum, e) => sum + e.credit, 0);
    const closingBalance = totalDebit - totalCredit;
    return { totalDebit, totalCredit, closingBalance };
  }, [ledgerEntries]);

  const handleExportPDF = async () => {
    if (!selectedPartyId || ledgerEntries.length === 0) return;
    setIsExporting(true);
    try {
      const party = parties.find(p => p.id === selectedPartyId);
      const { generateLedgerPDF } = await import('../lib/pdfGenerator');
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);
      
      await generateLedgerPDF({
        partyName: party?.name || '',
        partyGstin: party?.gstin,
        partyAddress: party?.address,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        entries: ledgerEntries,
        totals,
        type: ledgerType === 'customer' ? 'Customer' : 'Supplier'
      }, profile?.business_profiles);
    } catch (error: any) {
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!selectedPartyId || ledgerEntries.length === 0) return;
    setIsExporting(true);
    try {
      const party = parties.find(p => p.id === selectedPartyId);
      const { generateLedgerExcel } = await import('../lib/excelGenerator');
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      await generateLedgerExcel({
        partyName: party?.name || '',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        entries: ledgerEntries,
        totals,
        type: ledgerType === 'customer' ? 'Customer' : 'Supplier'
      }, profile?.business_profiles);
    } catch (error: any) {
      alert('Export failed: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-2 pt-2 relative"
    >
      <PageHeader 
        title={`${ledgerType === 'customer' ? 'Customer' : 'Supplier'} Ledger`} 
        description="View detailed transaction history, track outstanding balances, and reconcile accounts for your business partners."
      >
        <div className="flex items-center space-x-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setLedgerType('customer')}
              className={cn(
                "px-4 h-10 sm:h-9 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center",
                ledgerType === 'customer' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Customer
            </button>
            <button 
              onClick={() => setLedgerType('supplier')}
              className={cn(
                "px-4 h-10 sm:h-9 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all flex items-center justify-center",
                ledgerType === 'supplier' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
              )}
            >
              Supplier
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button 
              onClick={handleExportPDF}
              disabled={loading || isExporting || !selectedPartyId}
              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 h-10 sm:h-9 w-10 flex items-center justify-center"
              title="Export PDF"
            >
              <FileText size={16} />
            </button>
            <button 
              onClick={handleExportExcel}
              disabled={loading || isExporting || !selectedPartyId}
              className="p-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 transition-all disabled:opacity-50 h-10 sm:h-9 w-10 flex items-center justify-center"
              title="Export Excel"
            >
              <Download size={16} />
            </button>
          </div>
        </div>
      </PageHeader>

      {/* Party Selection */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1.5 block">Select {ledgerType === 'customer' ? 'Customer' : 'Supplier'}</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <select 
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all appearance-none"
                value={selectedPartyId}
                onChange={e => setSelectedPartyId(e.target.value)}
              >
                <option value="">Choose a {ledgerType}...</option>
                {parties.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
            </div>
          </div>
          {selectedPartyId && (
            <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Closing Balance</p>
                <p className={cn(
                  "text-sm font-bold",
                  totals.closingBalance >= 0 ? "text-red-600" : "text-emerald-600"
                )}>
                  {formatCurrency(Math.abs(totals.closingBalance))} {totals.closingBalance >= 0 ? 'Dr' : 'Cr'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ledger Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-2 whitespace-nowrap">Date</th>
                <th className="px-4 py-2 whitespace-nowrap">Particulars</th>
                <th className="px-4 py-2 whitespace-nowrap">Voucher Type</th>
                <th className="px-4 py-2 whitespace-nowrap">Voucher No.</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Debit</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Credit</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-500">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-xs">Generating ledger statement...</p>
                  </td>
                </tr>
              ) : !selectedPartyId ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <User className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium text-xs">Please select a {ledgerType} to view their ledger</p>
                  </td>
                </tr>
              ) : ledgerEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <FileText className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium text-xs">No transactions found for this period</p>
                  </td>
                </tr>
              ) : (
                <>
                  {ledgerEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-0.5 text-[11px] text-slate-600">
                        {new Date(entry.date).toLocaleDateString('en-GB')}
                      </td>
                      <td className="px-4 py-0.5 text-[11px] font-medium text-slate-900">
                        <span className="text-slate-400 w-6 inline-block">{entry.debit > 0 ? 'To' : 'By'}</span>
                        {entry.voucherType === 'Sales' ? `Sales A/c` : 
                         entry.voucherType === 'Purchase' ? `Purchase A/c` : 
                         entry.particulars}
                      </td>
                      <td className="px-4 py-0.5">
                        <span className={cn(
                          "px-1 py-0.5 rounded-md text-[9px] font-bold uppercase",
                          (entry.voucherType === 'Sales' || entry.voucherType === 'Payment') ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {entry.voucherType}
                        </span>
                      </td>
                      <td className="px-4 py-0.5 text-[11px] text-slate-500">{entry.voucherNo}</td>
                      <td className="px-4 py-0.5 text-[11px] font-bold text-right text-slate-900">
                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                      </td>
                      <td className="px-4 py-0.5 text-[11px] font-bold text-right text-slate-900">
                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                      </td>
                      <td className="px-4 py-0.5 text-[11px] font-bold text-right text-slate-900">
                        {formatCurrency(Math.abs(entry.balance))} {entry.balance >= 0 ? 'Dr' : 'Cr'}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="bg-slate-50/80 font-bold">
                    <td colSpan={4} className="px-4 py-4 text-xs text-slate-900 text-right uppercase tracking-wider">Total</td>
                    <td className="px-4 py-4 text-xs text-right text-slate-900">{formatCurrency(totals.totalDebit)}</td>
                    <td className="px-4 py-4 text-xs text-right text-slate-900">{formatCurrency(totals.totalCredit)}</td>
                    <td className="px-4 py-4 text-xs text-right text-slate-900">
                      {formatCurrency(Math.abs(totals.closingBalance))} {totals.closingBalance >= 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Footer */}
      <div className="flex justify-between items-start text-[10px] text-slate-400 italic px-2">
        <p>* This is a computer generated statement and does not require a signature.</p>
        <p>Generated on: {new Date().toLocaleString()}</p>
      </div>
      </motion.div>
  );
}
