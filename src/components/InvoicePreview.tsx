import React from 'react';
import { InvoiceData, BusinessProfile } from '../lib/pdfGenerator';

interface InvoicePreviewProps {
  invoice: InvoiceData;
  business: BusinessProfile;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({ invoice, business }) => {
  return (
    <div className="bg-white p-8 w-full max-w-[800px] mx-auto text-slate-900 font-sans border border-slate-200 shadow-lg">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          {business.logo_url && <img src={business.logo_url} alt="Logo" className="w-16 h-16 object-contain" />}
          <div>
            <h1 className="text-2xl font-bold">PHBKT Group Limited</h1>
            <p className="text-sm text-slate-600">
              {[business.address1, business.address2, business.city, business.state, business.pincode].filter(Boolean).join(', ')}
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold">TAX INVOICE</h2>
          <p className="text-sm">Invoice No: {invoice.invoice_number}</p>
          <p className="text-sm">Date: {new Date(invoice.date).toLocaleDateString()}</p>
        </div>
      </div>

      {/* Buyer Details */}
      <div className="mb-8 p-4 bg-slate-50 rounded-lg">
        <h3 className="font-bold mb-2">Buyer Details:</h3>
        <p>{invoice.customer_name}</p>
        <p className="text-sm text-slate-600">GSTIN: {invoice.customer_gstin}</p>
      </div>

      {/* Table */}
      <table className="w-full mb-8 border-collapse">
        <thead>
          <tr className="bg-slate-100">
            <th className="border p-2 text-left">S.N.</th>
            <th className="border p-2 text-left">Description</th>
            <th className="border p-2 text-left">Product Code</th>
            <th className="border p-2 text-right">Qty</th>
            <th className="border p-2 text-right">Rate</th>
            <th className="border p-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={index}>
              <td className="border p-2">{index + 1}</td>
              <td className="border p-2">{item.name}</td>
              <td className="border p-2">{item.sku || '-'}</td>
              <td className="border p-2 text-right">{item.quantity}</td>
              <td className="border p-2 text-right">{item.rate.toFixed(2)}</td>
              <td className="border p-2 text-right">{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-64">
          <div className="flex justify-between mb-2">
            <span>Subtotal:</span>
            <span>{invoice.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>GST:</span>
            <span>{invoice.tax_amount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span>{invoice.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
