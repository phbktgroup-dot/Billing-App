import * as XLSX from 'xlsx';
import { downloadFile } from './utils';

export const generateGSTExcel = async (data: any[], reportName: string) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadFile(blob, `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const generateProfitLossExcel = async (data: any, business: { name: string }) => {
  const worksheetData = [
    ['Profit and Loss Ledger'],
    ['Business', business.name],
    ['Date', new Date().toLocaleDateString()],
    [],
    ['Category', 'Amount'],
    ['Total Sales', (data.totalSales || 0).toFixed(2)],
    ['Total Purchases', (data.totalPurchases || 0).toFixed(2)],
    ['Total Expenses', (data.totalExpenses || 0).toFixed(2)],
    ['Net Profit', (data.netProfit || 0).toFixed(2)]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Profit and Loss');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadFile(blob, `profit-loss-ledger-${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const generateLedgerExcel = async (data: {
  partyName: string;
  startDate: string;
  endDate: string;
  entries: any[];
  totals: any;
  type: 'Customer' | 'Supplier';
}, business: any) => {
  const businessProfile = Array.isArray(business) ? business[0] : business;
  
  const worksheetData = [
    [businessProfile?.name || 'Business Ledger'],
    [`${data.type} Ledger Account Statement`],
    [data.type, data.partyName],
    ['Period', `${data.startDate} to ${data.endDate}`],
    [],
    ['Date', 'Particulars', 'Voucher Type', 'Voucher No.', 'Debit', 'Credit', 'Balance'],
    ...data.entries.map(entry => {
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
        entry.debit,
        entry.credit,
        `${Math.abs(entry.balance).toFixed(2)} ${entry.balance >= 0 ? 'Dr' : 'Cr'}`
      ];
    }),
    [],
    ['Total', '', '', '', data.totals.totalDebit, data.totals.totalCredit, `${Math.abs(data.totals.closingBalance).toFixed(2)} ${data.totals.closingBalance >= 0 ? 'Dr' : 'Cr'}`]
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');
  
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  await downloadFile(blob, `ledger-${data.partyName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.xlsx`);
};
