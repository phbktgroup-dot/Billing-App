import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';

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
    sku?: string;
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
  total: number;
  notes?: string;
  terms?: string;
}

export interface BusinessProfile {
  name: string;
  address?: string;
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
  doc.line(10, 82, 200, 82);
  doc.line(10, 92, 200, 92);
  doc.line(10, 102, 200, 102);
  doc.line(10, 207, 200, 207);
  doc.line(10, 215, 200, 215);
  doc.line(10, 225, 200, 225);
  doc.line(10, 265, 200, 265);
  
  // Vertical lines
  doc.line(105, 45, 105, 92); // Header middle
  
  // Table columns (from 92 to 207)
  doc.line(20, 92, 20, 207); // S.N.
  doc.line(95, 92, 95, 207); // Description end
  doc.line(130, 92, 130, 207); // Product Code end
  doc.line(150, 92, 150, 207); // Qty end
  doc.line(175, 92, 175, 207); // Price end
  doc.line(200, 92, 200, 225); // Table end (Keep right border)
  
  // Vertical line for Total row (Qty column)
  doc.line(150, 215, 150, 225);
  doc.line(175, 215, 175, 225);
  
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
  } else {
    doc.setFillColor(30, 30, 30);
    doc.rect(15, 12, 22, 22, 'F');
    doc.setDrawColor(218, 165, 32);
    doc.setLineWidth(1);
    doc.circle(26, 23, 6, 'S');
    doc.setFontSize(10);
    doc.setTextColor(218, 165, 32);
    doc.text("H", 26, 26, { align: 'center' });
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
  doc.text(business?.address || "", 105, 26, { align: 'center' });
  doc.text(`Tel: ${business?.mobile || ""}   Email: ${business?.email || ""}`, 105, 30, { align: 'center' });
  
  doc.setFont("helvetica", "bold");
  doc.text(`PAN NO.: ${business?.pan_number || ""} , GST NO. : ${business?.gst_number || ""}`, 105, 34, { align: 'center' });
  doc.text(`${business?.bank_name || ""} A/C NO :- ${business?.bank_account_no || ""}, IFSC :- ${business?.bank_ifsc || ""}`, 105, 38, { align: 'center' });
  doc.text(`Branch : ${business?.bank_branch || ""}`, 105, 42, { align: 'center' });

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
  doc.text(invoice.customer_name || "Optimus OE Solutions India Pvt. Ltd, Pune", 12, 56);
  
  if (invoice.customer_address) {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const splitAddress = doc.splitTextToSize(invoice.customer_address, 85);
    doc.text(splitAddress, 12, 60);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
  }
  
  doc.text("GSTIN      :", 12, 76);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customer_gstin || "", 35, 76);
  
  // Right side
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No.", 108, 52);
  doc.text("Invoice Date", 108, 58);
  doc.text("Payment Mode", 108, 64);
  doc.text("State Code", 108, 70);
  
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${invoice.invoice_number}`, 135, 52);
  doc.text(`:  ${new Date(invoice.date).toLocaleDateString('en-GB')}`, 135, 58);
  doc.text(`:  ${invoice.payment_mode || 'Cash'}`, 135, 64);
  doc.text(`:  ${invoice.customer_state_code || ''}`, 135, 70);

  // E-WAY BILL
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("E-WAY BILL NO. :", 12, 88);
  doc.text("Weight :", 108, 88);

  // Table Headers
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("S.N.", 15, 98, { align: 'center' });
  doc.text("Description of Goods", 57.5, 98, { align: 'center' });
  doc.text("Product Code", 112.5, 98, { align: 'center' });
  doc.text("Qty.", 140, 98, { align: 'center' });
  doc.text("Price", 162.5, 98, { align: 'center' });
  doc.text("Amount\n(Rs.)", 187.5, 96, { align: 'center' });

  // Table Items
  doc.setFont("helvetica", "normal");
  let currentY = 109;
  invoice.items.forEach((item, index) => {
    doc.text((index + 1).toString(), 15, currentY, { align: 'center' });
    doc.text(item.name, 22, currentY);
    doc.text(item.sku || "-", 112.5, currentY, { align: 'center' });
    doc.text(item.quantity.toString(), 140, currentY, { align: 'center' });
    doc.text(item.rate.toFixed(2), 173, currentY, { align: 'right' });
    doc.text((item.quantity * item.rate).toFixed(2), 198, currentY, { align: 'right' });
    
    currentY += 6;
  });

  // Discount Row (Single row style)
  doc.setFont("helvetica", "bold");
  const effectiveDiscountPercent = invoice.discount_percentage || (invoice.raw_subtotal > 0 ? (invoice.discount / invoice.raw_subtotal * 100) : 0);
  const discountText = `Discount (${effectiveDiscountPercent.toFixed(effectiveDiscountPercent % 1 === 0 ? 0 : 1)}%) :`;
  doc.text(discountText, 25, 211);
  doc.text((invoice.discount || 0).toFixed(2), 198, 211, { align: 'right' });

  // Total Row in Table (Discounted Amount)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Total Amount :", 25, 220);
  
  const totalQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  doc.text(totalQty.toString(), 140, 220, { align: 'center' });
  doc.text(invoice.subtotal.toFixed(2), 198, 220, { align: 'right' });

  // Tax and Grand Total (Stacked on the right)
  let summaryY = 230;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  // GST Row (Split into CGST and SGST or IGST)
  const gstRates = [...new Set(invoice.items.map(i => i.gstRate || 0))].filter(r => r > 0);
  const isSingleRate = gstRates.length === 1;
  const totalGstRate = isSingleRate ? gstRates[0] : 0;

  if (gstRates.length > 0) {
    // Always show CGST and SGST as requested ("do not remove CGST and SGST both keep")
    const halfRate = totalGstRate / 2;
    const cgstText = isSingleRate ? `CGST ${halfRate}%` : "CGST";
    const sgstText = isSingleRate ? `SGST ${halfRate}%` : "SGST";
    
    // Use the values passed from the UI
    const cgstVal = invoice.cgst_amount || 0;
    const sgstVal = invoice.sgst_amount || 0;
    
    doc.text(`Add :${cgstText} :`, 130, summaryY);
    doc.text(cgstVal.toFixed(2), 198, summaryY, { align: 'right' });
    summaryY += 6;
    
    doc.text(`Add :${sgstText} :`, 130, summaryY);
    doc.text(sgstVal.toFixed(2), 198, summaryY, { align: 'right' });
    summaryY += 6;

    // Show IGST (it will be 0 for intra-state and full rate for inter-state)
    const igstRate = invoice.is_inter_state ? totalGstRate : 0;
    const igstText = isSingleRate ? `IGST ${igstRate}%` : "IGST";
    const igstVal = invoice.igst_amount || 0;

    doc.text(`Add :${igstText} :`, 130, summaryY);
    doc.text(igstVal.toFixed(2), 198, summaryY, { align: 'right' });
    summaryY += 6;

    // Add Subtotal GST row to match UI
    doc.setFont("helvetica", "bold");
    doc.text("Subtotal GST :", 130, summaryY);
    doc.text((invoice.tax_amount || 0).toFixed(2), 198, summaryY, { align: 'right' });
    doc.setFont("helvetica", "normal");
    summaryY += 8;
  } else {
    doc.text(`Add :GST 0% :`, 130, summaryY);
    doc.text("0.00", 198, summaryY, { align: 'right' });
    summaryY += 6;
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
    doc.save(`Invoice_${invoice.invoice_number}_${dateStr}.pdf`);
  }
};

export const generateProfitLossPDF = async (data: any, business: BusinessProfile) => {
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
  
  doc.save(`profit-loss-ledger-${new Date().toISOString().split('T')[0]}.pdf`);
};
