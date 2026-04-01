import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';
import { downloadFile } from './utils';

export interface InvoiceData {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_gstin?: string;
  customer_address?: string;
  customer_state?: string;
  customer_state_code?: string;
  billing_state?: string;
  payment_mode?: string;
  discount?: number;
  discount_percentage?: number;
  due_date?: string;
  items: {
    name: string;
    hsnCode?: string;
    quantity: number;
    rate: number;
    gstRate?: number;
    amount: number;
  }[];
  subtotal: number;
  raw_subtotal: number;
  tax_amount: number;
  cgst_amount?: number;
  sgst_amount?: number;
  igst_amount?: number;
  is_inter_state?: boolean;
  eway_bill_no?: string;
  total: number;
  notes?: string;
  terms?: string;
}

export interface BusinessProfile {
  name: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  mobile?: string;
  email?: string;
  gst_number?: string;
  pan_number?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  logo_url?: string;
  invoice_prefix?: string;
}

export const generateInvoicePDF = async (invoice: InvoiceData, business: BusinessProfile, returnBlob: boolean = false) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Outer border
  doc.rect(10, 10, 190, 282);
  
  // Horizontal lines
  doc.line(10, 45, 200, 45);
  doc.line(10, 78, 200, 78);
  doc.line(10, 88, 200, 88);
  doc.line(10, 98, 200, 98);
  doc.line(10, 197, 200, 197);
  doc.line(10, 205, 200, 205);
  doc.line(10, 212, 200, 212);
  doc.line(10, 265, 200, 265);
  
  // Vertical lines
  doc.line(105, 45, 105, 88); // Header middle
  
  // Table columns (from 88 to 197)
  doc.line(20, 88, 20, 197); // S.N.
  doc.line(85, 88, 85, 197); // Description end
  doc.line(105, 88, 105, 197); // HSN Code end
  doc.line(125, 88, 125, 197); // GST Rate end
  doc.line(145, 88, 145, 197); // Qty end
  doc.line(170, 88, 170, 197); // Price end
  doc.line(200, 92, 200, 212); // Table end (Keep right border)
  
  // Vertical line for Total row (Qty column)
  doc.line(145, 205, 145, 212);
  doc.line(170, 205, 170, 212);
  
  // Footer middle
  doc.line(120, 265, 120, 292);

  // 1. Header & Logo Area
  if (business?.logo_url) {
    try {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.src = business.logo_url;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });
      doc.addImage(img, 'PNG', 15, 12, 22, 22);
    } catch (e) {
      console.error("Failed to load logo image", e);
    }
  }
  
  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  
  // Center Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", 105, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(business?.name || "", 105, 21, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  
  // Line 1: Address 1
  doc.text(business?.address1 || "", 105, 25, { align: 'center' });
  
  // Line 2: Address 2
  doc.text(business?.address2 || "", 105, 29, { align: 'center' });
  
  // Line 3: City and Pincode
  const line3 = [business?.city, business?.pincode ? `PIN: ${business.pincode}` : ''].filter(Boolean).join(', ');
  doc.text(line3 || "", 105, 33, { align: 'center' });

  doc.text(`Tel: ${business?.mobile || ""}   Email: ${business?.email || ""}`, 105, 37, { align: 'center' });
  
  doc.setFont("helvetica", "bold");
  doc.text(`PAN NO.: ${business?.pan_number || ""} , GST NO. : ${business?.gst_number || ""}`, 105, 41, { align: 'center' });

  // Right Header
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("ORIGINAL FOR RECIPIENT", 195, 15, { align: 'right' });
  
  // Barcode
  doc.setLineWidth(0.3);
  for(let i=0; i<35; i++) {
    const w = Math.random() > 0.5 ? 0.6 : 0.2;
    doc.setLineWidth(w);
    doc.line(160 + (i * 1), 18, 160 + (i * 1), 28);
  }
  doc.setLineWidth(0.5);

  // Buyer Details
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Buyer details :", 12, 50);
  doc.text(invoice.customer_name || "Optimus OE Solutions India Pvt. Ltd, Pune", 12, 55);
  
  if (invoice.customer_address) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const splitAddress = doc.splitTextToSize(invoice.customer_address, 85);
    doc.text(splitAddress, 12, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
  }
  
  doc.text("GSTIN      :", 12, 73);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customer_gstin || "", 35, 73);
  
  // Right side
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No.", 108, 54);
  doc.text("Invoice Date", 108, 60);
  doc.text("Payment Mode", 108, 66);
  doc.text("State Code", 108, 72);
  
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${invoice.invoice_number}`, 135, 54);
  doc.text(`:  ${new Date(invoice.date).toLocaleDateString('en-GB')}`, 135, 60);
  doc.text(`:  ${invoice.payment_mode || 'Cash'}`, 135, 66);
  doc.text(`:  ${invoice.customer_state_code || ''}`, 135, 72);

  // E-WAY BILL
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`E-WAY BILL NO. : ${invoice.eway_bill_no || ""}`, 12, 84);
  doc.text("Weight :", 108, 84);

  // Table Headers
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("S.N.", 15, 94, { align: 'center' });
  doc.text("Description of Goods", 52.5, 94, { align: 'center' });
  doc.text("HSN Code", 95, 94, { align: 'center' });
  doc.text("GST Rate", 115, 94, { align: 'center' });
  doc.text("Qty.", 135, 94, { align: 'center' });
  doc.text("Price", 157.5, 94, { align: 'center' });
  doc.text("Amount\n(Rs.)", 185, 92, { align: 'center' });

  // Table Items
  doc.setFont("helvetica", "normal");
  let currentY = 105;
  invoice.items.forEach((item, index) => {
    if (currentY > 190) return; // Prevent items from overflowing table
    doc.text((index + 1).toString(), 15, currentY, { align: 'center' });
    
    // Split item name to fit in column (width is approx 65 units, from x=20 to x=85)
    const splitName = doc.splitTextToSize(item.name, 60);
    doc.text(splitName, 22, currentY);
    
    doc.text(item.hsnCode || "-", 95, currentY, { align: 'center' });
    doc.text(`${item.gstRate || 0}%`, 115, currentY, { align: 'center' });
    doc.text(item.quantity.toString(), 135, currentY, { align: 'center' });
    doc.text(item.rate.toFixed(2), 168, currentY, { align: 'right' });
    doc.text((item.quantity * item.rate).toFixed(2), 198, currentY, { align: 'right' });
    
    // Adjust currentY based on number of lines in description
    const lines = splitName.length;
    currentY += Math.max(6, (lines * 5) + 1);
  });

  // Discount Row (Single row style)
  doc.setFont("helvetica", "bold");
  const effectiveDiscountPercent = invoice.discount_percentage || (invoice.raw_subtotal > 0 ? (invoice.discount / invoice.raw_subtotal * 100) : 0);
  const discountText = `Discount (${effectiveDiscountPercent.toFixed(effectiveDiscountPercent % 1 === 0 ? 0 : 1)}%) :`;
  doc.text(discountText, 25, 201);
  doc.text((invoice.discount || 0).toFixed(2), 198, 201, { align: 'right' });

  // Total Row in Table (Discounted Amount)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Total Amount :", 25, 209);
  
  const totalQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  doc.text(totalQty.toString(), 135, 209, { align: 'center' });
  doc.text(invoice.subtotal.toFixed(2), 198, 209, { align: 'right' });

  // Tax and Grand Total (Stacked on the right)
  let summaryY = 218;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  // GST Row (Split into CGST and SGST or IGST)
  const gstRates = [...new Set(invoice.items.map(i => i.gstRate || 0))].filter(r => r > 0);
  const isSingleRate = gstRates.length === 1;
  const totalGstRate = isSingleRate ? gstRates[0] : 0;

  if (gstRates.length > 0) {
    if (!invoice.is_inter_state) {
      const cgstVal = invoice.cgst_amount || 0;
      const sgstVal = invoice.sgst_amount || 0;

      doc.text(`Add :CGST :`, 130, summaryY);
      doc.text(cgstVal.toFixed(2), 198, summaryY, { align: 'right' });
      summaryY += 6;

      doc.text(`Add :SGST :`, 130, summaryY);
      doc.text(sgstVal.toFixed(2), 198, summaryY, { align: 'right' });
      summaryY += 6;
    } else {
      const igstVal = invoice.igst_amount || 0;

      doc.text(`Add :IGST :`, 130, summaryY);
      doc.text(igstVal.toFixed(2), 198, summaryY, { align: 'right' });
      summaryY += 6;
    }

    // Add Subtotal GST row
    doc.setFont("helvetica", "bold");
    doc.text("Subtotal GST :", 130, summaryY);
    doc.text((invoice.tax_amount || 0).toFixed(2), 198, summaryY, { align: 'right' });
    doc.setFont("helvetica", "normal");
    summaryY += 8;
  } else {
    doc.text(`Add :GST 0% :`, 130, summaryY);
    doc.text("0.00", 198, summaryY, { align: 'right' });
    summaryY += 8;
  }


  // Grand Total Row
  const words = numberToWords(Math.round(invoice.total)).toUpperCase();
  doc.setFontSize(7);
  doc.text(`Amount in Words: ${words}`, 12, summaryY, { maxWidth: 110 });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("GRAND TOTAL :", 130, summaryY);
  doc.text(invoice.total.toFixed(2), 198, summaryY, { align: 'right' });
  doc.setFont("helvetica", "normal");

  // Bank Details Rows
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(`Bank Name - ${business?.bank_name || ""}`, 12, summaryY + 8);
  doc.text(`Account Number - ${business?.bank_account_no || ""}`, 12, summaryY + 12);
  doc.text(`IFSC Code - ${business?.bank_ifsc || ""}`, 12, summaryY + 16);
  doc.text(`Branch - ${business?.bank_branch || ""}`, 12, summaryY + 20);

  // Footer
  const footerTopY = 265;
  const footerBottomY = 292;
  
  // Terms & Conditions (Left Side)
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("Term & Conditions", 12, footerTopY + 4);
  
  if (invoice.terms) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    const splitTerms = doc.splitTextToSize(invoice.terms, 100);
    doc.text(splitTerms, 12, footerTopY + 8);
  }
  
  // Signature Area (Right Side Box)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  // Center text in the right box (120 to 200, center is 160)
  doc.text(`For ${business?.name || ""}`, 160, footerTopY + 4, { align: 'center' });
  
  doc.setFontSize(7);
  doc.text("Authorised Signatory", 160, footerBottomY - 2, { align: 'center' });

  if (returnBlob) {
    return doc.output('blob');
  } else {
    const d = new Date(invoice.date);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    const dateStr = `${dd}${yy}${mm}`;
    await downloadFile(doc.output('blob'), `Invoice_${invoice.invoice_number}_${dateStr}.pdf`);
  }
};

export const generateProfitLossPDF = async (data: any, business: any) => {
  const doc = new jsPDF();
  
  doc.setFontSize(18);
  doc.text("Profit and Loss Ledger", 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Business: ${business.name}`, 10, 30);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 10, 35);
  
  const tableData = [
    ['Category', 'Amount'],
    ['Total Sales', data.totalSales.toFixed(2)],
    ['Total Purchases', data.totalPurchases.toFixed(2)],
    ['Total Expenses', data.totalExpenses.toFixed(2)],
    ['Net Profit', data.netProfit.toFixed(2)]
  ];
  
  autoTable(doc, {
    startY: 40,
    head: [tableData[0]],
    body: tableData.slice(1),
  });
  
  await downloadFile(doc.output('blob'), `profit-loss-ledger-${new Date().toISOString().split('T')[0]}.pdf`);
};

export const generateLedgerPDF = async (data: {
  partyName: string;
  partyGstin?: string;
  partyAddress?: string;
  startDate: string;
  endDate: string;
  entries: any[];
  totals: any;
  type: 'Customer' | 'Supplier';
}, business: any) => {
  const doc = new jsPDF();
  const businessProfile = Array.isArray(business) ? business[0] : business;

  // Header
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text(businessProfile?.name || 'Business Ledger', 105, 20, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(businessProfile?.address || '', 105, 26, { align: 'center' });
  if (businessProfile?.gstin) {
    doc.text(`GSTIN: ${businessProfile.gstin}`, 105, 31, { align: 'center' });
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(20, 35, 190, 35);

  // Report Title
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`${data.type} Ledger Account`, 20, 45);
  
  doc.setFontSize(10);
  doc.text(`${data.startDate} to ${data.endDate}`, 190, 45, { align: 'right' });

  // Party Info
  doc.setFontSize(11);
  doc.text(`${data.type} Details:`, 20, 55);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(data.partyName, 20, 61);
  if (data.partyAddress) doc.text(data.partyAddress, 20, 66);
  if (data.partyGstin) doc.text(`GSTIN: ${data.partyGstin}`, 20, 71);

  // Table
  const tableData = data.entries.map(entry => {
    let prefix = entry.debit > 0 ? 'To  ' : 'By  ';
    let particulars = entry.particulars;
    
    if (entry.voucherType === 'Sales') {
      particulars = `Sales A/c`;
    } else if (entry.voucherType === 'Purchase') {
      particulars = `Purchase A/c`;
    }

    return [
      new Date(entry.date).toLocaleDateString('en-GB'),
      prefix + particulars,
      entry.voucherType,
      entry.voucherNo,
      entry.debit > 0 ? entry.debit.toFixed(2) : '',
      entry.credit > 0 ? entry.credit.toFixed(2) : '',
      `${Math.abs(entry.balance).toFixed(2)} ${entry.balance >= 0 ? 'Dr' : 'Cr'}`
    ];
  });

  autoTable(doc, {
    startY: 80,
    head: [['Date', 'Particulars', 'Vch Type', 'Vch No.', 'Debit', 'Credit', 'Balance']],
    body: [
      ...tableData,
      [
        { content: 'Total', colSpan: 4, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: data.totals.totalDebit.toFixed(2), styles: { fontStyle: 'bold' } },
        { content: data.totals.totalCredit.toFixed(2), styles: { fontStyle: 'bold' } },
        { content: `${Math.abs(data.totals.closingBalance).toFixed(2)} ${data.totals.closingBalance >= 0 ? 'Dr' : 'Cr'}`, styles: { fontStyle: 'bold' } }
      ]
    ],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 8, textColor: 51 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { top: 80 }
  });

  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 80;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(`Generated on ${new Date().toLocaleString()}`, 20, finalY + 10);
  doc.text('This is a computer generated statement.', 20, finalY + 15);

  const blob = doc.output('blob');
  await downloadFile(blob, `ledger-${data.partyName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.pdf`);
};
