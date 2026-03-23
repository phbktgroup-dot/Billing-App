import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';

export interface InvoiceData {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_gstin?: string;
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
  doc.line(10, 75, 200, 75);
  doc.line(10, 85, 200, 85);
  doc.line(10, 95, 200, 95);
  doc.line(10, 222, 200, 222);
  doc.line(10, 230, 200, 230);
  doc.line(10, 240, 200, 240);
  doc.line(10, 262, 200, 262);
  
  // Vertical lines
  doc.line(105, 45, 105, 85); // Header middle
  
  // Table columns (from 85 to 222)
  doc.line(20, 85, 20, 222); // S.N.
  doc.line(100, 85, 100, 222); // Description end
  doc.line(140, 85, 140, 222); // SKU end
  doc.line(160, 85, 160, 222); // Qty end
  doc.line(180, 85, 180, 222); // Price end
  doc.line(200, 85, 200, 240); // Table end (Keep right border)
  
  // Vertical line for Total row (Qty column)
  doc.line(160, 230, 160, 240);
  doc.line(180, 230, 180, 240);
  
  // Footer middle
  doc.line(120, 262, 120, 292);

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
  
  doc.text("GSTIN      :", 12, 70);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customer_gstin || "", 35, 70);
  
  // Right side
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No.", 108, 50);
  doc.text("Invoice Date", 108, 55);
  doc.text("Payment Mode", 108, 60);
  
  doc.setFont("helvetica", "normal");
  doc.text(`:  ${invoice.invoice_number}`, 135, 50);
  doc.text(`:  ${new Date(invoice.date).toLocaleDateString('en-GB')}`, 135, 55);
  doc.text(`:  ${invoice.payment_mode || 'Cash'}`, 135, 60);

  // E-WAY BILL
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("E-WAY BILL NO. :", 12, 81);
  doc.text("Weight :", 108, 81);

  // Table Headers
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("S.N.", 15, 91, { align: 'center' });
  doc.text("Description of Goods", 60, 91, { align: 'center' });
  doc.text("SKU", 120, 91, { align: 'center' });
  doc.text("Qty.", 150, 91, { align: 'center' });
  doc.text("Price", 170, 91, { align: 'center' });
  doc.text("Amount\n(Rs.)", 190, 89, { align: 'center' });

  // Table Items
  doc.setFont("helvetica", "normal");
  let currentY = 102;
  invoice.items.forEach((item, index) => {
    doc.text((index + 1).toString(), 15, currentY, { align: 'center' });
    doc.text(item.name, 22, currentY);
    doc.text(item.sku || "-", 120, currentY, { align: 'center' });
    doc.text(item.quantity.toString(), 150, currentY, { align: 'center' });
    doc.text(item.rate.toFixed(2), 178, currentY, { align: 'right' });
    doc.text((item.quantity * item.rate).toFixed(2), 198, currentY, { align: 'right' });
    
    currentY += 6;
  });

  // Discount Row (Single row style)
  doc.setFont("helvetica", "bold");
  const effectiveDiscountPercent = invoice.discount_percentage || (invoice.raw_subtotal > 0 ? (invoice.discount / invoice.raw_subtotal * 100) : 0);
  const discountText = `Discount (${effectiveDiscountPercent.toFixed(effectiveDiscountPercent % 1 === 0 ? 0 : 1)}%) :`;
  doc.text(discountText, 25, 227);
  doc.text((invoice.discount || 0).toFixed(2), 198, 227, { align: 'right' });

  // Total Row in Table (Discounted Amount)
  doc.setFont("helvetica", "bold");
  doc.text("Total :", 25, 236);
  
  const totalQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  doc.text(totalQty.toString(), 150, 236, { align: 'center' });
  doc.text(invoice.subtotal.toFixed(2), 198, 236, { align: 'right' });

  // Tax and Grand Total (Stacked on the right)
  let summaryY = 246;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");

  // GST Row (Split into CGST and SGST)
  const totalGstRate = invoice.items[0]?.gstRate || 0;
  if (totalGstRate > 0) {
    const halfRate = totalGstRate / 2;
    const halfTax = invoice.tax_amount / 2;
    
    doc.text(`Add :CGST ${halfRate}% :`, 130, summaryY);
    doc.text(halfTax.toFixed(2), 198, summaryY, { align: 'right' });
    
    summaryY += 6;
    
    doc.text(`Add :SGST ${halfRate}% :`, 130, summaryY);
    doc.text(halfTax.toFixed(2), 198, summaryY, { align: 'right' });
    
    summaryY += 6;
  } else {
    doc.text(`Add :GST 0% :`, 130, summaryY);
    doc.text("0.00", 198, summaryY, { align: 'right' });
    summaryY += 6;
  }

  // Grand Total Row
  const words = numberToWords(Math.round(invoice.total)).toUpperCase();
  doc.setFontSize(7);
  doc.text(`Amount in Words: ${words}`, 12, summaryY, { maxWidth: 110 });
  
  doc.setFontSize(9);
  doc.text("GRAND TOTAL :", 130, summaryY);
  doc.text(invoice.total.toFixed(2), 198, summaryY, { align: 'right' });

  // Footer
  const footerTopY = 262;
  const footerBottomY = 292;
  
  // Terms & Conditions (Left Side)
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Term & Conditions", 12, footerTopY + 5);
  
  if (invoice.terms) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    const splitTerms = doc.splitTextToSize(invoice.terms, 100);
    doc.text(splitTerms, 12, footerTopY + 9);
  }
  
  // Signature Area (Right Side Box)
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  // Center text in the right box (120 to 200, center is 160)
  doc.text(`For ${business?.name || ""}`, 160, footerTopY + 5, { align: 'center' });
  
  doc.setFontSize(8);
  doc.text("Authorised Signatory", 160, footerBottomY - 3, { align: 'center' });

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
