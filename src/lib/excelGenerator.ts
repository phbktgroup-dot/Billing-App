import * as XLSX from 'xlsx';

export const generateProfitLossExcel = (data: any, business: { name: string }) => {
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
  
  XLSX.writeFile(workbook, `profit-loss-ledger-${new Date().toISOString().split('T')[0]}.xlsx`);
};
