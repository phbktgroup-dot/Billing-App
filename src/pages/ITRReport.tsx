import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Download, 
  Calendar, 
  User, 
  Building2, 
  MapPin,
  FileSpreadsheet,
  Table as TableIcon,
  ChevronRight,
  Plus,
  Trash2,
  Calculator,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { cn, getDateRange, downloadFile } from '../lib/utils';
import PageHeader from '../components/PageHeader';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

type TabType = 'balance-sheet' | 'annexure-a' | 'annexure-b' | 'profit-loss';

const initialBsData = [
  ['CAPITAL ACCOUNT', '-', 'FIXED ASSETS', '-'],
  ['[As Per Annexure A]', '', '[As Per Annexure B]', ''],
  ['Loans(liability)', '', 'INVESTMENTS', ''],
  ['', '', 'Gold', '7,85,816.00'],
  ['CURRENT LIABILITIES', '', 'CURRENT ASSETS', ''],
  ['Sundry Creditors', '1,85,013.00', 'LOANS AND ADVANCES', ''],
  ['Provision', '', 'Cash In Hand & Bank Balance', '2,40,291.25'],
  ['', '', 'Sundry Debtors', '6,51,225.00'],
  ['', '', 'Advance to Worker', '35,500.00'],
  ['', '', 'Stock in Hand', '-'],
  ['TOTAL', '1,85,013.00', 'TOTAL', '17,12,832.25'],
];

const initialAnnexAData = [
  ['To Drawings', '1,75,500.00', 'By Capital B/F', '52,44,272.00'],
  ['', '', 'By SB Interest', '80.00'],
  ['To Closing Balance', '55,66,450.00', 'By Profit & Loss A/c', '4,97,598.00'],
  ['TOTAL', '57,41,950.00', 'TOTAL', '57,41,950.00'],
];

const initialAnnexBData = [
  ['1', 'Car', '2,76,356.00', '', '2,76,356.00', '10%', '27,635.60', '2,48,720.40'],
  ['2', 'Dairy Tools', '54,989.00', '', '54,989.00', '15%', '8,248.35', '46,740.65'],
  ['3', 'Shed/Equip.', '2,75,558.00', '', '2,75,558.00', '15%', '41,333.70', '2,34,224.30'],
  ['4', 'Two Wheelers', '47,902.00', '', '47,902.00', '15%', '7,185.30', '40,716.70'],
  ['5', 'BMC', '1,01,322.00', '', '1,01,322.00', '15%', '15,198.30', '86,123.70'],
  ['', 'TOTAL', '7,56,127.00', '-', '7,56,127.00', '', '99,601.25', '6,56,525.75'],
];

const initialPlData = [
  ['To Opening Stock', '36,20,121.00', 'By Sales', '57,48,500.00'],
  ['To Purchases', '45,01,992.00', 'By Closing Stock', '33,82,105.00'],
  ['To Hamali & Transport', '19,750.00', 'By Gross Profit b/d', '9,88,742.00'],
  ['To Salary Expences', '2,70,000.00', '', ''],
  ['To Profit & Loss A/c', '4,97,598.00', '', ''],
  ['TOTAL', '9,88,742.00', 'TOTAL', '9,88,742.00'],
];

export default function ITRReport() {
  const { profile, appSettings } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('balance-sheet');
  const [loading, setLoading] = useState(false);

  const business = profile?.business_profiles;
  const initialBusinessName = business?.name || appSettings?.app_name || 'Your Business Name';
  const initialProprietorName = business?.owner_name || profile?.name || 'Proprietor Name';
  const initialFullAddress = [
    business?.address1,
    business?.address2,
    business?.city,
    business?.state,
    business?.pincode ? `-${business.pincode}` : ''
  ].filter(Boolean).join(', ') || 'Business Address Not Set';
  const initialPan = business?.pan_number || '';
  const initialAadhar = business?.aadhar_number || '';
  const initialMobile = business?.mobile || '';
  const initialEmail = business?.email || '';

  const [businessName, setBusinessName] = useState(initialBusinessName);
  const [proprietorName, setProprietorName] = useState(initialProprietorName);
  const [fullAddress, setFullAddress] = useState(initialFullAddress);
  const [pan, setPan] = useState(initialPan);
  const [aadhar, setAadhar] = useState(initialAadhar);
  const [mobile, setMobile] = useState(initialMobile);
  const [email, setEmail] = useState(initialEmail);
  const [status, setStatus] = useState('Individual');
  const [residentialStatus, setResidentialStatus] = useState('Resident');
  const [place, setPlace] = useState('');
  const [reportDate, setReportDate] = useState(new Date().toLocaleDateString('en-GB').replace(/\//g, '.'));

  // Calculate current financial year
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const initialFY = currentMonth < 3 
    ? `${currentYear - 1}-${currentYear.toString().slice(-2)}` 
    : `${currentYear}-${(currentYear + 1).toString().slice(-2)}`;
  
  const initialAsAtDate = `31ST MARCH ${currentMonth < 3 ? currentYear : currentYear + 1}`;

  const [asAtDate, setAsAtDate] = useState(initialAsAtDate);
  const [firmName, setFirmName] = useState('AMBADE ASSOCIATES');
  const [auditorName, setAuditorName] = useState('Parmeshwar K Ambade');
  const [auditorTitle, setAuditorTitle] = useState('Certified Auditor & Tax Consultant');
  const [signatoryPrefix, setSignatoryPrefix] = useState('FOR');
  const [proprietorPrefix, setProprietorPrefix] = useState('MR.');
  const [proprietorLabel, setProprietorLabel] = useState('PROPRIETOR.');
  const [disclaimer, setDisclaimer] = useState('Financial Statements prepared on the basis of Information & explanation provided to us by proprietor on the basis of which Income Tax Return is prepared.');

  const initialYear = initialFY.split('-')[1];
  const initialFullYear = initialYear.length === 2 ? `20${initialYear}` : initialYear;
  const initialDisplayDate = `31.03.${initialFullYear}`;

  const [bsHeaders, setBsHeaders] = useState(['LIABILITIES', initialDisplayDate, 'ASSETS', initialDisplayDate]);
  const [annexAHeaders, setAnnexAHeaders] = useState(['PARTICULARS', 'AMOUNT RS', 'PARTICULARS', 'AMOUNT RS']);
  
  const prevYearInit = initialFY.split('-')[0];
  const prevFullYearInit = prevYearInit.length === 2 ? `20${prevYearInit}` : prevYearInit;
  const [annexBHeaders, setAnnexBHeaders] = useState(['Sr.No.', 'NAME OF THE ASSET', `W.D.V 01.04.${prevFullYearInit.slice(-2)}`, 'ADDITION', 'TOTAL', 'RATE', 'DEPR.', `W.D.V ${initialDisplayDate}`]);
  
  const [plHeaders, setPlHeaders] = useState(['PARTICULARS', initialDisplayDate, 'PARTICULARS', initialDisplayDate]);

  const [bsData, setBsData] = useState(initialBsData);
  const [annexAData, setAnnexAData] = useState(initialAnnexAData);
  const [annexBData, setAnnexBData] = useState(initialAnnexBData);
  const [plData, setPlData] = useState(initialPlData);

  const [reportsByYear, setReportsByYear] = useState<Record<string, any>>({});

  const currentDate = new Date().toLocaleDateString('en-IN');
  const [financialYear, setFinancialYear] = useState(initialFY);

  // Sync with profile data when it changes
  useEffect(() => {
    if (business) {
      setBusinessName(business.name || appSettings?.app_name || 'Your Business Name');
      setProprietorName(business.owner_name || profile?.name || 'Proprietor Name');
      setFullAddress([
        business.address1,
        business.address2,
        business.city,
        business.state,
        business.pincode ? `-${business.pincode}` : ''
      ].filter(Boolean).join(', ') || 'Business Address Not Set');
      setPan(business.pan_number || '');
      setAadhar(business.aadhar_number || '');
      setMobile(business.mobile || '');
      setEmail(business.email || '');
    }
  }, [business, profile?.name, appSettings?.app_name]);

  // Update headers when financial year changes
  React.useEffect(() => {
    const year = financialYear.split('-')[1];
    const fullYear = year.length === 2 ? `20${year}` : year;
    const dDate = `31.03.${fullYear}`;
    
    setBsHeaders(prev => {
      const next = [...prev];
      if (next.length >= 4) {
        next[1] = dDate;
        next[3] = dDate;
      }
      return next;
    });
    setPlHeaders(prev => {
      const next = [...prev];
      if (next.length >= 4) {
        next[1] = dDate;
        next[3] = dDate;
      }
      return next;
    });
    setAnnexBHeaders(prev => {
      const next = [...prev];
      const prevYear = financialYear.split('-')[0];
      const prevFullYear = prevYear.length === 2 ? `20${prevYear}` : prevYear;
      if (next.length >= 8) {
        next[2] = `W.D.V 01.04.${prevFullYear.slice(-2)}`;
        next[7] = `W.D.V ${dDate}`;
      }
      return next;
    });
  }, [financialYear]);

  // Generate years from 1900 to 2100
  const fyRange = Array.from({ length: 201 }, (_, i) => {
    const startYear = 1900 + i;
    const endYear = startYear + 1;
    return `${startYear}-${endYear.toString().slice(-2)}`;
  });

  const handleFYChange = (fy: string) => {
    // Save current year's data before switching
    setReportsByYear(prev => ({
      ...prev,
      [financialYear]: {
        bsData, annexAData, annexBData, plData,
        bsHeaders, annexAHeaders, annexBHeaders, plHeaders,
        asAtDate
      }
    }));

    setFinancialYear(fy);
    const year = fy.split('-')[1];
    const fullYear = year.length === 2 ? `20${year}` : year;
    const newAsAtDate = `31ST MARCH ${fullYear}`;
    setAsAtDate(newAsAtDate);

    // Load saved data or show 0.00 for new years
    const saved = reportsByYear[fy];
    if (saved) {
      setBsData(saved.bsData);
      setAnnexAData(saved.annexAData);
      setAnnexBData(saved.annexBData);
      setPlData(saved.plData);
      setBsHeaders(saved.bsHeaders);
      setAnnexAHeaders(saved.annexAHeaders);
      setAnnexBHeaders(saved.annexBHeaders);
      setPlHeaders(saved.plHeaders);
      setAsAtDate(saved.asAtDate);
    } else {
      const zeroNumbers = (data: string[][]) => data.map(row => row.map(cell => {
        // Identify amount-like strings (containing digits, commas, or decimals)
        // but exclude serial numbers, rates (with %), or labels
        if (cell === '-' || cell === '') return cell;
        
        const isAmount = cell.match(/^[\d,]+\.\d{2}$/) || 
                        (cell.match(/^[\d,]+$/) && cell.length > 3) ||
                        (cell.includes(',') && !cell.includes('%'));

        if (isAmount) {
          return '0.00';
        }
        return cell;
      }));

      setBsData(zeroNumbers(initialBsData));
      setAnnexAData(zeroNumbers(initialAnnexAData));
      setAnnexBData(zeroNumbers(initialAnnexBData));
      setPlData(zeroNumbers(initialPlData));
      
      // Reset headers to default for new year (useEffect will handle date updates)
      const dDate = `31.03.${fullYear}`;
      setBsHeaders(['LIABILITIES', dDate, 'ASSETS', dDate]);
      setAnnexAHeaders(['PARTICULARS', 'AMOUNT RS', 'PARTICULARS', 'AMOUNT RS']);
      
      const prevYear = fy.split('-')[0];
      const prevFullYear = prevYear.length === 2 ? `20${prevYear}` : prevYear;
      setAnnexBHeaders(['Sr.No.', 'NAME OF THE ASSET', `W.D.V 01.04.${prevFullYear.slice(-2)}`, 'ADDITION', 'TOTAL', 'RATE', 'DEPR.', `W.D.V ${dDate}`]);
      setPlHeaders(['PARTICULARS', dDate, 'PARTICULARS', dDate]);
    }
  };

  const assessmentYear = financialYear.split('-').map(y => {
    const num = parseInt(y);
    if (y.length === 2) return (num + 1).toString().padStart(2, '0');
    return (num + 1).toString();
  }).join('-');

  const financialYears = [
    '2022-23',
    '2023-24',
    '2024-25',
    '2025-26',
    '2026-27',
    '2027-28'
  ];

  const getAssessmentYear = (fy: string) => {
    return fy.split('-').map(y => {
      const num = parseInt(y);
      if (y.length === 2) return (num + 1).toString().padStart(2, '0');
      return (num + 1).toString();
    }).join('-');
  };

  const displayDate = `31.03.${financialYear.split('-')[1].length === 2 ? '20' + financialYear.split('-')[1] : financialYear.split('-')[1]}`;

  // Helper functions for currency parsing and formatting
  const parseCurrency = (val: string): number => {
    if (!val || val === '-') return 0;
    const clean = val.replace(/,/g, '').trim();
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
  };

  const formatCurrency = (num: number): string => {
    return num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Live Calculations Effect
  React.useEffect(() => {
    let updated = false;
    const newBsData = [...bsData.map(r => [...r])];
    const newAnnexAData = [...annexAData.map(r => [...r])];
    const newAnnexBData = [...annexBData.map(r => [...r])];
    const newPlData = [...plData.map(r => [...r])];

    // 1. Annexure B (Depreciation Schedule) Calculations
    let totalWdv0104 = 0;
    let totalAddition = 0;
    let totalDepr = 0;
    let totalWdv3103 = 0;

    newAnnexBData.forEach((row, idx) => {
      if (row[1] && row[1].toUpperCase() !== 'TOTAL') {
        const wdv0104 = parseCurrency(row[2]);
        const addition = parseCurrency(row[3]);
        const total = wdv0104 + addition;
        
        const rateStr = row[5] || '0%';
        const rate = parseFloat(rateStr.replace('%', '')) / 100;
        const depr = total * rate;
        const wdv3103 = total - depr;

        const sTotal = formatCurrency(total);
        const sDepr = formatCurrency(depr);
        const sWdv3103 = formatCurrency(wdv3103);

        if (row[4] !== sTotal) { row[4] = sTotal; updated = true; }
        if (row[6] !== sDepr) { row[6] = sDepr; updated = true; }
        if (row[7] !== sWdv3103) { row[7] = sWdv3103; updated = true; }

        totalWdv0104 += wdv0104;
        totalAddition += addition;
        totalDepr += depr;
        totalWdv3103 += wdv3103;
      }
    });

    // Update Annexure B Total Row
    const bTotalIdx = newAnnexBData.findIndex(r => r[1] && r[1].toUpperCase() === 'TOTAL');
    if (bTotalIdx !== -1) {
      const row = newAnnexBData[bTotalIdx];
      const sWdv0104 = formatCurrency(totalWdv0104);
      const sAddition = formatCurrency(totalAddition);
      const sTotal = formatCurrency(totalWdv0104 + totalAddition);
      const sDepr = formatCurrency(totalDepr);
      const sWdv3103 = formatCurrency(totalWdv3103);

      if (row[2] !== sWdv0104) { row[2] = sWdv0104; updated = true; }
      if (row[3] !== sAddition) { row[3] = sAddition; updated = true; }
      if (row[4] !== sTotal) { row[4] = sTotal; updated = true; }
      if (row[6] !== sDepr) { row[6] = sDepr; updated = true; }
      if (row[7] !== sWdv3103) { row[7] = sWdv3103; updated = true; }
    }

    // 2. Profit & Loss Account Calculations
    let sales = 0;
    let closingStock = 0;
    let openingStock = 0;
    let purchases = 0;
    let directExpenses = 0;
    let indirectExpenses = 0;

    newPlData.forEach(row => {
      // Income side (Right)
      if (row[2]?.toUpperCase().includes('SALES')) sales += parseCurrency(row[3]);
      if (row[2]?.toUpperCase().includes('CLOSING STOCK')) closingStock += parseCurrency(row[3]);
      
      // Expense side (Left)
      if (row[0]?.toUpperCase().includes('OPENING STOCK')) openingStock += parseCurrency(row[1]);
      if (row[0]?.toUpperCase().includes('PURCHASES')) purchases += parseCurrency(row[1]);
      
      // Categorize other expenses
      if (row[0] && !row[0].toUpperCase().includes('TOTAL') && !row[0].toUpperCase().includes('PROFIT') && !row[0].toUpperCase().includes('STOCK') && !row[0].toUpperCase().includes('PURCHASES')) {
        const amt = parseCurrency(row[1]);
        // Simple heuristic: if it's above Gross Profit row, it's direct
        const gpIdx = newPlData.findIndex(r => r[2]?.toUpperCase().includes('GROSS PROFIT'));
        const currentIdx = newPlData.indexOf(row);
        if (gpIdx === -1 || currentIdx < gpIdx) {
          directExpenses += amt;
        } else {
          indirectExpenses += amt;
        }
      }
    });

    const grossProfit = sales + closingStock - openingStock - purchases - directExpenses;
    const netProfit = grossProfit - indirectExpenses - totalDepr;

    // Update P&L Rows
    const gpRowIdx = newPlData.findIndex(r => r[2]?.toUpperCase().includes('GROSS PROFIT'));
    if (gpRowIdx !== -1) {
      const sGp = formatCurrency(grossProfit);
      if (newPlData[gpRowIdx][3] !== sGp) { newPlData[gpRowIdx][3] = sGp; updated = true; }
    }

    const npRowIdx = newPlData.findIndex(r => r[0]?.toUpperCase().includes('PROFIT & LOSS A/C') || r[0]?.toUpperCase().includes('NET PROFIT'));
    if (npRowIdx !== -1) {
      const sNp = formatCurrency(netProfit);
      if (newPlData[npRowIdx][1] !== sNp) { newPlData[npRowIdx][1] = sNp; updated = true; }
    }

    // Update P&L Totals
    const plTotalIdx = newPlData.findIndex(r => r[0]?.toUpperCase() === 'TOTAL');
    if (plTotalIdx !== -1) {
      const leftTotal = openingStock + purchases + directExpenses + Math.max(0, grossProfit);
      const rightTotal = sales + closingStock;
      const sLeft = formatCurrency(leftTotal);
      const sRight = formatCurrency(rightTotal);
      if (newPlData[plTotalIdx][1] !== sLeft) { newPlData[plTotalIdx][1] = sLeft; updated = true; }
      if (newPlData[plTotalIdx][3] !== sRight) { newPlData[plTotalIdx][3] = sRight; updated = true; }
    }

    // 3. Annexure A (Capital Account) Calculations
    let capitalBF = 0;
    let drawings = 0;
    let sbInterest = 0;

    newAnnexAData.forEach(row => {
      if (row[2]?.toUpperCase().includes('CAPITAL B/F')) capitalBF = parseCurrency(row[3]);
      if (row[2]?.toUpperCase().includes('SB INTEREST')) sbInterest = parseCurrency(row[3]);
      if (row[0]?.toUpperCase().includes('DRAWINGS')) drawings = parseCurrency(row[1]);
    });

    // Update P&L value in Annexure A
    const aPlRowIdx = newAnnexAData.findIndex(r => r[2]?.toUpperCase().includes('PROFIT & LOSS A/C'));
    if (aPlRowIdx !== -1) {
      const sNp = formatCurrency(netProfit);
      if (newAnnexAData[aPlRowIdx][3] !== sNp) { newAnnexAData[aPlRowIdx][3] = sNp; updated = true; }
    }

    const closingBalance = capitalBF + netProfit + sbInterest - drawings;
    const aCbRowIdx = newAnnexAData.findIndex(r => r[0]?.toUpperCase().includes('CLOSING BALANCE'));
    if (aCbRowIdx !== -1) {
      const sCb = formatCurrency(closingBalance);
      if (newAnnexAData[aCbRowIdx][1] !== sCb) { newAnnexAData[aCbRowIdx][1] = sCb; updated = true; }
    }

    // Update Annexure A Totals
    const aTotalIdx = newAnnexAData.findIndex(r => r[0]?.toUpperCase() === 'TOTAL');
    if (aTotalIdx !== -1) {
      const total = capitalBF + netProfit + sbInterest;
      const sTotal = formatCurrency(total);
      if (newAnnexAData[aTotalIdx][1] !== sTotal) { newAnnexAData[aTotalIdx][1] = sTotal; updated = true; }
      if (newAnnexAData[aTotalIdx][3] !== sTotal) { newAnnexAData[aTotalIdx][3] = sTotal; updated = true; }
    }

    // 4. Balance Sheet Calculations
    // Update Capital and Fixed Assets from Annexures
    const bsCapRowIdx = newBsData.findIndex(r => r[0]?.toUpperCase().includes('CAPITAL ACCOUNT'));
    if (bsCapRowIdx !== -1) {
      const sCb = formatCurrency(closingBalance);
      if (newBsData[bsCapRowIdx][1] !== sCb) { newBsData[bsCapRowIdx][1] = sCb; updated = true; }
    }

    const bsFaRowIdx = newBsData.findIndex(r => r[2]?.toUpperCase().includes('FIXED ASSETS'));
    if (bsFaRowIdx !== -1) {
      const sWdv = formatCurrency(totalWdv3103);
      if (newBsData[bsFaRowIdx][3] !== sWdv) { newBsData[bsFaRowIdx][3] = sWdv; updated = true; }
    }

    // Update Balance Sheet Totals
    let totalLiabilities = 0;
    let totalAssets = 0;
    newBsData.forEach(row => {
      if (row[0] && !row[0].toUpperCase().includes('TOTAL')) totalLiabilities += parseCurrency(row[1]);
      if (row[2] && !row[2].toUpperCase().includes('TOTAL')) totalAssets += parseCurrency(row[3]);
    });

    const bsTotalIdx = newBsData.findIndex(r => r[0]?.toUpperCase() === 'TOTAL');
    if (bsTotalIdx !== -1) {
      const sL = formatCurrency(totalLiabilities);
      const sA = formatCurrency(totalAssets);
      if (newBsData[bsTotalIdx][1] !== sL) { newBsData[bsTotalIdx][1] = sL; updated = true; }
      if (newBsData[bsTotalIdx][3] !== sA) { newBsData[bsTotalIdx][3] = sA; updated = true; }
    }

    if (updated) {
      setBsData(newBsData);
      setAnnexAData(newAnnexAData);
      setAnnexBData(newAnnexBData);
      setPlData(newPlData);
    }
  }, [bsData, annexAData, annexBData, plData]);

  // Helper functions for table manipulation
  const handleHeaderChange = (setHeaders: React.Dispatch<React.SetStateAction<string[]>>, index: number, value: string) => {
    setHeaders(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleAddColumn = (setHeaders: React.Dispatch<React.SetStateAction<string[]>>, setData: React.Dispatch<React.SetStateAction<string[][]>>, index: number) => {
    setHeaders(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, 'New Column');
      return next;
    });
    setData(prev => prev.map(row => {
      const next = [...row];
      next.splice(index + 1, 0, '');
      return next;
    }));
  };

  const handleDeleteColumn = (setHeaders: React.Dispatch<React.SetStateAction<string[]>>, setData: React.Dispatch<React.SetStateAction<string[][]>>, index: number) => {
    setHeaders(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
    setData(prev => prev.map(row => row.filter((_, i) => i !== index)));
  };

  const handleInsertRow = (setData: React.Dispatch<React.SetStateAction<string[][]>>, index: number, colCount: number) => {
    setData(prev => {
      const next = [...prev];
      next.splice(index + 1, 0, Array(colCount).fill(''));
      return next;
    });
  };

  const handleDataChange = (
    setData: React.Dispatch<React.SetStateAction<string[][]>>,
    rowIndex: number,
    colIndex: number,
    value: string,
    headersCount: number
  ) => {
    setData(prev => {
      const next = prev.map(r => [...r]);
      next[rowIndex][colIndex] = value;
      
      // Auto-add row logic:
      // If we are editing the row just before the TOTAL row, and it's not empty
      const totalIdx = next.findIndex(r => r.some(cell => cell && cell.toString().toUpperCase() === 'TOTAL'));
      if (totalIdx !== -1 && rowIndex === totalIdx - 1) {
        const isRowEmpty = next[rowIndex].every(cell => !cell || cell === '-');
        if (!isRowEmpty) {
          // Insert a new empty row before the TOTAL row
          next.splice(totalIdx, 0, Array(headersCount).fill(''));
        }
      }
      
      return next;
    });
  };

  const tabs = [
    { id: 'balance-sheet', label: 'Balance Sheet' },
    { id: 'annexure-a', label: 'Annexure A' },
    { id: 'annexure-b', label: 'Annexure B' },
    { id: 'profit-loss', label: 'Profit & Loss Account' },
  ];

  const downloadExcel = async (mode: 'all' | 'single' = 'all') => {
    try {
      setLoading(true);
      const workbook = new ExcelJS.Workbook();
      
      // Helper to add sheet with formatting
      const addFormattedSheet = (name: string, title: string, headers: string[], body: any[][]) => {
        const worksheet = workbook.addWorksheet(name);
        
        // Add header rows
        const headerRows = [
          [businessName.toUpperCase()],
          [fullAddress],
          [title],
          []
        ];
        
        headerRows.forEach((row, i) => {
          const r = worksheet.addRow(row);
          worksheet.mergeCells(i + 1, 1, i + 1, headers.length);
          r.alignment = { vertical: 'middle', horizontal: 'center' };
          if (i === 0 || i === 2) r.font = { bold: true, size: 12 };
        });

        // Add table headers
        const headerRow = worksheet.addRow(headers);
        headerRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF0F0F0' }
          };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Add data rows
        body.forEach((rowData) => {
          const r = worksheet.addRow(rowData);
          r.eachCell((cell, colNumber) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            };
            // Align numbers to right, others to left/center
            const val = rowData[colNumber - 1];
            if (typeof val === 'string' && (val.includes(',') || (val.length > 0 && !isNaN(Number(val.replace(/,/g, '')))))) {
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left' };
            }
          });
        });

        // Add disclaimer
        worksheet.addRow([]);
        const disclaimerRow = worksheet.addRow([disclaimer]);
        worksheet.mergeCells(disclaimerRow.number, 1, disclaimerRow.number, headers.length);
        disclaimerRow.font = { italic: true, size: 10 };
        disclaimerRow.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

        // Add footer
        worksheet.addRow([]);
        const footerRow1 = worksheet.addRow([`${signatoryPrefix} ${firmName}.`, '', '', businessName.toUpperCase()]);
        worksheet.mergeCells(footerRow1.number, 1, footerRow1.number, Math.floor(headers.length / 2));
        worksheet.mergeCells(footerRow1.number, Math.floor(headers.length / 2) + 1, footerRow1.number, headers.length);
        footerRow1.font = { bold: true };
        
        const footerRow2 = worksheet.addRow([auditorName, '', '', `${proprietorPrefix} ${proprietorName.toUpperCase()}.`]);
        worksheet.mergeCells(footerRow2.number, 1, footerRow2.number, Math.floor(headers.length / 2));
        worksheet.mergeCells(footerRow2.number, Math.floor(headers.length / 2) + 1, footerRow2.number, headers.length);
        footerRow2.font = { bold: true };

        const footerRow3 = worksheet.addRow([`(${auditorTitle}.)`, '', '', proprietorLabel.toUpperCase()]);
        worksheet.mergeCells(footerRow3.number, 1, footerRow3.number, Math.floor(headers.length / 2));
        worksheet.mergeCells(footerRow3.number, Math.floor(headers.length / 2) + 1, footerRow3.number, headers.length);
        footerRow3.font = { size: 10 };

        const footerRow4 = worksheet.addRow([`PLACE : ${place || '-'}`, '', '', '']);
        worksheet.mergeCells(footerRow4.number, 1, footerRow4.number, Math.floor(headers.length / 2));
        footerRow4.font = { size: 10 };

        const footerRow5 = worksheet.addRow([`DATE : ${reportDate}`, '', '', '']);
        worksheet.mergeCells(footerRow5.number, 1, footerRow5.number, Math.floor(headers.length / 2));
        footerRow5.font = { size: 10 };

        // Set column widths
        worksheet.columns.forEach((col) => {
          col.width = 25;
        });
      };

      if (mode === 'all' || activeTab === 'balance-sheet') {
        addFormattedSheet('Balance Sheet', `BALANCE SHEET AS AT ${asAtDate}`, bsHeaders, bsData);
      }
      if (mode === 'all' || activeTab === 'annexure-a') {
        addFormattedSheet('Annexure A', 'ANNEXURE-A: CAPITAL ACCOUNT AS AT ' + asAtDate, annexAHeaders, annexAData);
      }
      if (mode === 'all' || activeTab === 'annexure-b') {
        addFormattedSheet('Annexure B', 'ANNEXURE-B: DEPRECIATION SCHEDULE AS AT ' + asAtDate, annexBHeaders, annexBData);
      }
      if (mode === 'all' || activeTab === 'profit-loss') {
        addFormattedSheet('Profit & Loss', `PROFIT & LOSS ACCOUNT FOR THE YEAR ENDED ${asAtDate}`, plHeaders, plData);
      }

      // Add Info Sheet
      const infoSheet = workbook.addWorksheet('Business Info');
      infoSheet.addRow(['FIELD', 'VALUE']).font = { bold: true };
      infoSheet.addRow(['Business Name', businessName]);
      infoSheet.addRow(['Proprietor', proprietorName]);
      infoSheet.addRow(['PAN', pan]);
      infoSheet.addRow(['Aadhar', aadhar]);
      infoSheet.addRow(['Mobile', mobile]);
      infoSheet.addRow(['Email', email]);
      infoSheet.addRow(['Status', status]);
      infoSheet.addRow(['Residential Status', residentialStatus]);
      infoSheet.addRow(['Financial Year', financialYear]);
      infoSheet.addRow(['Assessment Year', assessmentYear]);
      infoSheet.columns.forEach(c => c.width = 30);

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = mode === 'all' ? `ITR_All_Reports_${businessName.replace(/\s+/g, '_')}.xlsx` : `ITR_${activeTab}_${businessName.replace(/\s+/g, '_')}.xlsx`;
      await downloadFile(blob, fileName);
      setLoading(false);
    } catch (error) {
      console.error('Excel Generation Error:', error);
      setLoading(false);
      alert('Failed to generate Excel. Please try again.');
    }
  };

  const downloadPDF = (mode: 'all' | 'single' = 'all') => {
    try {
      setLoading(true);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      const centerText = (text: string, y: number, size = 12, style = 'normal') => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        const textWidth = doc.getTextWidth(text);
        doc.text(text, (pageWidth - textWidth) / 2, y);
      };

      const addFooter = (y: number) => {
        const footerHeight = 65;
        let currentY = y;
        
        // If not enough space on current page, add new page
        if (currentY + footerHeight > pageHeight) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth - 30);
        doc.text(splitDisclaimer, 15, currentY);
        
        const footerStartY = currentY + (splitDisclaimer.length * 5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${signatoryPrefix} ${firmName}.`, 15, footerStartY + 10);
        doc.text(businessName.toUpperCase(), pageWidth - 50, footerStartY + 10);
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${auditorName}.`, 15, footerStartY + 35);
        doc.text(`${proprietorPrefix} ${proprietorName.toUpperCase()}.`, pageWidth - 50, footerStartY + 35);
        
        doc.setFont('helvetica', 'normal');
        doc.text(`(${auditorTitle}.)`, 15, footerStartY + 40);
        doc.text(proprietorLabel.toUpperCase(), pageWidth - 50, footerStartY + 40);
        
        doc.text(`PLACE : ${place || '-'}`, 15, footerStartY + 50);
        doc.text(`DATE : ${reportDate}`, 15, footerStartY + 55);
      };

      let isFirstPage = true;

      const addReportToPDF = (title: string, subtitle: string, headers: string[][], body: any[][], showAddress = true) => {
        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        centerText(businessName.toUpperCase(), 15, 14, 'bold');
        if (showAddress) centerText(fullAddress, 22, 9);
        
        // Add PAN/Status info in PDF header
        doc.setFontSize(8);
        doc.text(`PAN: ${pan || '-'}`, 15, 30);
        doc.text(`Status: ${status}`, 15, 34);
        doc.text(`AY: ${assessmentYear}`, pageWidth - 40, 30);
        doc.text(`FY: ${financialYear}`, pageWidth - 40, 34);

        centerText(title, 45, 12, 'bold');
        if (subtitle) centerText(subtitle, 53, 11, 'bold');

        autoTable(doc, {
          startY: subtitle ? 60 : 55,
          head: headers,
          body: body,
          theme: 'grid',
          headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontSize: headers[0].length > 4 ? 7 : 10 },
          styles: { fontSize: headers[0].length > 4 ? 7 : 10 },
          columnStyles: headers[0].length === 4 ? { 1: { halign: 'right' }, 3: { halign: 'right' } } : {}
        });

        const finalY = (doc as any).lastAutoTable.finalY + 20;
        
        // Use the addFooter function to add the signatory section
        addFooter(finalY);
      };

      if (mode === 'all' || activeTab === 'balance-sheet') {
        addReportToPDF(`BALANCE SHEET AS AT ${asAtDate}.`, '', [bsHeaders], bsData);
      }
      if (mode === 'all' || activeTab === 'annexure-a') {
        addReportToPDF('ANNEXURE-A', `CAPITAL ACCOUNT AS AT ${asAtDate}.`, [annexAHeaders], annexAData, false);
      }
      if (mode === 'all' || activeTab === 'annexure-b') {
        addReportToPDF('ANNEXURE-B', `DEPRECIATION SCHEDULE AS AT ${asAtDate}.`, [annexBHeaders], annexBData, false);
      }
      if (mode === 'all' || activeTab === 'profit-loss') {
        addReportToPDF(`PROFIT & LOSS ACCOUNT FOR THE YEAR ENDED ${asAtDate}.`, '', [plHeaders], plData);
      }

      const fileName = mode === 'all' ? `ITR_All_Reports_${businessName.replace(/\s+/g, '_')}.pdf` : `ITR_${activeTab}_${businessName.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      setLoading(false);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      setLoading(false);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText size={24} />
            </div>
            <div className="flex flex-col">
              <span>ITR Financial Report</span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assessment Year:</span>
                <select 
                  value={financialYear} 
                  onChange={(e) => handleFYChange(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer border-b border-slate-200 hover:border-primary transition-colors"
                >
                  {financialYears.map(fy => (
                    <option key={fy} value={fy}>
                      AY {getAssessmentYear(fy)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => downloadExcel('all')}
              disabled={loading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm transition-all active:scale-95"
            >
              <FileSpreadsheet size={18} className="mr-2 text-emerald-600" />
              Excel
            </button>
            <button 
              onClick={() => downloadPDF('all')}
              disabled={loading}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-50 flex items-center shadow-sm transition-all active:scale-95"
            >
              <Download size={18} className="mr-2 text-red-600" />
              PDF
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* Main Content */}
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm no-print">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="text-xs font-bold text-slate-900 bg-transparent outline-none cursor-pointer"
                >
                  <option value="Individual">Individual</option>
                  <option value="HUF">HUF</option>
                  <option value="Firm">Firm</option>
                  <option value="Company">Company</option>
                </select>
              </div>
            </div>
            
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {(['balance-sheet', 'annexure-a', 'annexure-b', 'profit-loss'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-lg transition-all",
                    activeTab === tab
                      ? "bg-white text-primary shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {tab.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Content Area */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-6 print-container">
            <div className="p-8 overflow-x-auto print-content">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="min-w-[800px] space-y-8"
                >
                  {/* Common Header for all tabs */}
                  <div className="text-center space-y-1 no-print-inputs">
                    <input 
                      type="text" 
                      value={businessName} 
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="text-xl font-bold text-slate-900 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-center uppercase"
                    />
                    {activeTab === 'balance-sheet' || activeTab === 'profit-loss' ? (
                      <input 
                        type="text" 
                        value={fullAddress} 
                        onChange={(e) => setFullAddress(e.target.value)}
                        className="text-sm text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-center uppercase"
                      />
                    ) : (
                      <p className="text-sm font-bold text-slate-900">{activeTab === 'annexure-a' ? 'ANNEXURE-A' : 'ANNEXURE-B'}</p>
                    )}
                    <div className="flex justify-center">
                      <input 
                        type="text" 
                        value={activeTab === 'balance-sheet' ? `BALANCE SHEET AS AT ${asAtDate}` : 
                               activeTab === 'annexure-a' ? `CAPITAL ACCOUNT AS AT ${asAtDate}` :
                               activeTab === 'annexure-b' ? `DEPRECIATION SCHEDULE AS AT ${asAtDate}` :
                               `PROFIT & LOSS ACCOUNT FOR THE YEAR ENDED ${asAtDate}`}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (activeTab === 'balance-sheet' && val.startsWith('BALANCE SHEET AS AT ')) setAsAtDate(val.replace('BALANCE SHEET AS AT ', ''));
                          else if (activeTab === 'annexure-a' && val.startsWith('CAPITAL ACCOUNT AS AT ')) setAsAtDate(val.replace('CAPITAL ACCOUNT AS AT ', ''));
                          else if (activeTab === 'annexure-b' && val.startsWith('DEPRECIATION SCHEDULE AS AT ')) setAsAtDate(val.replace('DEPRECIATION SCHEDULE AS AT ', ''));
                          else if (activeTab === 'profit-loss' && val.startsWith('PROFIT & LOSS ACCOUNT FOR THE YEAR ENDED ')) setAsAtDate(val.replace('PROFIT & LOSS ACCOUNT FOR THE YEAR ENDED ', ''));
                        }}
                        className="text-md font-bold text-slate-800 mt-4 underline decoration-2 underline-offset-4 uppercase bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-center w-full"
                      />
                    </div>
                  </div>

                  {/* Tab Content */}
                  {activeTab === 'balance-sheet' && (
                    <EditableTable 
                      headers={bsHeaders}
                      data={bsData}
                      onChange={(r, c, v) => {
                        handleDataChange(setBsData, r, c, v, bsHeaders.length);
                      }}
                      onAddRow={() => setBsData([...bsData, Array(bsHeaders.length).fill('')])}
                      onDeleteRow={(i) => setBsData(bsData.filter((_, idx) => idx !== i))}
                      onInsertRow={(i) => handleInsertRow(setBsData, i, bsHeaders.length)}
                      onAddColumn={(i) => handleAddColumn(setBsHeaders, setBsData, i)}
                      onDeleteColumn={(i) => handleDeleteColumn(setBsHeaders, setBsData, i)}
                      onHeaderChange={(i, v) => handleHeaderChange(setBsHeaders, i, v)}
                    />
                  )}
                  {activeTab === 'annexure-a' && (
                    <EditableTable 
                      headers={annexAHeaders}
                      data={annexAData}
                      onChange={(r, c, v) => {
                        handleDataChange(setAnnexAData, r, c, v, annexAHeaders.length);
                      }}
                      onAddRow={() => setAnnexAData([...annexAData, Array(annexAHeaders.length).fill('')])}
                      onDeleteRow={(i) => setAnnexAData(annexAData.filter((_, idx) => idx !== i))}
                      onInsertRow={(i) => handleInsertRow(setAnnexAData, i, annexAHeaders.length)}
                      onAddColumn={(i) => handleAddColumn(setAnnexAHeaders, setAnnexAData, i)}
                      onDeleteColumn={(i) => handleDeleteColumn(setAnnexAHeaders, setAnnexAData, i)}
                      onHeaderChange={(i, v) => handleHeaderChange(setAnnexAHeaders, i, v)}
                    />
                  )}
                  {activeTab === 'annexure-b' && (
                    <EditableTable 
                      headers={annexBHeaders}
                      data={annexBData}
                      onChange={(r, c, v) => {
                        handleDataChange(setAnnexBData, r, c, v, annexBHeaders.length);
                      }}
                      onAddRow={() => setAnnexBData([...annexBData, Array(annexBHeaders.length).fill('')])}
                      onDeleteRow={(i) => setAnnexBData(annexBData.filter((_, idx) => idx !== i))}
                      onInsertRow={(i) => handleInsertRow(setAnnexBData, i, annexBHeaders.length)}
                      onAddColumn={(i) => handleAddColumn(setAnnexBHeaders, setAnnexBData, i)}
                      onDeleteColumn={(i) => handleDeleteColumn(setAnnexBHeaders, setAnnexBData, i)}
                      onHeaderChange={(i, v) => handleHeaderChange(setAnnexBHeaders, i, v)}
                    />
                  )}
                  {activeTab === 'profit-loss' && (
                    <EditableTable 
                      headers={plHeaders}
                      data={plData}
                      onChange={(r, c, v) => {
                        handleDataChange(setPlData, r, c, v, plHeaders.length);
                      }}
                      onAddRow={() => setPlData([...plData, Array(plHeaders.length).fill('')])}
                      onDeleteRow={(i) => setPlData(plData.filter((_, idx) => idx !== i))}
                      onInsertRow={(i) => handleInsertRow(setPlData, i, plHeaders.length)}
                      onAddColumn={(i) => handleAddColumn(setPlHeaders, setPlData, i)}
                      onDeleteColumn={(i) => handleDeleteColumn(setPlHeaders, setPlData, i)}
                      onHeaderChange={(i, v) => handleHeaderChange(setPlHeaders, i, v)}
                    />
                  )}

                  {/* Disclaimer */}
                  <div className="mt-4 text-[11px] text-slate-700 leading-relaxed no-print-inputs">
                    <textarea 
                      value={disclaimer} 
                      onChange={(e) => setDisclaimer(e.target.value)}
                      className="w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none resize-none"
                      rows={2}
                    />
                  </div>

                  {/* Common Footer */}
                  <div className="pt-12 grid grid-cols-2 gap-12 text-sm no-print-inputs">
                    <div className="space-y-12">
                      <div className="flex items-center gap-1">
                        <input 
                          type="text" 
                          value={signatoryPrefix} 
                          onChange={(e) => setSignatoryPrefix(e.target.value)}
                          className="font-bold w-12 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none uppercase"
                        />
                        <input 
                          type="text" 
                          value={firmName} 
                          onChange={(e) => setFirmName(e.target.value)}
                          className="font-bold w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none uppercase"
                        />
                        <span className="font-bold">.</span>
                      </div>
                      <div className="space-y-1">
                        <input 
                          type="text" 
                          value={auditorName} 
                          onChange={(e) => setAuditorName(e.target.value)}
                          className="font-bold w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none"
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500">(</span>
                          <input 
                            type="text" 
                            value={auditorTitle} 
                            onChange={(e) => setAuditorTitle(e.target.value)}
                            className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none"
                          />
                          <span className="text-xs text-slate-500">.)</span>
                        </div>
                        <div className="flex items-center gap-1 mt-4">
                          <span className="text-xs text-slate-500 whitespace-nowrap">PLACE :</span>
                          <input 
                            type="text" 
                            value={place} 
                            onChange={(e) => setPlace(e.target.value)}
                            className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none"
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-500 whitespace-nowrap">DATE :</span>
                          <input 
                            type="text" 
                            value={reportDate} 
                            onChange={(e) => setReportDate(e.target.value)}
                            className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-12 text-right">
                      <input 
                        type="text" 
                        value={businessName} 
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="font-bold w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-right uppercase"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center justify-end gap-1">
                          <input 
                            type="text" 
                            value={proprietorPrefix} 
                            onChange={(e) => setProprietorPrefix(e.target.value)}
                            className="font-bold w-10 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-right uppercase"
                          />
                          <input 
                            type="text" 
                            value={proprietorName} 
                            onChange={(e) => setProprietorName(e.target.value)}
                            className="font-bold bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-right uppercase"
                          />
                          <span className="font-bold">.</span>
                        </div>
                        <input 
                          type="text" 
                          value={proprietorLabel} 
                          onChange={(e) => setProprietorLabel(e.target.value)}
                          className="text-xs text-slate-500 w-full bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary outline-none text-right uppercase"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 mt-8 no-print">
            <button 
              onClick={() => downloadExcel('single')}
              disabled={loading}
              className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 flex items-center shadow-sm transition-all active:scale-95"
            >
              <FileSpreadsheet size={20} className="mr-2 text-emerald-600" />
              Download Current (Excel)
            </button>
            <button 
              onClick={() => downloadPDF('single')}
              disabled={loading}
              className="px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-slate-50 flex items-center shadow-sm transition-all active:scale-95"
            >
              <Download size={20} className="mr-2 text-red-600" />
              Download Current (PDF)
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Download Section */}
      <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6 no-print">
        <div className="text-center md:text-left">
          <h3 className="text-lg font-bold text-slate-900">Download All Reports</h3>
          <p className="text-sm text-slate-500 mt-1">Get Balance Sheet, Annexures, and P&L in a single file</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => downloadExcel('all')}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 font-bold"
          >
            <FileSpreadsheet size={20} />
            All Excel Report
          </button>
          <button
            onClick={() => downloadPDF('all')}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl hover:bg-primary/90 transition-all shadow-xl shadow-primary/10 font-bold disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <Download size={20} />
            )}
            All PDF Report
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-components for Tables
function EditableTable({ 
  headers, 
  data, 
  onChange, 
  onAddRow, 
  onDeleteRow,
  onInsertRow,
  onAddColumn,
  onDeleteColumn,
  onHeaderChange
}: { 
  headers: string[], 
  data: string[][], 
  onChange: (rowIndex: number, colIndex: number, value: string) => void,
  onAddRow: () => void,
  onDeleteRow: (index: number) => void,
  onInsertRow: (index: number) => void,
  onAddColumn: (index: number) => void,
  onDeleteColumn: (index: number) => void,
  onHeaderChange: (index: number, value: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-slate-300 text-sm min-w-max">
          <thead>
            <tr className="bg-slate-50">
              {headers.map((h, i) => (
                <th key={i} className="border border-slate-300 p-0 relative group">
                  <input
                    type="text"
                    value={h}
                    onChange={(e) => onHeaderChange(i, e.target.value)}
                    className="w-full px-2 py-1.5 bg-transparent font-bold text-left outline-none focus:bg-blue-50/50 text-[11px]"
                  />
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity no-print z-10">
                    <button 
                      onClick={() => onAddColumn(i)}
                      className="bg-primary text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"
                      title="Add Column Right"
                    >
                      <Plus size={10} />
                    </button>
                    <button 
                      onClick={() => onDeleteColumn(i)}
                      className="bg-red-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"
                      title="Delete Column"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="border border-slate-300 p-3 w-10 no-print"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="group">
                {row.map((cell, colIndex) => (
                  <td key={colIndex} className="border border-slate-300 p-0">
                    <input
                      type="text"
                      value={cell}
                      onChange={(e) => onChange(rowIndex, colIndex, e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent focus:bg-blue-50/30 outline-none transition-colors text-[11px]"
                    />
                  </td>
                ))}
                <td className="border border-slate-300 p-2 text-center no-print">
                  <div className="flex items-center justify-center gap-2">
                    <button 
                      onClick={() => onInsertRow(rowIndex)}
                      className="text-primary opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Insert Row Below"
                    >
                      <Plus size={16} />
                    </button>
                    <button 
                      onClick={() => onDeleteRow(rowIndex)}
                      className="text-red-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={onAddRow}
        className="flex items-center gap-2 text-primary font-bold text-xs hover:underline no-print"
      >
        <Plus size={14} /> Add Row at End
      </button>
    </div>
  );
}
