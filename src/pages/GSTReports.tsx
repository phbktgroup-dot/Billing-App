import React, { useState, useEffect, useMemo } from 'react';
import { Download, FileText, PieChart, Table as TableIcon, Loader2, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import PageHeader from '../components/PageHeader';
import { DateFilter } from '../components/DateFilter';
import { FilterType, cn, formatCurrency, getDateRange } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type GSTReportType = 'GSTR-1' | 'GSTR-3B' | 'GSTR-2A';

export default function GSTReports() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<GSTReportType>('GSTR-1');
  const [filterType, setFilterType] = useState<FilterType>('thisMonth');
  const [customRange, setCustomRange] = useState<{start: string, end: string}>({start: '', end: ''});
  const getLocalToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const [day, setDay] = useState<string>(getLocalToday());
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);

  const businessId = profile?.business_id;

  useEffect(() => {
    if (businessId) {
      fetchData();
    }
  }, [businessId, filterType, customRange, day, year]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(filterType, day, year, customRange);

      // Fetch Invoices with items and customer details
      const { data: invData, error: invError } = await supabase
        .from('invoices')
        .select(`
          *,
          customers (*),
          invoice_items (
            *,
            products (*)
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (invError) throw invError;
      setInvoices(invData || []);

      // Fetch Purchases (Expenses/Purchases)
      const { data: purData, error: purError } = await supabase
        .from('purchases')
        .select(`
          *,
          suppliers (*),
          purchase_items (
            *,
            products (*)
          )
        `)
        .eq('business_id', businessId)
        .gte('date', startDate.toISOString().split('T')[0])
        .lte('date', endDate.toISOString().split('T')[0]);

      if (purError) throw purError;
      setPurchases(purData || []);

    } catch (error: any) {
      console.error('Error fetching GST data:', error);
    } finally {
      setLoading(false);
    }
  };

  const gstr1Data = useMemo(() => {
    const b2b = invoices.filter(inv => inv.customers?.gstin);
    const b2c = invoices.filter(inv => !inv.customers?.gstin);
    
    // B2CL: Inter-state, value > 2,50,000
    const b2cl = b2c.filter(inv => {
      const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
      return isInterState && inv.total > 250000;
    });

    // B2CS: All other B2C
    const b2cs = b2c.filter(inv => !b2cl.includes(inv));

    // HSN Summary
    const hsnMap = new Map();
    const hsnB2BMap = new Map();
    const hsnB2CMap = new Map();

    const updateHsnMap = (map: Map<string, any>, item: any, inv: any, isInterState: boolean) => {
      const hsn = item.products?.hsn_code || 'NA';
      const rate = item.gst_rate || 0;
      const key = `${hsn}-${rate}`;
      
      if (!map.has(key)) {
        map.set(key, {
          hsn,
          description: item.products?.name || '',
          uqc: 'NOS-Numbers',
          totalQuantity: 0,
          totalValue: 0,
          rate,
          taxableValue: 0,
          integratedTax: 0,
          centralTax: 0,
          stateTax: 0,
          cess: 0
        });
      }
      
      const entry = map.get(key);
      entry.totalQuantity += item.quantity || 0;
      entry.totalValue += item.amount || 0;
      entry.taxableValue += (item.unit_price * item.quantity) || 0;
      
      const tax = (item.unit_price * item.quantity * rate) / 100;
      
      if (isInterState) {
        entry.integratedTax += tax;
      } else {
        entry.centralTax += tax / 2;
        entry.stateTax += tax / 2;
      }
    };

    invoices.forEach(inv => {
      const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
      const isB2B = !!inv.customers?.gstin;

      inv.invoice_items?.forEach((item: any) => {
        updateHsnMap(hsnMap, item, inv, isInterState);
        if (isB2B) {
          updateHsnMap(hsnB2BMap, item, inv, isInterState);
        } else {
          updateHsnMap(hsnB2CMap, item, inv, isInterState);
        }
      });
    });

    return {
      b2b,
      b2cl,
      b2cs,
      hsn: Array.from(hsnMap.values()),
      hsnB2B: Array.from(hsnB2BMap.values()),
      hsnB2C: Array.from(hsnB2CMap.values())
    };
  }, [invoices, profile]);

  const getGSTR1Workbook = () => {
    const workbook = XLSX.utils.book_new();

    // B2B Sheet
    const b2bRows = gstr1Data.b2b.map(inv => ({
      'GSTIN/UIN of Recipient': inv.customers?.gstin,
      'Receiver Name': inv.customers?.name,
      'Invoice Number': inv.invoice_number,
      'Invoice date': inv.date,
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Reverse Charge': 'N',
      'Applicable % of Tax Rate': 0,
      'Invoice Type': 'Regular B2B',
      'E-Commerce GSTIN': '',
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0
    }));
    const b2bWS = XLSX.utils.json_to_sheet(b2bRows);
    XLSX.utils.book_append_sheet(workbook, b2bWS, 'B2B');

    // B2CL Sheet
    const b2clRows = gstr1Data.b2cl.map(inv => ({
      'Invoice Number': inv.invoice_number,
      'Invoice date': inv.date,
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': 0,
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    const b2clWS = XLSX.utils.json_to_sheet(b2clRows);
    XLSX.utils.book_append_sheet(workbook, b2clWS, 'B2CL');

    // B2CS Sheet
    const b2csRows = gstr1Data.b2cs.map(inv => ({
      'Type': 'OE',
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': 0,
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    const b2csWS = XLSX.utils.json_to_sheet(b2csRows);
    XLSX.utils.book_append_sheet(workbook, b2csWS, 'B2CS');

    // HSN Sheet
    const hsnRows = gstr1Data.hsn.map(item => ({
      'HSN': item.hsn,
      'Description': item.description,
      'UQC': item.uqc,
      'Total Quantity': item.totalQuantity,
      'Total Value': item.totalValue,
      'Rate': item.rate,
      'Taxable Value': item.taxableValue,
      'Integrated Tax Amount': item.integratedTax,
      'Central Tax Amount': item.centralTax,
      'State/UT Tax Amount': item.stateTax,
      'Cess Amount': item.cess
    }));
    const hsnWS = XLSX.utils.json_to_sheet(hsnRows);
    XLSX.utils.book_append_sheet(workbook, hsnWS, 'HSN');

    // Doc Summary Sheet
    const docRows = [
      { 
        'Nature of Document': 'Invoices for outward supply', 
        'Sr. No. From': invoices.length > 0 ? invoices[invoices.length - 1].invoice_number : 'NA', 
        'Sr. No. To': invoices.length > 0 ? invoices[0].invoice_number : 'NA', 
        'Total Number': invoices.length, 
        'Cancelled': 0 
      }
    ];
    const docWS = XLSX.utils.json_to_sheet(docRows);
    XLSX.utils.book_append_sheet(workbook, docWS, 'Docs');

    return workbook;
  };

  const populateGSTR1Folder = (folder: JSZip) => {
    const addCsvToZip = (filename: string, rows: any[], headers: string[]) => {
      let csv = '';
      if (rows.length === 0) {
        csv = headers.join(',') + '\n';
      } else {
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        csv = XLSX.utils.sheet_to_csv(ws);
      }
      folder.file(filename, csv);
    };

    const formatDate = (dateString: string) => {
      const d = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    // 1. b2b.csv
    const b2bHeaders = ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount'];
    const b2bRows = gstr1Data.b2b.map(inv => ({
      'GSTIN/UIN of Recipient': inv.customers?.gstin || '',
      'Receiver Name': inv.customers?.name || '',
      'Invoice Number': inv.invoice_number,
      'Invoice date': formatDate(inv.date),
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Reverse Charge': 'N',
      'Applicable % of Tax Rate': '',
      'Invoice Type': 'Regular B2B',
      'E-Commerce GSTIN': '',
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0
    }));
    addCsvToZip('b2b.csv', b2bRows, b2bHeaders);

    // 2. b2cl.csv (B2C Large - Inter-state > 2.5 Lakh)
    const b2clHeaders = ['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'];
    const b2clInvoices = invoices.filter(inv => !inv.customers?.gstin && inv.total > 250000 && inv.customers?.state && inv.customers?.state !== profile?.state);
    const b2clRows = b2clInvoices.map(inv => ({
      'Invoice Number': inv.invoice_number,
      'Invoice date': formatDate(inv.date),
      'Invoice Value': inv.total,
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': '',
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    addCsvToZip('b2cl.csv', b2clRows, b2clHeaders);

    // 3. b2cs.csv (B2C Small)
    const b2csHeaders = ['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN'];
    const b2csRows = gstr1Data.b2cs.filter(inv => !(inv.total > 250000 && inv.customers?.state && inv.customers?.state !== profile?.state)).map(inv => ({
      'Type': 'OE',
      'Place Of Supply': inv.customers?.state || '27-Maharashtra',
      'Applicable % of Tax Rate': '',
      'Rate': inv.invoice_items?.[0]?.gst_rate || 0,
      'Taxable Value': inv.subtotal,
      'Cess Amount': 0,
      'E-Commerce GSTIN': ''
    }));
    addCsvToZip('b2cs.csv', b2csRows, b2csHeaders);

    // 4. cdnr.csv (Credit/Debit Notes Registered)
    const cdnrHeaders = ['GSTIN/UIN of Recipient', 'Receiver Name', 'Note/Refund Voucher Number', 'Note/Refund Voucher date', 'Document Type', 'Place Of Supply', 'Note/Refund Voucher Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'Pre GST'];
    addCsvToZip('cdnr.csv', [], cdnrHeaders);

    // 5. cdnur.csv (Credit/Debit Notes Unregistered)
    const cdnurHeaders = ['UR Type', 'Note/Refund Voucher Number', 'Note/Refund Voucher date', 'Document Type', 'Place Of Supply', 'Note/Refund Voucher Value', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'Pre GST'];
    addCsvToZip('cdnur.csv', [], cdnurHeaders);

    // 6. exp.csv (Exports)
    const expHeaders = ['Export Type', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Port Code', 'Shipping Bill Number', 'Shipping Bill Date', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value'];
    addCsvToZip('exp.csv', [], expHeaders);

    // 7. at.csv (Advance Tax)
    const atHeaders = ['Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Gross Advance Received', 'Cess Amount'];
    addCsvToZip('at.csv', [], atHeaders);

    // 8. atadj.csv (Advance Tax Adjustment)
    const atadjHeaders = ['Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Gross Advance Adjusted', 'Cess Amount'];
    addCsvToZip('atadj.csv', [], atadjHeaders);

    // 9. exemp.csv (Nil Rated, Exempted, Non-GST)
    const exempHeaders = ['Description', 'Nil Rated Supplies', 'Exempted (Other than Nil rated/non-GST supply)', 'Non-GST supplies'];
    const exempRows = [
      {
        'Description': 'Inter-State supplies to registered persons',
        'Nil Rated Supplies': 0,
        'Exempted (Other than Nil rated/non-GST supply)': 0,
        'Non-GST supplies': 0
      },
      {
        'Description': 'Intra-State supplies to registered persons',
        'Nil Rated Supplies': 0,
        'Exempted (Other than Nil rated/non-GST supply)': 0,
        'Non-GST supplies': 0
      },
      {
        'Description': 'Inter-State supplies to unregistered persons',
        'Nil Rated Supplies': 0,
        'Exempted (Other than Nil rated/non-GST supply)': 0,
        'Non-GST supplies': 0
      },
      {
        'Description': 'Intra-State supplies to unregistered persons',
        'Nil Rated Supplies': invoices.filter(i => !i.customers?.gstin && i.invoice_items?.every((item: any) => item.gst_rate === 0)).reduce((sum, i) => sum + i.total, 0),
        'Exempted (Other than Nil rated/non-GST supply)': 0,
        'Non-GST supplies': 0
      }
    ];
    addCsvToZip('exemp.csv', exempRows, exempHeaders);

    // 10. hsn.csv (HSN Summary)
    const hsnHeaders = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'];
    const hsnRows = gstr1Data.hsn.map(item => ({
      'HSN': item.hsn,
      'Description': item.description,
      'UQC': item.uqc,
      'Total Quantity': item.totalQuantity,
      'Total Value': item.totalValue,
      'Taxable Value': item.taxableValue,
      'Integrated Tax Amount': item.integratedTax,
      'Central Tax Amount': item.centralTax,
      'State/UT Tax Amount': item.stateTax,
      'Cess Amount': item.cess
    }));
    addCsvToZip('hsn.csv', hsnRows, hsnHeaders);

    // 11. docs.csv (Documents Issued)
    const docsHeaders = ['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled'];
    const docRows = [
      { 
        'Nature of Document': 'Invoices for outward supply', 
        'Sr. No. From': invoices.length > 0 ? invoices[invoices.length - 1].invoice_number : 'NA', 
        'Sr. No. To': invoices.length > 0 ? invoices[0].invoice_number : 'NA', 
        'Total Number': invoices.length, 
        'Cancelled': 0 
      }
    ];
    addCsvToZip('docs.csv', docRows, docsHeaders);
  };

  const exportGSTR1AsZip = async () => {
    const zip = new JSZip();
    populateGSTR1Folder(zip);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR1_CSVs_${filterType}_${day}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const getGSTR3BWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const outwardTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const outwardTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const inwardTaxable = purchases.reduce((sum, pur) => sum + (pur.subtotal || 0), 0);
    const inwardTax = purchases.reduce((sum, pur) => sum + (pur.tax_amount || 0), 0);

    const summaryRows = [
      { 'Section': '3.1 Outward Supplies', 'Taxable Value': outwardTaxable, 'Integrated Tax': 0, 'Central Tax': outwardTax/2, 'State Tax': outwardTax/2, 'Cess': 0 },
      { 'Section': '4. Eligible ITC', 'Taxable Value': inwardTaxable, 'Integrated Tax': 0, 'Central Tax': inwardTax/2, 'State Tax': inwardTax/2, 'Cess': 0 },
      { 'Section': 'Net Payable', 'Taxable Value': '', 'Integrated Tax': 0, 'Central Tax': (outwardTax - inwardTax)/2, 'State Tax': (outwardTax - inwardTax)/2, 'Cess': 0 }
    ];

    const ws = XLSX.utils.json_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'GSTR-3B Summary');
    return workbook;
  };

  const populateGSTR3BFolder = (folder: JSZip) => {
    const addCsvToZip = (filename: string, rows: any[], headers: string[]) => {
      let csv = '';
      if (rows.length === 0) {
        csv = headers.join(',') + '\n';
      } else {
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        csv = XLSX.utils.sheet_to_csv(ws);
      }
      folder.file(filename, csv);
    };

    const formatDate = (dateString: string) => {
      const d = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    const getTaxAmounts = (item: any, isInterState: boolean) => {
      const tax = item.tax_amount || 0;
      return {
        integrated: isInterState ? tax : 0,
        central: isInterState ? 0 : tax / 2,
        state: isInterState ? 0 : tax / 2,
      };
    };

    // 3.1 (a) Outward taxable supplies
    const headers31 = ['Vch Date', 'Vch No', 'Party Name', 'Short Add', 'Total Taxable Value', 'Integrated Tax', 'Central Tax', 'State/ UT Tax', 'Cess'];
    const outwardTaxable = invoices.filter(inv => inv.tax_amount > 0).map(inv => {
      const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
      const taxes = getTaxAmounts(inv, isInterState);
      return {
        'Vch Date': formatDate(inv.date),
        'Vch No': inv.invoice_number,
        'Party Name': inv.customers?.name || 'Cash',
        'Short Add': inv.customers?.city || '',
        'Total Taxable Value': inv.subtotal,
        'Integrated Tax': taxes.integrated,
        'Central Tax': taxes.central,
        'State/ UT Tax': taxes.state,
        'Cess': 0
      };
    });
    addCsvToZip('3.1_a_Outward_taxable_supplies.csv', outwardTaxable, headers31);

    // 3.1 (b) Outward taxable supplies (zero rated)
    addCsvToZip('3.1_b_Outward_taxable_supplies_zero_rated.csv', [], headers31);

    // 3.1 (c) Other outward supplies (Nil rated, exempted)
    const outwardNilRated = invoices.filter(inv => !inv.tax_amount || inv.tax_amount === 0).map(inv => {
      return {
        'Vch Date': formatDate(inv.date),
        'Vch No': inv.invoice_number,
        'Party Name': inv.customers?.name || 'Cash',
        'Short Add': inv.customers?.city || '',
        'Total Taxable Value': inv.subtotal,
        'Integrated Tax': 0,
        'Central Tax': 0,
        'State/ UT Tax': 0,
        'Cess': 0
      };
    });
    addCsvToZip('3.1_c_Other_outward_supplies_Nil_rated_exempted.csv', outwardNilRated, headers31);

    // 3.1 (d) Inward supplies (liable to reverse charge)
    addCsvToZip('3.1_d_Inward_supplies_liable_to_reverse_charge.csv', [], headers31);

    // 3.1 (e) Non GST outward supplies
    addCsvToZip('3.1_e_Non_GST_outward_supplies.csv', [], headers31);

    // 3.2 Supplies made to Unregistered Persons
    const headers32 = ['Vch Date', 'Vch No', 'Party Name', 'Short Add', 'Place of Supply (State/UT)', 'Total Taxable Value', 'Amount of Integrated Tax'];
    const unregisteredSupplies = invoices.filter(inv => !inv.customers?.gstin).map(inv => {
      const isInterState = inv.customers?.state && inv.customers?.state !== profile?.state;
      const taxes = getTaxAmounts(inv, isInterState);
      return {
        'Vch Date': formatDate(inv.date),
        'Vch No': inv.invoice_number,
        'Party Name': inv.customers?.name || 'Cash',
        'Short Add': inv.customers?.city || '',
        'Place of Supply (State/UT)': inv.customers?.state || '27-Maharashtra',
        'Total Taxable Value': inv.subtotal,
        'Amount of Integrated Tax': taxes.integrated
      };
    });
    addCsvToZip('3.2_Supplies_made_to_Unregistered_Persons.csv', unregisteredSupplies, headers32);

    // 3.2 Supplies made to Composition Taxable Persons
    addCsvToZip('3.2_Supplies_made_to_Composition_Taxable_Persons.csv', [], headers32);

    // 3.2 Supplies made to UIN Holders
    addCsvToZip('3.2_Supplies_made_to_UIN_Holders.csv', [], headers32);

    // 4 ITC
    const headers4 = ['Vch Date', 'Vch No', 'Party Name', 'Short Add', 'Integrated Tax', 'Central Tax', 'State/ UT Tax', 'Cess'];
    
    // 4A (1) Import of goods
    addCsvToZip('4A_1_Import_of_goods.csv', [], headers4);
    // 4A (2) Import of services
    addCsvToZip('4A_2_Import_of_services.csv', [], headers4);
    // 4A (3) Inward supplies liable to reverse charge
    addCsvToZip('4A_3_Inward_supplies_liable_to_reverse_charge.csv', [], headers4);
    // 4A (4) Inward supplies from ISD
    addCsvToZip('4A_4_Inward_supplies_from_ISD.csv', [], headers4);

    // 4A (5) All other ITC
    const allOtherITC = purchases.filter(pur => pur.tax_amount > 0).map(pur => {
      const isInterState = pur.suppliers?.state && pur.suppliers?.state !== profile?.state;
      const taxes = getTaxAmounts(pur, isInterState);
      return {
        'Vch Date': formatDate(pur.date),
        'Vch No': pur.invoice_number,
        'Party Name': pur.suppliers?.name || 'Cash',
        'Short Add': pur.suppliers?.city || '',
        'Integrated Tax': taxes.integrated,
        'Central Tax': taxes.central,
        'State/ UT Tax': taxes.state,
        'Cess': 0
      };
    });
    addCsvToZip('4A_5_All_other_ITC.csv', allOtherITC, headers4);

    // 4B (1) ITC Reversed As per rules 42 & 43
    addCsvToZip('4B_1_ITC_Reversed_As_per_rules_42_43.csv', [], headers4);
    // 4B (2) ITC Reversed Others
    addCsvToZip('4B_2_ITC_Reversed_Others.csv', [], headers4);

    // 4C Net ITC Available
    addCsvToZip('4C_Net_ITC_Available.csv', allOtherITC, headers4);

    // 4D (1) Ineligible ITC As per section 17(5)
    addCsvToZip('4D_1_Ineligible_ITC_As_per_section_17_5.csv', [], headers4);
    // 4D (2) Ineligible ITC Others
    addCsvToZip('4D_2_Ineligible_ITC_Others.csv', [], headers4);

    // 5 Exempt, Nil rated, Non GST inward supplies
    const headers5 = ['Vch Date', 'Vch No', 'Party Name', 'Short Add', 'Inter-State supplies', 'Intra-State supplies'];
    const exemptInward = purchases.filter(pur => !pur.tax_amount || pur.tax_amount === 0).map(pur => {
      const isInterState = pur.suppliers?.state && pur.suppliers?.state !== profile?.state;
      return {
        'Vch Date': formatDate(pur.date),
        'Vch No': pur.invoice_number,
        'Party Name': pur.suppliers?.name || 'Cash',
        'Short Add': pur.suppliers?.city || '',
        'Inter-State supplies': isInterState ? pur.subtotal : 0,
        'Intra-State supplies': isInterState ? 0 : pur.subtotal
      };
    });
    addCsvToZip('5_Exempt_Nil_rated_Non_GST_inward_supplies.csv', exemptInward, headers5);
    addCsvToZip('5_Non_GST_supply.csv', [], headers5);
  };

  const exportGSTR3BAsZip = async () => {
    const zip = new JSZip();
    populateGSTR3BFolder(zip);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR3B_CSVs_${filterType}_${day}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const getGSTR2AWorkbook = () => {
    const workbook = XLSX.utils.book_new();
    const b2bRows = purchases.map(pur => ({
      'GSTIN of Supplier': pur.suppliers?.gstin,
      'Supplier Name': pur.suppliers?.name,
      'Invoice Number': pur.invoice_number,
      'Invoice Date': pur.date,
      'Invoice Value': pur.total,
      'Taxable Value': pur.subtotal,
      'Integrated Tax': 0,
      'Central Tax': pur.tax_amount / 2,
      'State Tax': pur.tax_amount / 2,
      'Cess': 0,
      'ITC Available': 'Y'
    }));

    const ws = XLSX.utils.json_to_sheet(b2bRows);
    XLSX.utils.book_append_sheet(workbook, ws, 'B2B Purchases');
    return workbook;
  };

  const populateGSTR2AFolder = (folder: JSZip) => {
    const addCsvToZip = (filename: string, rows: any[], headers: string[]) => {
      let csv = '';
      if (rows.length === 0) {
        csv = headers.join(',') + '\n';
      } else {
        const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
        csv = XLSX.utils.sheet_to_csv(ws);
      }
      folder.file(filename, csv);
    };

    const formatDate = (dateString: string) => {
      const d = new Date(dateString);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${d.getDate()}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    // 1. cdnr.csv
    const cdnrHeaders = ['GSTIN of Supplier', 'Note/Refund Voucher Number', 'Note/Refund Voucher date', 'Document Type', 'Reason For Issuing document', 'Supply Type', 'Note/Refund Voucher Value', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Central Tax Paid', 'State/UT Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC', 'Pre GST'];
    addCsvToZip('cdnr.csv', [], cdnrHeaders);

    // 2. b2b.csv
    const b2bPurchases = purchases.filter(p => p.suppliers?.gstin);
    const b2burPurchases = purchases.filter(p => !p.suppliers?.gstin);

    const b2bHeaders = ['GSTIN of Supplier', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Invoice Type', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Central Tax Paid', 'State/UT Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC'];
    const b2bRows = b2bPurchases.map(pur => {
      const isInterState = pur.suppliers?.state && pur.suppliers?.state !== profile?.state;
      const rate = pur.purchase_items?.[0]?.gst_rate || 0;
      const taxAmount = pur.tax_amount || 0;
      return {
        'GSTIN of Supplier': pur.suppliers?.gstin || '',
        'Invoice Number': pur.invoice_number,
        'Invoice date': formatDate(pur.date),
        'Invoice Value': pur.total,
        'Place Of Supply': pur.suppliers?.state || '27-Maharashtra',
        'Reverse Charge': 'N',
        'Invoice Type': 'Regular',
        'Rate': rate,
        'Taxable Value': pur.subtotal,
        'Integrated Tax Paid': isInterState ? taxAmount : 0,
        'Central Tax Paid': !isInterState ? taxAmount / 2 : 0,
        'State/UT Tax Paid': !isInterState ? taxAmount / 2 : 0,
        'Cess Paid': 0,
        'Eligibility For ITC': 'Inputs',
        'Availment Of ITC': taxAmount
      };
    });
    addCsvToZip('b2b.csv', b2bRows, b2bHeaders);

    // 3. hsn.csv
    const hsnHeaders = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount'];
    const hsnMap = new Map();
    purchases.forEach(pur => {
      const isInterState = pur.suppliers?.state && pur.suppliers?.state !== profile?.state;
      pur.purchase_items?.forEach((item: any) => {
        const hsn = item.products?.hsn_code || 'NA';
        const rate = item.gst_rate || 0;
        const key = `${hsn}-${rate}`;
        
        if (!hsnMap.has(key)) {
          hsnMap.set(key, {
            hsn,
            description: item.products?.name || '',
            uqc: 'NOS-Numbers',
            totalQuantity: 0,
            totalValue: 0,
            taxableValue: 0,
            integratedTax: 0,
            centralTax: 0,
            stateTax: 0
          });
        }
        
        const entry = hsnMap.get(key);
        entry.totalQuantity += item.quantity || 0;
        entry.totalValue += item.amount || 0;
        entry.taxableValue += (item.unit_price * item.quantity) || 0;
        
        const tax = (item.unit_price * item.quantity * rate) / 100;
        
        if (isInterState) {
          entry.integratedTax += tax;
        } else {
          entry.centralTax += tax / 2;
          entry.stateTax += tax / 2;
        }
      });
    });

    const hsnRows = Array.from(hsnMap.values()).map(item => ({
      'HSN': item.hsn,
      'Description': item.description,
      'UQC': item.uqc,
      'Total Quantity': item.totalQuantity,
      'Total Value': item.totalValue,
      'Taxable Value': item.taxableValue,
      'Integrated Tax Amount': item.integratedTax,
      'Central Tax Amount': item.centralTax,
      'State/UT Tax Amount': item.stateTax
    }));
    addCsvToZip('hsn.csv', hsnRows, hsnHeaders);

    // 4. b2bur.csv (B2B Unregistered)
    const b2burHeaders = ['Supplier Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Supply Type', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Central Tax Paid', 'State/UT Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC'];
    const b2burRows = b2burPurchases.map(pur => {
      const isInterState = pur.suppliers?.state && pur.suppliers?.state !== profile?.state;
      const rate = pur.purchase_items?.[0]?.gst_rate || 0;
      const taxAmount = pur.tax_amount || 0;
      return {
        'Supplier Name': pur.suppliers?.name || 'Unknown',
        'Invoice Number': pur.invoice_number,
        'Invoice date': formatDate(pur.date),
        'Invoice Value': pur.total,
        'Place Of Supply': pur.suppliers?.state || '27-Maharashtra',
        'Supply Type': isInterState ? 'Inter-State' : 'Intra-State',
        'Rate': rate,
        'Taxable Value': pur.subtotal,
        'Integrated Tax Paid': isInterState ? taxAmount : 0,
        'Central Tax Paid': !isInterState ? taxAmount / 2 : 0,
        'State/UT Tax Paid': !isInterState ? taxAmount / 2 : 0,
        'Cess Paid': 0,
        'Eligibility For ITC': 'Inputs',
        'Availment Of ITC': taxAmount
      };
    });
    addCsvToZip('b2bur.csv', b2burRows, b2burHeaders);

    // 5. impg.csv (Import of Goods)
    const impgHeaders = ['Port Code', 'Bill Of Entry Number', 'Bill Of Entry Date', 'Value', 'Document type', 'GSTIN Of SEZ Supplier', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC'];
    addCsvToZip('impg.csv', [], impgHeaders);

    // 6. imps.csv (Import of Services)
    const impsHeaders = ['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC'];
    addCsvToZip('imps.csv', [], impsHeaders);

    // 7. cdnur.csv (Credit/Debit Notes Unregistered)
    const cdnurHeaders = ['Supplier Name', 'Note/Refund Voucher Number', 'Note/Refund Voucher date', 'Document Type', 'Reason For Issuing document', 'Supply Type', 'Note/Refund Voucher Value', 'Rate', 'Taxable Value', 'Integrated Tax Paid', 'Central Tax Paid', 'State/UT Tax Paid', 'Cess Paid', 'Eligibility For ITC', 'Availment Of ITC', 'Pre GST'];
    addCsvToZip('cdnur.csv', [], cdnurHeaders);

    // 8. exemp.csv (Nil rated, exempted and non GST inward supplies)
    const exempHeaders = ['Description', 'Composition taxable person', 'Nil Rated Supplies', 'Exempted (other than nil rated/non GST supply)', 'Non-GST supplies'];
    addCsvToZip('exemp.csv', [], exempHeaders);

    // 9. itcr.csv (ITC Reversal)
    const itcrHeaders = ['Description for reversal of ITC', 'To be added or reduced from output liability', 'ITC Integrated Tax Amount', 'ITC Central Tax Amount', 'ITC State/UT Tax Amount', 'ITC Cess Amount'];
    addCsvToZip('itcr.csv', [], itcrHeaders);

    // 10. at.csv (Advance Tax)
    const atHeaders = ['Place Of Supply', 'Supply Type', 'Gross Advance Paid', 'Cess Amount'];
    addCsvToZip('at.csv', [], atHeaders);

    // 11. atadj.csv (Advance Tax Adjustment)
    const atadjHeaders = ['Place Of Supply', 'Supply Type', 'Gross Advance Adjusted', 'Cess Amount'];
    addCsvToZip('atadj.csv', [], atadjHeaders);
  };

  const exportGSTR2AAsZip = async () => {
    const zip = new JSZip();
    populateGSTR2AFolder(zip);
    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GSTR2A_CSVs_${filterType}_${day}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const downloadAllAsZip = async () => {
    const zip = new JSZip();
    
    const gstr1Folder = zip.folder("GSTR-1");
    if (gstr1Folder) populateGSTR1Folder(gstr1Folder);
    
    const gstr3bFolder = zip.folder("GSTR-3B");
    if (gstr3bFolder) populateGSTR3BFolder(gstr3bFolder);
    
    const gstr2aFolder = zip.folder("GSTR-2A");
    if (gstr2aFolder) populateGSTR2AFolder(gstr2aFolder);

    const content = await zip.generateAsync({ type: 'blob' });
    const url = window.URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = `GST_Reports_${filterType}_${day}.zip`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const renderGSTR1Analysis = () => {
    const totalTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const totalTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const b2bCount = gstr1Data.b2b.length;
    const b2cCount = (gstr1Data.b2cl?.length || 0) + (gstr1Data.b2cs?.length || 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Taxable Value</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalTaxable)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">Total Tax (Output)</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalTax)}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">B2B Invoices</p>
            <p className="text-lg font-bold text-slate-900">{b2bCount}</p>
          </div>
          <div className="glass-card p-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase">B2C Invoices</p>
            <p className="text-lg font-bold text-slate-900">{b2cCount}</p>
          </div>
        </div>

        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">B2B Invoices Summary</h3>
            <button 
              onClick={exportGSTR1AsZip}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold flex items-center hover:bg-primary/90 transition-all"
            >
              <Download size={12} className="mr-1.5" />
              Download GSTR-1 Report
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">GSTIN</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Taxable Value</th>
                  <th className="px-4 py-3">Tax Amount</th>
                  <th className="px-4 py-3">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gstr1Data.b2b.map((inv, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">{inv.customers?.gstin}</td>
                    <td className="px-4 py-3">{inv.invoice_number}</td>
                    <td className="px-4 py-3">{new Date(inv.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{formatCurrency(inv.subtotal)}</td>
                    <td className="px-4 py-3">{formatCurrency(inv.tax_amount)}</td>
                    <td className="px-4 py-3 font-bold">{formatCurrency(inv.total)}</td>
                  </tr>
                ))}
                {gstr1Data.b2b.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                      No B2B invoices found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderGSTR3B = () => {
    const outwardTaxable = invoices.reduce((sum, inv) => sum + (inv.subtotal || 0), 0);
    const outwardTax = invoices.reduce((sum, inv) => sum + (inv.tax_amount || 0), 0);
    const inwardTaxable = purchases.reduce((sum, pur) => sum + (pur.subtotal || 0), 0);
    const inwardTax = purchases.reduce((sum, pur) => sum + (pur.tax_amount || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center">
              <FileText size={14} className="mr-2 text-primary" />
              3.1 Details of Outward Supplies
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Taxable Value</span>
                <span className="font-bold">{formatCurrency(outwardTaxable)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Output Tax</span>
                <span className="font-bold text-red-600">{formatCurrency(outwardTax)}</span>
              </div>
            </div>
          </div>
          <div className="glass-card p-6">
            <h3 className="text-xs font-bold text-slate-900 mb-4 flex items-center">
              <CheckCircle2 size={14} className="mr-2 text-emerald-500" />
              4. Eligible ITC
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Inward Taxable Value</span>
                <span className="font-bold">{formatCurrency(inwardTaxable)}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Total Input Tax Credit (ITC)</span>
                <span className="font-bold text-emerald-600">{formatCurrency(inwardTax)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 bg-slate-900 text-white">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Net GST Payable / (Credit)</p>
              <p className="text-2xl font-bold mt-1">
                {formatCurrency(outwardTax - inwardTax)}
              </p>
            </div>
            <button 
              onClick={exportGSTR3BAsZip}
              className="px-4 py-2 bg-white text-slate-900 rounded-xl text-[11px] font-bold hover:bg-slate-100 transition-all flex items-center"
            >
              <Download size={14} className="mr-2" />
              Download GSTR-3B Report
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderGSTR2A = () => {
    return (
      <div className="space-y-6">
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900">GSTR-2A Auto-populated Data (Purchases)</h3>
            <button 
              onClick={exportGSTR2AAsZip}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold flex items-center hover:bg-primary/90 transition-all"
            >
              <Download size={12} className="mr-1.5" />
              Download GSTR-2A Report
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="px-4 py-3">Supplier GSTIN</th>
                  <th className="px-4 py-3">Supplier Name</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Taxable Value</th>
                  <th className="px-4 py-3">ITC Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((pur, i) => (
                  <tr key={i} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-medium">{pur.suppliers?.gstin}</td>
                    <td className="px-4 py-3">{pur.suppliers?.name}</td>
                    <td className="px-4 py-3">{pur.invoice_number}</td>
                    <td className="px-4 py-3">{new Date(pur.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3">{formatCurrency(pur.subtotal)}</td>
                    <td className="px-4 py-3 font-bold text-emerald-600">{formatCurrency(pur.tax_amount)}</td>
                  </tr>
                ))}
                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                      No purchase records found for this period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title="GST Compliance Reports" 
        description="Generate and download GSTR-1, GSTR-3B, and GSTR-2A reports for filing."
      >
        <div className="flex items-center space-x-3">
          <button 
            onClick={downloadAllAsZip}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[11px] font-bold hover:bg-slate-800 transition-all flex items-center shadow-lg shadow-slate-200"
          >
            <Download size={14} className="mr-2" />
            Download All Reports (ZIP)
          </button>
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
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl w-fit">
        {(['GSTR-1', 'GSTR-3B', 'GSTR-2A'] as GSTReportType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2 rounded-lg text-[11px] font-bold transition-all",
              activeTab === tab 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass-card p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-slate-500 text-xs font-medium">Generating report data...</p>
        </div>
      ) : (
        <>
          {activeTab === 'GSTR-1' && renderGSTR1Analysis()}
          {activeTab === 'GSTR-3B' && renderGSTR3B()}
          {activeTab === 'GSTR-2A' && renderGSTR2A()}
        </>
      )}
    </div>
  );
}
