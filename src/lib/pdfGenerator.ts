import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { numberToWords } from './numberToWords';

export interface InvoiceData {
  invoice_number: string;
  date: string;
  customer_name: string;
  customer_gstin?: string;
  payment_mode?: string;
  items: {
    name: string;
    quantity: number;
    rate: number;
    gstRate?: number;
    amount: number;
  }[];
  subtotal: number;
  tax_amount: number;
  total: number;
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

export const generateInvoicePDF = async (invoice: InvoiceData, business: BusinessProfile) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  
  // Outer border
  doc.rect(10, 10, 190, 277);
  
  // Horizontal lines
  doc.line(10, 45, 200, 45);
  doc.line(10, 75, 200, 75);
  doc.line(10, 85, 200, 85);
  doc.line(10, 95, 200, 95);
  doc.line(10, 230, 200, 230);
  doc.line(10, 240, 200, 240);
  doc.line(10, 250, 200, 250);
  doc.line(10, 265, 200, 265);
  
  // Vertical lines
  doc.line(105, 45, 105, 85); // Header middle
  
  // Table columns (from 85 to 240)
  doc.line(20, 85, 20, 240);
  doc.line(95, 85, 95, 240);
  doc.line(115, 85, 115, 240);
  doc.line(130, 85, 130, 240);
  doc.line(140, 85, 140, 240);
  doc.line(155, 85, 155, 240);
  doc.line(165, 85, 165, 240);
  doc.line(180, 85, 180, 240);
  
  // Footer middle
  doc.line(120, 265, 120, 287);

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
  doc.text("PHBKT", 42, 18);
  doc.text("Group", 42, 24);
  doc.text("Limited", 42, 30);
  
  // Red underline
  doc.setDrawColor(200, 0, 0);
  doc.setLineWidth(0.8);
  doc.line(15, 36, 65, 36);
  doc.setDrawColor(0); // reset
  doc.setLineWidth(0.5);

  // Center Header
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("TAX INVOICE", 105, 15, { align: 'center' });
  
  doc.setFontSize(12);
  doc.text(business?.name || "Ambade Associate", 105, 21, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(business?.address || "garadwadi Shevgajon maharashtra 414501", 105, 26, { align: 'center' });
  doc.text(`Tel: ${business?.mobile || "9545886257"}   Email: ${business?.email || "hh@gmail.com"}`, 105, 30, { align: 'center' });
  
  doc.setFont("helvetica", "bold");
  doc.text(`PAN NO.: ${business?.pan_number || "BSFPG3597I"} , GST NO. : ${business?.gst_number || ""}`, 105, 34, { align: 'center' });
  doc.text(`${business?.bank_name || "HDFC BANK"} A/C NO :- ${business?.bank_account_no || "50200026615791"}, IFSC :- ${business?.bank_ifsc || "HDFC0003800"}`, 105, 38, { align: 'center' });
  doc.text(`Branch : ${business?.bank_branch || "Bahu Jamalpur, Rohtak-124001 Haryana"}`, 105, 42, { align: 'center' });

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
  
  doc.setFont("helvetica", "bold");
  doc.text("STATE CODE :", 65, 70);
  doc.setFont("helvetica", "normal");
  doc.text("27", 90, 70);
  
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
  doc.text("Description of Goods", 57.5, 91, { align: 'center' });
  doc.text("Item Code /\nPart NO.", 105, 89, { align: 'center' });
  doc.text("HSN /\nSAC\nCode", 122.5, 88, { align: 'center' });
  doc.text("Cas\ne", 135, 89, { align: 'center' });
  doc.text("Qty.", 147.5, 91, { align: 'center' });
  doc.text("Unit", 160, 91, { align: 'center' });
  doc.text("Price", 172.5, 91, { align: 'center' });
  doc.text("Amount\n(Rs.)", 190, 89, { align: 'center' });

  // Table Items
  doc.setFont("helvetica", "normal");
  let currentY = 102;
  invoice.items.forEach((item, index) => {
    doc.text((index + 1).toString(), 15, currentY, { align: 'center' });
    doc.text(item.name, 22, currentY);
    doc.text("", 105, currentY, { align: 'center' }); // Item Code
    doc.text("", 122.5, currentY, { align: 'center' }); // HSN
    doc.text("", 135, currentY, { align: 'center' }); // Case
    doc.text(item.quantity.toString(), 147.5, currentY, { align: 'center' });
    doc.text("NOS", 160, currentY, { align: 'center' });
    doc.text(item.rate.toFixed(2), 178, currentY, { align: 'right' });
    doc.text(item.amount.toFixed(2), 198, currentY, { align: 'right' });
    
    currentY += 7;
  });

  // Total Row
  doc.setFont("helvetica", "bold");
  doc.text("Total :", 25, 236);
  
  const totalQty = invoice.items.reduce((sum, i) => sum + i.quantity, 0);
  doc.text(totalQty.toString(), 147.5, 236, { align: 'center' });
  doc.text(invoice.subtotal.toFixed(2), 198, 236, { align: 'right' });

  // GST Row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("GST :", 12, 246);
  
  doc.setFont("helvetica", "normal");
  doc.text(numberToWords(Math.round(invoice.tax_amount)).toUpperCase() + " ONLY", 25, 246);
  
  doc.setFont("helvetica", "bold");
  doc.text(`Add :GST ${invoice.items[0]?.gstRate || 18} %`, 150, 246);
  doc.text(invoice.tax_amount.toFixed(2), 198, 246, { align: 'right' });

  // In Words Row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("In Words :", 12, 255);
  
  doc.setFont("helvetica", "bold");
  doc.text(numberToWords(Math.round(invoice.total)).toUpperCase() + " ONLY", 12, 261);
  
  doc.text("GRAND TOTAL :", 150, 261);
  doc.text(invoice.total.toFixed(2), 198, 261, { align: 'right' });

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Term & Conditions", 12, 270);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("1. Intimation of inspection of goods & rejection if any must be sent back within 15 days", 12, 274);
  doc.text("from the date of Delivery of Material.", 12, 277);
  doc.text("2. Our responsibility ceases immediately after goods are delivered to the carriers.", 12, 280);
  doc.text("3. All disputes are subject to Rohtak Jurisdiction.", 12, 283);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(`For ${business?.name || "Ambade Associate"}`, 198, 270, { align: 'right' });
  doc.text("Authorised Signatory", 198, 285, { align: 'right' });

  doc.save(`invoice-${invoice.invoice_number}.pdf`);
};
