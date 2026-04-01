import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  CreditCard, 
  ArrowDownLeft, 
  ArrowUpRight,
  Calendar,
  User,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  X,
  FileText,
  Upload,
  Link as LinkIcon,
  Check,
  AlertCircle,
  ClipboardList,
  Scan,
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Maximize2,
  Minimize2,
  Share2,
  FileSpreadsheet
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { formatCurrency, cn, resizeImage } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import Drawer from '../components/Drawer';
import { ConfirmModal } from '../components/ConfirmModal';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import { getApiUrl } from '../lib/api';

interface Payment {
  id: string;
  amount: number;
  date: string;
  payment_mode: string;
  reference_number?: string;
  notes?: string;
  customer_id?: string;
  supplier_id?: string;
  type: 'receipt' | 'payment';
  customers?: { name: string };
  suppliers?: { name: string };
}

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  matchedIds: string[];
  status: 'unmatched' | 'matched' | 'partial';
  metadata?: Record<string, any>;
  page_number?: number;
  is_transaction?: boolean;
}

interface SystemEntry {
  id: string;
  type: 'invoice' | 'purchase';
  number: string;
  partyName: string;
  partyId: string;
  amount: number;
  date: string;
  status: string;
}

export default function Payments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'receipt' | 'payment'>('all');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [businessProfile, setBusinessProfile] = useState<any>(null);

  // Reconciliation States
  const [isReconcileMode, setIsReconcileMode] = useState(false);
  const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([]);
  const [systemEntries, setSystemEntries] = useState<SystemEntry[]>([]);
  const [selectedSystemEntryIds, setSelectedSystemEntryIds] = useState<string[]>([]);
  const [selectedBankTxId, setSelectedBankTxId] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isPasteMode, setIsPasteMode] = useState(false);
  const [loadingSystemEntries, setLoadingSystemEntries] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [reconcileSearch, setReconcileSearch] = useState('');
  const [bankColumns, setBankColumns] = useState<string[]>([]);
  const [isTableView, setIsTableView] = useState(false);
  const [reconcileTypeFilter, setReconcileTypeFilter] = useState<'all' | 'invoice' | 'purchase'>('all');
  const [bankSearch, setBankSearch] = useState('');

  const [rawFileData, setRawFileData] = useState<string[][]>([]);
  const [accountDetails, setAccountDetails] = useState<string[]>([]);
  const [headerRowIndex, setHeaderRowIndex] = useState<number>(-1);
  const [isMappingMode, setIsMappingMode] = useState(false);
  const [columnMapping, setColumnMapping] = useState<Record<string, number>>({
    date: -1,
    description: -1,
    amount: -1,
    debit: -1,
    credit: -1,
    type: -1
  });
  const [mappingHeaders, setMappingHeaders] = useState<string[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [partyInvoices, setPartyInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [formData, setFormData] = useState({
    type: 'receipt' as 'receipt' | 'payment',
    partyId: '',
    invoiceId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    paymentMode: 'Cash',
    referenceNumber: '',
    bankAccount: '',
    upiId: '',
    notes: ''
  });

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchData();
      fetchParties();
      fetchBusinessProfile();
    }
  }, [businessId]);

  useEffect(() => {
    if (isReconcileMode && businessId) {
      fetchSystemEntries();
    }
  }, [isReconcileMode, businessId]);

  const fetchSystemEntries = async () => {
    if (!businessId) return;
    setLoadingSystemEntries(true);
    try {
      const [invRes, purRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, invoice_number, total, status, created_at, customers(name, id)')
          .eq('business_id', businessId)
          .neq('status', 'paid'),
        supabase
          .from('purchases')
          .select('id, invoice_number, total_amount, status, date, suppliers(name, id)')
          .eq('business_id', businessId)
          .neq('status', 'paid')
      ]);

      const entries: SystemEntry[] = [
        ...(invRes.data || []).map(inv => ({
          id: inv.id,
          type: 'invoice' as const,
          number: inv.invoice_number,
          partyName: (inv.customers as any)?.name || 'Unknown',
          partyId: (inv.customers as any)?.id || '',
          amount: inv.total,
          date: inv.created_at,
          status: inv.status
        })),
        ...(purRes.data || []).map(pur => ({
          id: pur.id,
          type: 'purchase' as const,
          number: pur.invoice_number,
          partyName: (pur.suppliers as any)?.name || 'Unknown',
          partyId: (pur.suppliers as any)?.id || '',
          amount: pur.total_amount,
          date: pur.date,
          status: pur.status
        }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setSystemEntries(entries);
    } catch (error) {
      console.error('Error fetching system entries:', error);
    } finally {
      setLoadingSystemEntries(false);
    }
  };

  const downloadSampleExcel = () => {
    const data = [
      ['Date', 'PARTICULARS', 'Debit', 'Credit'],
      ['01-01-2026', 'Sample Debit Transaction (Purchase Payment)', '1000.00', ''],
      ['02-01-2026', 'Sample Credit Transaction (Sales Receipt)', '', '500.00']
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sample");
    XLSX.writeFile(wb, "bank_statement_sample.xlsx");
    toast.success('Sample Excel downloaded');
  };

  const parseTextToTransactions = (text: string, source: string) => {
    const rows = text.trim().split('\n');
    
    if (source === 'paste') {
      return rows.map((row, idx) => {
        let parts = row.split('\t');
        if (parts.length < 2) parts = row.split(',');
        if (parts.length < 2) parts = row.split(/\s{2,}/); 
        if (parts.length < 2) parts = row.split('|');

        const firstPart = parts[0]?.trim().toUpperCase();
        if (firstPart === 'DATE' || firstPart === 'TRAN DATE' || firstPart === 'PARTICULARS') return null;

        if (parts.length < 3) return null;

        let dateStr = parts[0]?.trim();
        let description = parts[1]?.trim() || 'Pasted Transaction';
        let debit = parts[2]?.trim();
        let credit = parts[3]?.trim();

        let amount = 0;
        let type: 'debit' | 'credit' = 'debit';

        if (debit && !isNaN(parseFloat(debit.replace(/[^\d.-]/g, '')))) {
          amount = Math.abs(parseFloat(debit.replace(/[^\d.-]/g, '')));
          type = 'debit';
        } else if (credit && !isNaN(parseFloat(credit.replace(/[^\d.-]/g, '')))) {
          amount = Math.abs(parseFloat(credit.replace(/[^\d.-]/g, '')));
          type = 'credit';
        }

        if (amount === 0) return null;

        // Simple date parsing
        let date = new Date().toISOString().split('T')[0];
        if (dateStr) {
          try {
            let d: Date;
            if (dateStr.match(/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/)) {
              const [day, month, year] = dateStr.split(/[-/.]/);
              d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              d = new Date(dateStr);
            }
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          } catch (e) {}
        }

        return {
          id: `paste-${idx}-${Date.now()}`,
          date,
          description,
          amount,
          type,
          status: 'unmatched' as const,
          matchedIds: [],
          metadata: {
            'Date': dateStr,
            'PARTICULARS': description,
            'Debit': debit,
            'Credit': credit
          }
        };
      }).filter(Boolean) as BankTransaction[];
    }

    return rows.map((row, idx) => {
      // Try tab-separated first (Excel/Sheets default), then comma, then multiple spaces, then pipes
      let parts = row.split('\t');
      if (parts.length < 2) parts = row.split(',');
      if (parts.length < 2) parts = row.split(/\s{2,}/); 
      if (parts.length < 2) parts = row.split('|');

      let date = new Date().toISOString().split('T')[0];
      let description = 'Pasted Transaction';
      let amount = 0;
      let type: 'debit' | 'credit' = 'debit';
      let foundAmount = false;

      // Heuristics for the whole row
      const upperRow = row.toUpperCase();
      const isExplicitDebit = upperRow.includes(' DEBIT ') || upperRow.includes(' WITHDRAWAL ') || upperRow.includes(' PAYMENT ') || upperRow.includes(' DR ');
      const isExplicitCredit = upperRow.includes(' CREDIT ') || upperRow.includes(' DEPOSIT ') || upperRow.includes(' RECEIPT ') || upperRow.includes(' CR ');

      parts.forEach((part, pIdx) => {
        const trimmed = part.trim();
        if (!trimmed) return;

        // Check if it's a date
        if (trimmed.match(/^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}$/) || trimmed.match(/^[A-Z][a-z]{2}\s\d{1,2}/)) {
          try {
            let d: Date;
            if (trimmed.match(/^\d{1,2}[-/.]\d{1,2}[-/.]\d{4}$/)) {
              const [day, month, year] = trimmed.split(/[-/.]/);
              d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            } else {
              d = new Date(trimmed);
            }
            
            if (!isNaN(d.getTime())) {
              date = d.toISOString().split('T')[0];
            }
          } catch (e) {}
        } 
        // Check if it's an amount
        else if (trimmed.match(/[₹$€£]?\s?-?[\d,.]+(?:\.\d+)?\s?(?:DR|CR)?/i)) {
          const cleanVal = trimmed.replace(/[₹$€£\s,]/g, '').toUpperCase();
          const val = parseFloat(cleanVal);
          
          if (!isNaN(val) && val !== 0) {
            // Ignore small numbers that might be part of a description or ref if they don't have decimals
            // and we are in the first few columns (likely Ref/Chq column)
            const isPotentialRef = !trimmed.includes('.') && val > 1000 && pIdx < 3 && parts.length > 4;
            
            if (!foundAmount && !isPotentialRef) {
              amount = Math.abs(val);
              foundAmount = true;
              
              // 1. Check for explicit DR/CR in the part itself
              if (cleanVal.includes('DR')) {
                type = 'debit';
              } else if (cleanVal.includes('CR')) {
                type = 'credit';
              } else if (cleanVal.startsWith('-')) {
                type = 'debit';
              } 
              // 2. Check for row-level keywords
              else if (isExplicitDebit && !isExplicitCredit) {
                type = 'debit';
              } else if (isExplicitCredit && !isExplicitDebit) {
                type = 'credit';
              }
              // 3. Column-based heuristic for tab/comma separated data
              else if (parts.length >= 4) {
                const isTabOrComma = row.includes('\t') || row.includes(',');
                if (isTabOrComma) {
                  const prevPart = pIdx > 0 ? parts[pIdx - 1].trim() : 'not-empty';
                  const nextPart = pIdx < parts.length - 1 ? parts[pIdx + 1].trim() : 'not-empty';
                  
                  if (!prevPart && nextPart) {
                    type = 'credit';
                  } else if (prevPart && !nextPart) {
                    type = 'debit';
                  } else {
                    // If we are in the 4th column of a 5+ column row, it's often Credit
                    // Date | Desc | Ref | Debit | Credit | Balance
                    if (pIdx === 4) type = 'credit';
                    else if (pIdx === 3) type = 'debit';
                    else type = 'debit';
                  }
                } else {
                  type = 'debit';
                }
              } else {
                type = 'debit';
              }
            }
          }
        }
        // Otherwise it's probably description
        else if (trimmed.length > 3 && description === 'Pasted Transaction') {
          description = trimmed;
        }
      });

      return {
        id: `bank-${source}-${idx}-${Date.now()}`,
        date,
        description,
        amount,
        type,
        matchedIds: [] as string[],
        status: 'unmatched' as const
      };
    }).filter(tx => tx.amount > 0);
  };

  const handleMappingConfirm = () => {
    if (columnMapping.date === -1 || (columnMapping.amount === -1 && columnMapping.debit === -1 && columnMapping.credit === -1)) {
      toast.error('Please map at least Date and one amount column (Amount, Debit, or Credit)');
      return;
    }

    const txs: BankTransaction[] = rawFileData.map((row, idx): BankTransaction | null => {
      // Skip the header row and any rows before it
      if (idx <= headerRowIndex) return null;
      
      try {
        const dateStr = String(row[columnMapping.date] || '').trim();
        if (!dateStr) return null;

        // Try to parse date
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) {
          // Try common formats if standard Date fails
          if (!dateStr.match(/\d/)) return null; // Skip if no digits (likely header)
        }

        const desc = columnMapping.description !== -1 ? row[columnMapping.description] : 'No description';
        
        let amount = 0;
        let type: 'debit' | 'credit' = 'debit';

        if (columnMapping.amount !== -1) {
          amount = parseFloat(String(row[columnMapping.amount] || '0').replace(/[^\d.-]/g, ''));
          if (columnMapping.type !== -1) {
            const typeVal = String(row[columnMapping.type] || '').toLowerCase();
            type = typeVal.includes('cr') || typeVal.includes('dep') || typeVal.includes('in') ? 'credit' : 'debit';
          } else {
            type = amount < 0 ? 'debit' : 'credit';
            amount = Math.abs(amount);
          }
        } else {
          // Handle separate Debit/Credit columns
          const debitVal = columnMapping.debit !== -1 ? parseFloat(String(row[columnMapping.debit] || '0').replace(/[^\d.-]/g, '')) : 0;
          const creditVal = columnMapping.credit !== -1 ? parseFloat(String(row[columnMapping.credit] || '0').replace(/[^\d.-]/g, '')) : 0;
          
          if (!isNaN(creditVal) && creditVal > 0) {
            amount = creditVal;
            type = 'credit';
          } else if (!isNaN(debitVal) && debitVal > 0) {
            amount = debitVal;
            type = 'debit';
          }
        }

        if (!dateStr || isNaN(amount) || amount === 0) return null;

        const metadata: Record<string, any> = {};
        mappingHeaders.forEach((h, hIdx) => {
          metadata[h] = row[hIdx];
        });

        return {
          id: `manual-bank-${idx}-${Date.now()}`,
          date: dateStr,
          description: String(desc || 'No description'),
          amount: Math.abs(amount),
          type,
          matchedIds: [],
          status: 'unmatched',
          metadata,
          is_transaction: true
        };
      } catch (e) {
        return null;
      }
    }).filter((tx): tx is BankTransaction => tx !== null);

    if (txs.length === 0) {
      toast.error('No valid transactions found with the current mapping');
      return;
    }

    setBankTransactions(txs);
    setBankColumns(mappingHeaders);
    setIsMappingMode(false);
    toast.success(`Successfully processed ${txs.length} transactions`);
  };

  const processPastedData = () => {
    if (!pasteText.trim()) return;
    
    setIsProcessingFile(true);
    setProcessingProgress(0);
    
    // Fast progress for paste
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        return prev + 35;
      });
    }, 10);

    try {
      const txs = parseTextToTransactions(pasteText, 'paste');

      if (txs.length === 0) {
        throw new Error('Invalid format. Please use: Date, PARTICULARS, Debit, Credit');
      }

      setTimeout(() => {
        setBankTransactions(prev => [...prev, ...txs]);
        setProcessingProgress(100);
        setTimeout(() => {
          setIsProcessingFile(false);
          setProcessingProgress(0);
          setIsPasteMode(false);
          setPasteText('');
        }, 50);
      }, 100);

    } catch (error) {
      console.error('Paste Parse Error:', error);
      toast.error('Error parsing pasted data. Please ensure it has date, description, and amount.');
      setIsProcessingFile(false);
      setProcessingProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  const processBankFile = async (file: File) => {
    setIsProcessingFile(true);
    setProcessingProgress(0);
    
    const interval = setInterval(() => {
      setProcessingProgress(prev => {
        if (prev >= 98) {
          clearInterval(interval);
          return 98;
        }
        return prev + 15;
      });
    }, 100);

    try {
      const reader = new FileReader();
      const dataPromise = new Promise<ArrayBuffer>((resolve) => {
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.readAsArrayBuffer(file);
      });
      const buffer = await dataPromise;
      const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
      
      if (jsonData.length < 1) throw new Error('Excel file is empty');

      // Find the header row (scan first 20 rows)
      let headerRowIdx = -1;
      let dateIdx = -1;
      let descIdx = -1;
      let debitIdx = -1;
      let creditIdx = -1;

      const dateKeywords = ['date', 'txn date', 'transaction date', 'val dt', 'value date', 'dt', 'posted date', 'tran date'];
      const descKeywords = ['desc', 'particular', 'narration', 'remarks', 'details', 'transaction details', 'payee', 'memo', 'description'];
      const debitKeywords = ['debit', 'withdrawal', 'dr', 'out', 'payment', 'money out'];
      const creditKeywords = ['credit', 'deposit', 'cr', 'in', 'receipt', 'money in'];

      for (let i = 0; i < Math.min(jsonData.length, 20); i++) {
        const row = jsonData[i];
        if (!row || !Array.isArray(row)) continue;
        
        const headers = row.map(h => String(h || '').toLowerCase().trim());
        
        const dIdx = headers.findIndex(h => dateKeywords.some(k => h.includes(k)));
        const dsIdx = headers.findIndex(h => descKeywords.some(k => h.includes(k)));
        const dbIdx = headers.findIndex(h => debitKeywords.some(k => h.includes(k)));
        const crIdx = headers.findIndex(h => creditKeywords.some(k => h.includes(k)));
        
        if (dIdx !== -1 && (dbIdx !== -1 || crIdx !== -1)) {
          headerRowIdx = i;
          dateIdx = dIdx;
          descIdx = dsIdx;
          debitIdx = dbIdx;
          creditIdx = crIdx;
          break;
        }
      }

      if (headerRowIdx === -1 || dateIdx === -1 || (debitIdx === -1 && creditIdx === -1)) {
        // Fallback to manual mapping for Excel
        const filteredRows = jsonData.filter(r => r && r.length > 1 && r.some(cell => String(cell || '').trim().length > 0));
        setRawFileData(filteredRows);
        const firstRow = filteredRows.find(r => r.length > 2) || [];
        setMappingHeaders(firstRow.map((_, i) => `Column ${i + 1}`));
        setIsMappingMode(true);
        setIsProcessingFile(false);
        setProcessingProgress(0);
        return;
      }

      const headers = (jsonData[headerRowIdx] || []).map(h => String(h || ''));
      setBankColumns(headers);

      const txs: BankTransaction[] = jsonData.slice(headerRowIdx + 1).map((row: any, idx): BankTransaction | null => {
        if (!row || !Array.isArray(row)) return null;
        
        let amount = 0;
        let type: 'debit' | 'credit' = 'debit';

        if (debitIdx !== -1 && row[debitIdx] !== undefined && row[debitIdx] !== null && row[debitIdx] !== '') {
          const val = parseFloat(String(row[debitIdx]).replace(/[^0-9.-]/g, ''));
          if (!isNaN(val) && val !== 0) {
            amount = Math.abs(val);
            type = 'debit';
          }
        }
        
        if (amount === 0 && creditIdx !== -1 && row[creditIdx] !== undefined && row[creditIdx] !== null && row[creditIdx] !== '') {
          const val = parseFloat(String(row[creditIdx]).replace(/[^0-9.-]/g, ''));
          if (!isNaN(val) && val !== 0) {
            amount = Math.abs(val);
            type = 'credit';
          }
        }

        let dateStr = new Date().toISOString().split('T')[0];
        if (row[dateIdx]) {
          try {
            const d = new Date(row[dateIdx]);
            if (!isNaN(d.getTime())) {
              dateStr = d.toISOString().split('T')[0];
            }
          } catch (e) {}
        }

        const metadata: Record<string, any> = {};
        headers.forEach((h, hIdx) => {
          metadata[h || `Col ${hIdx}`] = row[hIdx];
        });

        return {
          id: `bank-excel-${idx}-${Date.now()}`,
          date: dateStr,
          description: descIdx !== -1 ? String(row[descIdx] || 'No description') : 'No description',
          amount: Math.abs(amount),
          type,
          matchedIds: [] as string[],
          status: 'unmatched',
          metadata
        };
      }).filter((tx): tx is BankTransaction => tx !== null && tx.amount > 0);

      setBankTransactions(txs);
      setIsTableView(true);
      setProcessingProgress(100);
      setTimeout(() => {
        setIsProcessingFile(false);
        setProcessingProgress(0);
      }, 300);
    } catch (error: any) {
      console.error('File Process Error:', error);
      toast.error(error.message || 'Error processing file.');
      setIsProcessingFile(false);
      setProcessingProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  const onDrop = (acceptedFiles: File[], rejectedFiles: any[]) => {
    if (rejectedFiles.length > 0) {
      toast.error('Invalid file type. Please upload Excel (.xlsx, .xls) files.');
      return;
    }
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/octet-stream' // Some systems use this for Excel
      ];
      const validExtensions = ['.xlsx', '.xls'];
      const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
      
      if (!validTypes.includes(file.type) && !hasValidExtension) {
        toast.error('Invalid file type. Please upload Excel (.xlsx, .xls) files.');
        return;
      }
      processBankFile(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls']
    },
    multiple: false
  });

  const handleConfirmMatch = async (force = false) => {
    if (!selectedBankTxId || selectedSystemEntryIds.length === 0) return;

    const bankTx = bankTransactions.find(t => t.id === selectedBankTxId);
    if (!bankTx) return;

    const entriesToMatch = systemEntries.filter(e => selectedSystemEntryIds.includes(e.id));
    const totalMatchedAmount = entriesToMatch.reduce((sum, e) => sum + e.amount, 0);

    // In a real app, we might allow partial matches, but for now let's aim for exact or close
    if (!force && Math.abs(totalMatchedAmount - bankTx.amount) > 0.01) {
      toast.warning(`Amount mismatch: Selected ${formatCurrency(totalMatchedAmount)} vs Bank ${formatCurrency(bankTx.amount)}`, {
        action: {
          label: 'Proceed anyway',
          onClick: () => handleConfirmMatch(true)
        }
      });
      return;
    }

    setIsSaving(true);
    try {
      const matchPromises = entriesToMatch.map(async (entry) => {
        const isReceipt = entry.type === 'invoice';
        const table = isReceipt ? 'customer_payments' : 'supplier_payments';
        const partyKey = isReceipt ? 'customer_id' : 'supplier_id';
        const linkKey = isReceipt ? 'invoice_id' : 'purchase_id';

        const payload = {
          business_id: businessId,
          [partyKey]: entry.partyId,
          [linkKey]: entry.id,
          ...(isReceipt ? {} : { invoice_id: entry.id }),
          amount: entry.amount,
          date: bankTx.date,
          payment_mode: 'Bank Transfer',
          reference_number: bankTx.description.slice(0, 50),
          notes: `Reconciled from bank statement: ${bankTx.description}`,
          created_by: profile?.id
        };

        const { error: insertError } = await supabase.from(table).insert([payload]);
        if (insertError) throw insertError;

        // Update status
        const linkTable = isReceipt ? 'invoices' : 'purchases';
        const { error: updateError } = await supabase.from(linkTable).update({ status: 'paid' }).eq('id', entry.id);
        if (updateError) throw updateError;
      });

      await Promise.all(matchPromises);

      // Update local state
      setBankTransactions(prev => prev.map(tx => 
        tx.id === selectedBankTxId 
          ? { ...tx, status: 'matched', matchedIds: selectedSystemEntryIds } 
          : tx
      ));
      
      setSystemEntries(prev => prev.filter(e => !selectedSystemEntryIds.includes(e.id)));
      setSelectedBankTxId(null);
      setSelectedSystemEntryIds([]);
      fetchData();
      
      toast.success('Reconciliation successful');
    } catch (error: any) {
      console.error('Reconciliation error:', error);
      toast.error('Error reconciling: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBankTx = bankTransactions.find(t => t.id === selectedBankTxId);

  const fetchBusinessProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('business_profiles')
        .select('bank_accounts, upi_ids')
        .eq('id', businessId)
        .single();
      
      if (error) throw error;
      setBusinessProfile(data);
    } catch (error) {
      console.error('Error fetching business profile:', error);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [receiptsRes, paymentsRes] = await Promise.all([
        supabase
          .from('customer_payments')
          .select('*, customers(name)')
          .eq('business_id', businessId)
          .order('date', { ascending: false }),
        supabase
          .from('supplier_payments')
          .select('*, suppliers(name)')
          .eq('business_id', businessId)
          .order('date', { ascending: false })
      ]);

      if (receiptsRes.error) throw receiptsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;

      const combined: Payment[] = [
        ...(receiptsRes.data || []).map(r => ({ ...r, type: 'receipt' as const })),
        ...(paymentsRes.data || []).map(p => ({ ...p, type: 'payment' as const }))
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setPayments(combined);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchParties = async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        supabase.from('customers').select('id, name').eq('business_id', businessId),
        supabase.from('suppliers').select('id, name').eq('business_id', businessId)
      ]);
      setCustomers(custRes.data || []);
      setSuppliers(suppRes.data || []);
    } catch (error) {
      console.error('Error fetching parties:', error);
    }
  };

  const fetchPartyInvoices = async (partyId: string, type: 'receipt' | 'payment') => {
    if (!partyId || !businessId) {
      setPartyInvoices([]);
      return;
    }

    setLoadingInvoices(true);
    try {
      console.log(`Fetching invoices for ${type}: partyId=${partyId}, businessId=${businessId}`);
      if (type === 'receipt') {
        const { data, error } = await supabase
          .from('invoices')
          .select('id, invoice_number, total, status')
          .eq('business_id', businessId)
          .eq('customer_id', partyId)
          .neq('status', 'paid')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error('Error fetching customer invoices:', error);
          throw error;
        }
        console.log('Fetched customer invoices:', data);
        setPartyInvoices(data || []);
      } else {
        const { data, error } = await supabase
          .from('purchases')
          .select('id, invoice_number, total_amount, status')
          .eq('business_id', businessId)
          .eq('supplier_id', partyId)
          .neq('status', 'paid')
          .order('date', { ascending: false });
        
        if (error) {
          console.error('Error fetching supplier purchases:', error);
          throw error;
        }
        console.log('Fetched supplier purchases:', data);
        setPartyInvoices(data || []);
      }
    } catch (error) {
      console.error('Error in fetchPartyInvoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handlePartyChange = (partyId: string) => {
    setFormData(prev => ({ ...prev, partyId, invoiceId: '', amount: '', referenceNumber: '' }));
    fetchPartyInvoices(partyId, formData.type);
  };

  const handleInvoiceChange = (invoiceId: string) => {
    const selectedInvoice = partyInvoices.find(inv => inv.id === invoiceId);
    if (selectedInvoice) {
      const amount = formData.type === 'receipt' ? selectedInvoice.total : selectedInvoice.total_amount;
      const ref = selectedInvoice.invoice_number;
      setFormData(prev => ({ 
        ...prev, 
        invoiceId, 
        amount: amount.toString(),
        referenceNumber: ref ? (formData.type === 'receipt' ? `INV-${ref}` : ref) : ''
      }));
    } else {
      setFormData(prev => ({ ...prev, invoiceId: '', amount: '', referenceNumber: '' }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.partyId || !formData.amount) return;

    setIsSaving(true);
    try {
      const isReceipt = formData.type === 'receipt';
      const table = isReceipt ? 'customer_payments' : 'supplier_payments';
      const partyKey = isReceipt ? 'customer_id' : 'supplier_id';
      const linkKey = isReceipt ? 'invoice_id' : 'purchase_id';

      const payload = {
        business_id: businessId,
        [partyKey]: formData.partyId,
        [linkKey]: formData.invoiceId || null,
        // Also include invoice_id for supplier_payments for backward compatibility if needed
        ...(isReceipt ? {} : { invoice_id: formData.invoiceId || null }),
        amount: parseFloat(formData.amount),
        date: formData.date,
        payment_mode: formData.paymentMode,
        reference_number: formData.referenceNumber,
        notes: [
          formData.bankAccount ? `Bank: ${formData.bankAccount}` : '',
          formData.upiId ? `UPI: ${formData.upiId}` : '',
          formData.notes
        ].filter(Boolean).join('\n'),
        created_by: profile?.id
      };

      console.log(`Saving payment to ${table}:`, payload);

      const { error } = await supabase
        .from(table)
        .insert([payload]);

      if (error) {
        console.error(`Error saving to ${table}:`, error);
        throw error;
      }

      // Update linked invoice/purchase status if selected
      if (formData.invoiceId) {
        const linkTable = isReceipt ? 'invoices' : 'purchases';
        const { error: updateError } = await supabase
          .from(linkTable)
          .update({ status: 'paid' })
          .eq('id', formData.invoiceId);
        
        if (updateError) console.error(`Error updating ${linkTable} status:`, updateError);
      }

      setIsDrawerOpen(false);
      setFormData({
        type: 'receipt',
        partyId: '',
        invoiceId: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        paymentMode: 'Cash',
        referenceNumber: '',
        bankAccount: '',
        upiId: '',
        notes: ''
      });
      toast.success('Payment saved successfully');
      setPartyInvoices([]);
      fetchData();
    } catch (error: any) {
      toast.error('Error saving payment: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!paymentToDelete) return;
    const payment = payments.find(p => p.id === paymentToDelete);
    if (!payment) return;

    try {
      const table = payment.type === 'receipt' ? 'customer_payments' : 'supplier_payments';
      const { error } = await supabase.from(table).delete().eq('id', paymentToDelete);
      if (error) throw error;
      toast.success('Payment deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Error deleting payment: ' + error.message);
    } finally {
      setIsDeleteModalOpen(false);
      setPaymentToDelete(null);
    }
  };

  const filteredPayments = payments.filter(p => {
    const partyName = p.type === 'receipt' ? p.customers?.name : p.suppliers?.name;
    const matchesSearch = partyName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payments & Receipts" 
        description="Track incoming and outgoing funds, reconcile accounts, and manage your cash flow."
      >
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsReconcileMode(!isReconcileMode)}
            className={cn(
              "h-10 sm:h-9 px-4 rounded-xl text-xs font-bold transition-all flex items-center border-2",
              isReconcileMode 
                ? "bg-slate-900 text-white border-slate-900" 
                : "bg-white text-slate-600 border-slate-100 hover:border-slate-200"
            )}
          >
            <FileText size={14} className="mr-1.5" />
            {isReconcileMode ? 'Exit Reconciliation' : 'Bank Reconciliation'}
          </button>
          {!isReconcileMode && (
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="btn-primary h-10 sm:h-9"
            >
              <Plus size={14} className="mr-1.5" />
              Record Payment
            </button>
          )}
        </div>
      </PageHeader>

      {isReconcileMode ? (
        <div className="space-y-6">
          {/* Reconciliation Header & Upload */}
          <div className="glass-card p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
              <div className="space-y-1 min-w-[200px]">
                <h2 className="text-sm font-bold text-slate-900 flex items-center">
                  <FileText className="mr-2 text-primary" size={18} />
                  Bank Reconciliation
                </h2>
                <p className="text-[10px] text-slate-500 font-medium">Match bank transactions with system entries.</p>
                
                  <div className="flex items-center space-x-2 mt-4">
                    <button 
                      onClick={() => setIsPasteMode(false)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                        !isPasteMode ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Upload File
                    </button>
                    <button 
                      onClick={() => setIsPasteMode(true)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                        isPasteMode ? "bg-primary text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      )}
                    >
                      Paste Data
                    </button>
                    <button 
                      onClick={downloadSampleExcel}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all flex items-center"
                    >
                      <Download size={12} className="mr-1.5" />
                      Sample Excel
                    </button>
                  </div>
              </div>
              
              <div className="flex-1 w-full">
                {isMappingMode ? (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="p-1.5 bg-primary/10 rounded-lg">
                          <Filter className="text-primary" size={16} />
                        </div>
                        <div>
                          <h3 className="text-xs font-bold text-slate-900">Map Statement Columns</h3>
                          <p className="text-[9px] text-slate-500 font-medium">Select which column corresponds to each field.</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setIsMappingMode(false);
                          setAccountDetails([]);
                          setHeaderRowIndex(-1);
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Account Details Section */}
                    {accountDetails.length > 0 && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <h4 className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">Account Details Found</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                          {accountDetails.map((detail, idx) => (
                            <p key={idx} className="text-[10px] text-slate-600 font-medium truncate">{detail}</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Selected Row Preview */}
                    {headerRowIndex !== -1 && (
                      <div className="p-3 bg-primary/5 rounded-xl border border-primary/10 animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-[9px] font-bold text-primary uppercase tracking-wider">Selected Row Values (Row #{headerRowIndex + 1})</h4>
                          <button 
                            onClick={() => {
                              setHeaderRowIndex(-1);
                              setMappingHeaders(rawFileData[0]?.map((_, i) => `Column ${i + 1}`) || []);
                            }}
                            className="text-[8px] font-bold text-primary/60 hover:text-primary underline uppercase tracking-widest"
                          >
                            Clear Selection
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {mappingHeaders.map((val, idx) => (
                            <div key={idx} className="px-2 py-1 bg-white border border-primary/20 rounded-md shadow-sm">
                              <p className="text-[8px] text-slate-400 font-bold uppercase mb-0.5">Col {idx + 1}</p>
                              <p className="text-[10px] text-slate-700 font-bold truncate max-w-[120px]">{val}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Date', key: 'date' },
                        { label: 'Description', key: 'description' },
                        { label: 'Debit', key: 'debit' },
                        { label: 'Credit', key: 'credit' }
                      ].map(field => {
                        const selectedIdx = columnMapping[field.key as keyof typeof columnMapping];
                        const currentValue = selectedIdx !== -1 ? mappingHeaders[selectedIdx] : null;
                        
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{field.label}</label>
                              {currentValue && (
                                <span className="text-[8px] font-bold text-primary truncate max-w-[60px]" title={currentValue}>
                                  {currentValue}
                                </span>
                              )}
                            </div>
                            <div className="relative">
                              <select 
                                className="w-full pl-3 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 outline-none focus:border-primary appearance-none transition-all cursor-pointer"
                                value={selectedIdx}
                                onChange={e => setColumnMapping(prev => ({ ...prev, [field.key]: parseInt(e.target.value) }))}
                              >
                                <option value={-1}>Select Column...</option>
                                {mappingHeaders.map((header, idx) => (
                                  <option key={idx} value={idx}>{header}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                      <div className="p-2 bg-white border-b border-slate-100 flex items-center justify-between">
                        <p className="text-[9px] font-bold text-slate-500 italic">Click a row from <span className="text-primary font-bold">any page</span> to set it as the <span className="text-primary font-bold">Header Row</span></p>
                        <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest">Showing all {rawFileData.length} rows</p>
                      </div>
                      <div className="max-h-[400px] overflow-auto">
                        <table className="w-full text-left border-collapse text-[9px]">
                          <thead>
                            <tr className="bg-black text-white text-[10px] font-bold uppercase tracking-wider sticky top-0 z-10">
                              <th className="px-3 py-2 w-10">#</th>
                              {mappingHeaders.map((header, idx) => {
                                const isMapped = Object.values(columnMapping).includes(idx);
                                return (
                                  <th key={idx} className={cn(
                                    "px-3 py-2 min-w-[120px] whitespace-nowrap",
                                    isMapped ? "text-primary bg-primary/10" : ""
                                  )}>
                                    {header}
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-500">
                            {rawFileData.map((row, rIdx) => (
                              <tr 
                                key={rIdx} 
                                onClick={() => {
                                  setHeaderRowIndex(rIdx);
                                  setMappingHeaders(row.map((h, cIdx) => String(h || '').trim() || `Column ${cIdx + 1}`));
                                }}
                                className={cn(
                                  "hover:bg-white transition-colors cursor-pointer",
                                  headerRowIndex === rIdx ? "bg-primary/5" : "bg-white"
                                )}
                              >
                                <td className="px-3 py-2 text-slate-400 font-bold">{rIdx + 1}</td>
                                {row.map((cell, cIdx) => {
                                  const isMapped = Object.values(columnMapping).includes(cIdx);
                                  return (
                                    <td key={cIdx} className={cn(
                                      "px-3 py-2 font-medium truncate max-w-[200px]",
                                      isMapped ? "text-primary bg-primary/5 font-bold" : "text-slate-600",
                                      headerRowIndex === rIdx && "text-primary font-bold"
                                    )}>
                                      {cell}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="p-3 bg-slate-50/50 border-t border-slate-100 flex justify-end items-center">
                        <button 
                          onClick={handleMappingConfirm}
                          className="bg-primary text-white px-6 py-2 rounded-xl text-[11px] font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center"
                        >
                          <Check size={14} className="mr-2" />
                          Confirm & Process Statement
                        </button>
                      </div>
                    </div>
                  </div>
                ) : isPasteMode ? (
                  <div className="space-y-3">
                    <div className="relative">
                      <textarea 
                        className="w-full h-24 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl outline-none focus:border-primary text-[11px] font-mono resize-none transition-all"
                        placeholder="Paste data from Excel/Sheets here (Date, Description, Amount)..."
                        value={pasteText}
                        onChange={e => setPasteText(e.target.value)}
                      />
                      {pasteText && (
                        <button 
                          onClick={processPastedData}
                          disabled={isProcessingFile}
                          className="absolute bottom-3 right-3 bg-primary text-white px-4 py-1.5 rounded-xl text-[10px] font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 flex items-center"
                        >
                          {isProcessingFile ? <Loader2 size={12} className="animate-spin mr-1.5" /> : <Check size={12} className="mr-1.5" />}
                          Process
                        </button>
                      )}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium italic">Tip: Copy cells from your spreadsheet and paste them directly.</p>
                  </div>
                ) : (
                  <div {...getRootProps()} className={cn(
                    "w-full border-2 border-dashed rounded-2xl p-6 transition-all cursor-pointer flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[120px]",
                    isDragActive ? "border-primary bg-primary/5" : "border-slate-200 hover:border-primary/50 hover:bg-slate-50",
                    bankTransactions.length > 0 && "py-4"
                  )}>
                    <input {...getInputProps()} />
                    {isProcessingFile ? (
                      <div className="w-full max-w-md space-y-3 px-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Processing Statement...</span>
                          </div>
                          <span className="text-[10px] font-bold text-primary">{processingProgress}%</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-300 ease-out"
                            style={{ width: `${processingProgress}%` }}
                          />
                        </div>
                      </div>
                    ) : bankTransactions.length > 0 ? (
                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center space-x-2">
                          <div className="p-2 bg-emerald-100 rounded-full">
                            <CheckCircle2 className="text-emerald-600" size={20} />
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-bold text-slate-900">Statement Loaded Successfully</p>
                            <p className="text-[10px] text-slate-500 font-medium">{bankTransactions.length} transactions identified</p>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setBankTransactions([]);
                            setSelectedBankTxId(null);
                            setSelectedSystemEntryIds([]);
                          }}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors mt-2"
                        >
                          Remove Statement & Start Over
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 bg-slate-50 rounded-full mb-3 group-hover:bg-primary/10 transition-colors">
                          <FileSpreadsheet className="text-slate-400 group-hover:text-primary transition-colors" size={24} />
                        </div>
                        <p className="text-xs font-bold text-slate-700">Drop your bank statement here</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-1">Supports Excel (.xlsx, .xls) only</p>
                        <p className="text-[9px] text-slate-400 mt-1 italic">Required columns: Date, Description, Debit, Credit</p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {bankTransactions.length > 0 && (
            <div className="grid gap-6 xl:h-[calc(100vh-180px)] grid-cols-1 xl:grid-cols-2">
              {/* Left Side: Bank Transactions */}
              <div className="glass-card flex flex-col overflow-hidden transition-all duration-500 h-[600px] xl:h-full">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <div className="flex flex-col">
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">Bank Transactions</h3>
                    {selectedSystemEntryIds.length > 0 && (
                      <p className="text-[9px] text-primary font-bold">Filtering by amount: {formatCurrency(systemEntries.filter(e => selectedSystemEntryIds.includes(e.id)).reduce((sum, e) => sum + e.amount, 0))}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {bankColumns.length > 0 && (
                      <button 
                        onClick={() => setIsTableView(!isTableView)}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-primary transition-all shadow-sm"
                        title={isTableView ? "Switch to Card View" : "Switch to Table View"}
                      >
                        {isTableView ? <ClipboardList size={14} /> : <FileText size={14} />}
                      </button>
                    )}
                    <span className="text-[10px] font-bold text-slate-500">
                      {bankTransactions.filter(t => t.status === 'matched').length} / {bankTransactions.length} Matched
                    </span>
                  </div>
                </div>
                <div className="p-2 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search description..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-transparent rounded-xl outline-none text-[11px] focus:bg-white focus:border-primary transition-all"
                      value={bankSearch}
                      onChange={e => setBankSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {isTableView && bankColumns.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                            {bankTransactions.some(t => t.page_number) && (
                              <th className="px-3 py-2 whitespace-nowrap">Page</th>
                            )}
                            {bankColumns.map(col => (
                              <th key={col} className="px-3 py-2 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-500">
                          {bankTransactions
                            .filter(tx => {
                              const matchesSearch = tx.description.toLowerCase().includes(bankSearch.toLowerCase());
                              if (selectedSystemEntryIds.length > 0) {
                                const totalSelectedAmount = systemEntries
                                  .filter(e => selectedSystemEntryIds.includes(e.id))
                                  .reduce((sum, e) => sum + e.amount, 0);
                                const amountMatch = Math.abs(tx.amount - totalSelectedAmount) < 0.01;
                                const firstEntry = systemEntries.find(e => selectedSystemEntryIds.includes(e.id));
                                const typeMatch = firstEntry ? (
                                  (tx.type === 'credit' && firstEntry.type === 'invoice') || 
                                  (tx.type === 'debit' && firstEntry.type === 'purchase')
                                ) : true;
                                return matchesSearch && amountMatch && typeMatch;
                              }
                              return matchesSearch;
                            })
                            .map(tx => (
                              <tr 
                                key={tx.id}
                                onClick={() => {
                                  if (tx.status === 'matched' || tx.is_transaction === false) return;
                                  setSelectedBankTxId(selectedBankTxId === tx.id ? null : tx.id);
                                }}
                                className={cn(
                                  "transition-colors",
                                  tx.is_transaction === false 
                                    ? "bg-slate-50/50 text-slate-400 cursor-default italic" 
                                    : "cursor-pointer",
                                  selectedBankTxId === tx.id 
                                    ? "bg-primary/5" 
                                    : tx.status === 'matched'
                                      ? "bg-emerald-50/30 opacity-70"
                                      : tx.is_transaction !== false && "hover:bg-slate-50"
                                )}
                              >
                                {bankTransactions.some(t => t.page_number) && (
                                  <td className="px-3 py-2 font-bold text-slate-400">
                                    {tx.page_number || '-'}
                                  </td>
                                )}
                                {bankColumns.map(col => {
                                  const val = tx.metadata?.[col] || tx.metadata?.[col.toLowerCase()] || '';
                                  const isAmount = col.toLowerCase().includes('amount') || col.toLowerCase().includes('debit') || col.toLowerCase().includes('credit') || col.toLowerCase().includes('withdrawal') || col.toLowerCase().includes('deposit');
                                  
                                  return (
                                    <td key={col} className={cn(
                                      "px-3 py-2 font-medium",
                                      isAmount ? (tx.type === 'credit' ? "text-emerald-600" : "text-orange-600") : "text-slate-600"
                                    )}>
                                      {isAmount && val ? formatCurrency(parseFloat(String(val).replace(/[^\d.-]/g, '')) || 0) : String(val)}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {bankTransactions
                        .filter(tx => {
                          const matchesSearch = tx.description.toLowerCase().includes(bankSearch.toLowerCase());
                          
                          // If system entries are selected, filter bank transactions by total amount
                          if (selectedSystemEntryIds.length > 0) {
                            const totalSelectedAmount = systemEntries
                              .filter(e => selectedSystemEntryIds.includes(e.id))
                              .reduce((sum, e) => sum + e.amount, 0);
                            
                            const amountMatch = Math.abs(tx.amount - totalSelectedAmount) < 0.01;
                            
                            // Also check type compatibility
                            const firstEntry = systemEntries.find(e => selectedSystemEntryIds.includes(e.id));
                            const typeMatch = firstEntry ? (
                              (tx.type === 'credit' && firstEntry.type === 'invoice') || 
                              (tx.type === 'debit' && firstEntry.type === 'purchase')
                            ) : true;

                            return matchesSearch && amountMatch && typeMatch;
                          }

                          return matchesSearch;
                        })
                        .map(tx => (
                        <button
                          key={tx.id}
                          onClick={() => {
                            if (tx.status === 'matched' || tx.is_transaction === false) return;
                            setSelectedBankTxId(selectedBankTxId === tx.id ? null : tx.id);
                          }}
                          className={cn(
                            "w-full text-left p-3 rounded-xl border-2 transition-all group relative",
                            tx.is_transaction === false 
                              ? "border-slate-100 bg-slate-50/30 opacity-60 cursor-default italic"
                              : selectedBankTxId === tx.id 
                                ? "border-primary bg-primary/5 shadow-sm" 
                                : tx.status === 'matched'
                                  ? "border-emerald-100 bg-emerald-50/30 opacity-70"
                                  : "border-transparent hover:border-slate-200 bg-white"
                          )}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center space-x-2">
                              {tx.date && <span className="text-[9px] font-bold text-slate-400">{new Date(tx.date).toLocaleDateString()}</span>}
                              {tx.page_number && (
                                <span className="text-[9px] font-bold text-primary/60">P.{tx.page_number}</span>
                              )}
                              {tx.status === 'matched' && <CheckCircle2 size={12} className="text-emerald-500" />}
                            </div>
                            {tx.is_transaction !== false && (
                              <span className={cn(
                                "text-xs font-bold",
                                tx.type === 'credit' ? "text-emerald-600" : "text-orange-600"
                              )}>
                                {tx.type === 'credit' ? '+' : '-'}{formatCurrency(tx.amount)}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-slate-900 line-clamp-1">{tx.description}</p>
                          
                          {selectedBankTxId === tx.id && (
                            <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-full" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {bankTransactions.length > 0 && bankTransactions.filter(tx => {
                      if (selectedSystemEntryIds.length > 0) {
                        const totalSelectedAmount = systemEntries
                          .filter(e => selectedSystemEntryIds.includes(e.id))
                          .reduce((sum, e) => sum + e.amount, 0);
                        const amountMatch = Math.abs(tx.amount - totalSelectedAmount) < 0.01;
                        const firstEntry = systemEntries.find(e => selectedSystemEntryIds.includes(e.id));
                        const typeMatch = firstEntry ? (
                          (tx.type === 'credit' && firstEntry.type === 'invoice') || 
                          (tx.type === 'debit' && firstEntry.type === 'purchase')
                        ) : true;
                        return amountMatch && typeMatch;
                      }
                      return true;
                  }).length === 0 && (
                    <div className="py-12 text-center">
                      <AlertCircle className="mx-auto text-slate-300 mb-2" size={24} />
                      <p className="text-[10px] font-bold text-slate-500 uppercase">No matching transactions</p>
                      {selectedSystemEntryIds.length > 0 && (
                        <p className="text-[9px] text-slate-400 mt-1">Try selecting different entries or clear selection.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: System Entries */}
              <div className="glass-card flex flex-col overflow-hidden relative h-[600px] xl:h-full">
                  <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-wider">System Entries</h3>
                    <div className="flex items-center space-x-2">
                      {selectedSystemEntryIds.length > 0 && (
                        <button 
                          onClick={() => setSelectedSystemEntryIds([])}
                          className="text-[9px] text-red-500 font-bold hover:underline mr-2"
                        >
                          Clear Selection
                        </button>
                      )}
                      <select 
                        className="text-[10px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-1 outline-none"
                        value={reconcileTypeFilter}
                        onChange={e => setReconcileTypeFilter(e.target.value as any)}
                      >
                        <option value="all">All Entries</option>
                        <option value="invoice">Invoices</option>
                        <option value="purchase">Purchases</option>
                      </select>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input 
                      type="text" 
                      placeholder="Search party or number..."
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none text-[11px] focus:border-primary transition-all"
                      value={reconcileSearch}
                      onChange={e => setReconcileSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-4">
                  {loadingSystemEntries ? (
                    <div className="flex flex-col items-center justify-center h-full py-12">
                      <Loader2 className="text-primary animate-spin mb-2" size={24} />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Loading Entries...</p>
                    </div>
                  ) : systemEntries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6">
                      <div className="p-4 bg-slate-50 rounded-full mb-4">
                        <AlertCircle className="text-slate-300" size={32} />
                      </div>
                      <p className="text-xs font-bold text-slate-600">No unpaid entries found</p>
                      <p className="text-[10px] text-slate-400 mt-1">All invoices and purchases are marked as paid.</p>
                    </div>
                  ) : (
                    <>
                        <div className="space-y-2">
                          <div className="flex items-center px-2">
                            <Filter size={12} className="text-slate-400 mr-1.5" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                              All System Entries
                            </span>
                          </div>
                          {systemEntries
                            .filter(e => {
                              const matchesSearch = e.partyName.toLowerCase().includes(reconcileSearch.toLowerCase()) || 
                                                   e.number.toLowerCase().includes(reconcileSearch.toLowerCase());
                              const matchesType = reconcileTypeFilter === 'all' || e.type === reconcileTypeFilter;
                              
                              // If a bank transaction is selected, filter system entries by amount and type
                              const selectedBankTx = bankTransactions.find(t => t.id === selectedBankTxId);
                              const matchesBankTx = selectedBankTx ? (
                                Math.abs(e.amount - selectedBankTx.amount) < 0.01 && (
                                  (selectedBankTx.type === 'credit' && e.type === 'invoice') ||
                                  (selectedBankTx.type === 'debit' && e.type === 'purchase')
                                )
                              ) : true;

                              return matchesSearch && matchesType && matchesBankTx;
                            })
                            .map(entry => (
                              <button
                                key={entry.id}
                                onClick={() => {
                                  setSelectedSystemEntryIds(prev => 
                                    prev.includes(entry.id) 
                                      ? prev.filter(id => id !== entry.id) 
                                      : [...prev, entry.id]
                                  );
                                  // Clear bank tx if it no longer matches the new total
                                  setSelectedBankTxId(null);
                                }}
                                className={cn(
                                  "w-full text-left p-3 rounded-xl border-2 transition-all",
                                  selectedSystemEntryIds.includes(entry.id)
                                    ? "border-primary bg-primary/5"
                                    : "border-slate-50 hover:border-slate-200 bg-white"
                                )}
                              >
                                <div className="flex items-start justify-between mb-1">
                                  <div className="flex items-center space-x-2">
                                    <span className={cn(
                                      "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                                      entry.type === 'invoice' ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                    )}>
                                      {entry.type}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-900">#{entry.number}</span>
                                  </div>
                                  <span className="text-xs font-bold text-slate-900">{formatCurrency(entry.amount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-medium text-slate-600">{entry.partyName}</p>
                                  <span className="text-[9px] text-slate-400">{new Date(entry.date).toLocaleDateString()}</span>
                                </div>
                              </button>
                            ))}
                        </div>
                    </>
                  )}
                </div>

                {/* Match Footer */}
                {selectedBankTxId && selectedSystemEntryIds.length > 0 && (
                  <motion.div 
                    initial={{ y: 100 }}
                    animate={{ y: 0 }}
                    className="absolute bottom-4 left-4 right-4 bg-slate-900 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Bank Amount</span>
                        <span className="text-sm font-bold">{formatCurrency(selectedBankTx?.amount || 0)}</span>
                      </div>
                      <div className="h-8 w-px bg-slate-700" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Selected ({selectedSystemEntryIds.length})</span>
                        <span className={cn(
                          "text-sm font-bold",
                          Math.abs((selectedBankTx?.amount || 0) - systemEntries.filter(e => selectedSystemEntryIds.includes(e.id)).reduce((sum, e) => sum + e.amount, 0)) < 0.01
                            ? "text-emerald-400"
                            : "text-orange-400"
                        )}>
                          {formatCurrency(systemEntries.filter(e => selectedSystemEntryIds.includes(e.id)).reduce((sum, e) => sum + e.amount, 0))}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleConfirmMatch()}
                      disabled={isSaving}
                      className="bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center shadow-lg shadow-primary/20"
                    >
                      {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LinkIcon size={14} className="mr-2" />}
                      Confirm Match
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-emerald-500 flex items-center space-x-4">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 border border-emerald-100"><ArrowDownLeft size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Receipts (Customers)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(payments.filter(p => p.type === 'receipt').reduce((sum, p) => sum + p.amount, 0))}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm border-l-4 border-orange-500 flex items-center space-x-4">
          <div className="p-2 bg-orange-50 rounded-lg text-orange-600 border border-orange-100"><ArrowUpRight size={20} /></div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Payments (Suppliers)</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">
              {formatCurrency(payments.filter(p => p.type === 'payment').reduce((sum, p) => sum + p.amount, 0))}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Search by party or reference..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-4">
            <select 
              className="px-3 py-2 bg-slate-50 border border-transparent rounded-xl focus:bg-white focus:border-primary outline-none text-xs transition-all"
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
            >
              <option value="all">All Types</option>
              <option value="receipt">Receipts (In)</option>
              <option value="payment">Payments (Out)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black text-white text-[10px] font-bold uppercase tracking-wider">
                <th className="px-4 py-2 whitespace-nowrap">Date</th>
                <th className="px-4 py-2 whitespace-nowrap">Party</th>
                <th className="px-4 py-2 whitespace-nowrap">Type</th>
                <th className="px-4 py-2 whitespace-nowrap">Amount</th>
                <th className="px-4 py-2 whitespace-nowrap">Mode</th>
                <th className="px-4 py-2 whitespace-nowrap">Reference</th>
                <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-500">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                    <p className="text-slate-500 text-xs">Loading transactions...</p>
                  </td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <CreditCard className="w-12 h-12 mx-auto text-slate-200 mb-2" />
                    <p className="text-slate-500 font-medium text-xs">No transactions found</p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-4 py-0.5 text-[11px] text-slate-600">
                      {new Date(payment.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-0.5">
                      <span className="text-[11px] font-bold text-slate-900">
                        {payment.type === 'receipt' ? payment.customers?.name : payment.suppliers?.name}
                      </span>
                    </td>
                    <td className="px-4 py-0.5">
                      <span className={cn(
                        "px-1 py-0.5 rounded-md text-[9px] font-bold uppercase",
                        payment.type === 'receipt' ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"
                      )}>
                        {payment.type === 'receipt' ? "Receipt" : "Payment"}
                      </span>
                    </td>
                    <td className="px-4 py-0.5">
                      <span className={cn(
                        "text-[11px] font-bold",
                        payment.type === 'receipt' ? "text-emerald-600" : "text-orange-600"
                      )}>
                        {payment.type === 'receipt' ? "+" : "-"}{formatCurrency(payment.amount)}
                      </span>
                    </td>
                    <td className="px-4 py-0.5 text-[11px] text-slate-600">{payment.payment_mode}</td>
                    <td className="px-4 py-0.5 text-[11px] text-slate-500">{payment.reference_number || '-'}</td>
                    <td className="px-4 py-0.5 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button 
                          onClick={() => {
                            setPaymentToDelete(payment.id);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all h-7 w-7 flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                        <button className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all h-7 w-7 flex items-center justify-center">
                          <Share2 size={14} />
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
    </>
  )}

  {/* Record Payment Drawer */}
  <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Record Transaction"
        icon={<CreditCard size={18} />}
        fullScreen={true}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-500 uppercase">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, type: 'receipt', partyId: '', invoiceId: '', amount: '', referenceNumber: '' });
                  setPartyInvoices([]);
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold border-2 transition-all h-10 sm:h-9",
                  formData.type === 'receipt' ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-100 text-slate-500"
                )}
              >
                Receipt (In)
              </button>
              <button
                type="button"
                onClick={() => {
                  setFormData({ ...formData, type: 'payment', partyId: '', invoiceId: '', amount: '', referenceNumber: '' });
                  setPartyInvoices([]);
                }}
                className={cn(
                  "py-2 rounded-xl text-xs font-bold border-2 transition-all h-10 sm:h-9",
                  formData.type === 'payment' ? "border-orange-500 bg-orange-50 text-orange-700" : "border-slate-100 text-slate-500"
                )}
              >
                Payment (Out)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                {formData.type === 'receipt' ? 'Customer' : 'Supplier'}
              </label>
              <select
                required
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.partyId}
                onChange={e => handlePartyChange(e.target.value)}
              >
                <option value="">Select {formData.type === 'receipt' ? 'Customer' : 'Supplier'}</option>
                {(formData.type === 'receipt' ? customers : suppliers).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">
                Link to {formData.type === 'receipt' ? 'Invoice' : 'Purchase'} (Optional)
              </label>
              <div className="relative">
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs appearance-none"
                  value={formData.invoiceId}
                  onChange={e => handleInvoiceChange(e.target.value)}
                  disabled={!formData.partyId || loadingInvoices || partyInvoices.length === 0}
                >
                  <option value="">
                    {loadingInvoices 
                      ? 'Loading...' 
                      : !formData.partyId 
                        ? `Select ${formData.type === 'receipt' ? 'Customer' : 'Supplier'} first`
                        : partyInvoices.length === 0 
                          ? `No unpaid ${formData.type === 'receipt' ? 'invoices' : 'purchases'} found`
                          : `Select ${formData.type === 'receipt' ? 'Invoice' : 'Purchase'}`}
                  </option>
                  {partyInvoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_number} - {formatCurrency(formData.type === 'receipt' ? inv.total : inv.total_amount)}
                    </option>
                  ))}
                </select>
                {loadingInvoices && (
                  <div className="absolute right-8 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Amount</label>
              <input
                required
                type="number"
                step="0.01"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.amount}
                onChange={e => setFormData({ ...formData, amount: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Date</label>
              <input
                required
                type="date"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Payment Mode</label>
              <select
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.paymentMode}
                onChange={e => setFormData({ ...formData, paymentMode: e.target.value })}
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
                <option value="UPI">UPI</option>
              </select>
            </div>

            {formData.paymentMode === 'Bank Transfer' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select Bank Account</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.bankAccount}
                  onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                >
                  <option value="">Select Bank Account</option>
                  {businessProfile?.bank_accounts?.map((acc: any, i: number) => (
                    <option key={i} value={`${acc.bankName} (x${acc.accountNo.slice(-4)})`}>
                      {acc.bankName} - {acc.accountNo.slice(-4)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.paymentMode === 'UPI' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select UPI ID</label>
                <select
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.upiId}
                  onChange={e => setFormData({ ...formData, upiId: e.target.value })}
                >
                  <option value="">Select UPI ID</option>
                  {businessProfile?.upi_ids?.map((upi: any, i: number) => (
                    <option key={i} value={upi.upiId}>
                      {upi.label ? `${upi.label} (${upi.upiId})` : upi.upiId}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {formData.paymentMode === 'Cheque' && (
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Bank Name / Cheque Details</label>
                <input
                  list="bank-names"
                  type="text"
                  placeholder="Bank Name / Cheque #"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                  value={formData.bankAccount}
                  onChange={e => setFormData({ ...formData, bankAccount: e.target.value })}
                />
                <datalist id="bank-names">
                  {businessProfile?.bank_accounts?.map((acc: any, i: number) => (
                    <option key={i} value={acc.bankName} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Vch No. / Reference Number</label>
              <input
                type="text"
                placeholder="Vch No., Transaction ID, etc."
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs"
                value={formData.referenceNumber}
                onChange={e => setFormData({ ...formData, referenceNumber: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase">Notes</label>
              <textarea
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-primary text-xs min-h-[40px]"
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full h-10 sm:h-9 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 flex items-center justify-center"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus size={16} className="mr-2" />}
            Save Transaction
          </button>
        </form>
      </Drawer>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This will affect the ledger balance."
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}
