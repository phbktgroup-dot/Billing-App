import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileUp, 
  FileSpreadsheet, 
  FileText, 
  File as FileIcon, 
  X, 
  ChevronRight, 
  Download,
  Search,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import { cn } from '../lib/utils';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface FileData {
  name: string;
  type: 'excel' | 'csv' | 'pdf';
  size: number;
  columns: string[];
  rows: any[];
}

export default function DataImport() {
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const parseExcel = async (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (json.length === 0) {
            reject(new Error('The Excel file is empty.'));
            return;
          }

          const columns = (json[0] as string[]).map(col => col?.toString() || 'Unnamed Column');
          const rows = json.slice(1).map((row: any) => {
            const rowObj: any = {};
            columns.forEach((col, index) => {
              rowObj[col] = row[index];
            });
            return rowObj;
          });

          resolve({
            name: file.name,
            type: 'excel',
            size: file.size,
            columns,
            rows
          });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsArrayBuffer(file);
    });
  };

  const parseCSV = async (file: File): Promise<FileData> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            reject(new Error(results.errors[0].message));
            return;
          }
          resolve({
            name: file.name,
            type: 'csv',
            size: file.size,
            columns: results.meta.fields || [],
            rows: results.data
          });
        },
        error: (err) => reject(err)
      });
    });
  };

  const parsePDF = async (file: File): Promise<FileData> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let allRows: any[] = [];
    let columns: string[] = [];

    // PDF parsing is complex. We'll try to extract text content and guess columns.
    // This is a simplified version that looks for tabular structure.
    for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) { // Limit to first 5 pages for performance
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      // Group items by their Y coordinate (lines)
      const lines: any = {};
      textContent.items.forEach((item: any) => {
        const y = Math.round(item.transform[5]);
        if (!lines[y]) lines[y] = [];
        lines[y].push(item);
      });

      // Sort lines by Y descending (top to bottom)
      const sortedY = Object.keys(lines).sort((a, b) => Number(b) - Number(a));
      
      sortedY.forEach((y, index) => {
        const lineItems = lines[y].sort((a: any, b: any) => a.transform[4] - b.transform[4]);
        const rowData = lineItems.map((item: any) => item.str.trim()).filter((s: string) => s !== '');
        
        if (rowData.length > 0) {
          if (columns.length === 0) {
            columns = rowData.map((_, idx) => `Col ${idx + 1}`);
            // Use the first line as potential headers if it looks like one
            if (index === 0) {
               columns = rowData;
            } else {
               const rowObj: any = {};
               columns.forEach((col, idx) => {
                 rowObj[col] = rowData[idx] || '';
               });
               allRows.push(rowObj);
            }
          } else {
            const rowObj: any = {};
            columns.forEach((col, idx) => {
              rowObj[col] = rowData[idx] || '';
            });
            allRows.push(rowObj);
          }
        }
      });
    }

    return {
      name: file.name,
      type: 'pdf',
      size: file.size,
      columns,
      rows: allRows
    };
  };

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsParsing(true);
    setError(null);
    setFileData(null);

    try {
      let data: FileData;
      const extension = file.name.split('.').pop()?.toLowerCase();

      if (extension === 'xlsx' || extension === 'xls') {
        data = await parseExcel(file);
      } else if (extension === 'csv') {
        data = await parseCSV(file);
      } else if (extension === 'pdf') {
        data = await parsePDF(file);
      } else {
        throw new Error('Unsupported file format. Please upload Excel, CSV, or PDF.');
      }

      setFileData(data);
    } catch (err: any) {
      console.error('File parsing error:', err);
      setError(err.message || 'An error occurred while parsing the file.');
    } finally {
      setIsParsing(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const filteredRows = fileData?.rows.filter(row => 
    Object.values(row).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  ) || [];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Data Import & Viewer</h1>
            <p className="text-slate-500">Upload Excel, CSV, or PDF files to view their content</p>
          </div>
          {fileData && (
            <button 
              onClick={() => setFileData(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors"
            >
              <X size={16} />
              Clear File
            </button>
          )}
        </div>

        {/* Upload Area */}
        {!fileData && !isParsing && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div
              {...getRootProps()}
              className={cn(
                "relative group cursor-pointer",
                "border-2 border-dashed rounded-3xl p-12 transition-all duration-300",
                isDragActive 
                  ? "border-primary bg-primary/5 scale-[1.01]" 
                  : "border-slate-200 bg-white hover:border-primary/50 hover:bg-slate-50"
              )}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-300">
                  <FileUp size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-slate-900">
                    {isDragActive ? "Drop your file here" : "Click or drag file to upload"}
                  </h3>
                  <p className="text-slate-500 max-w-xs mx-auto">
                    Support for Excel (.xlsx, .xls), CSV, and PDF files. Max size 10MB.
                  </p>
                </div>
                <div className="flex items-center gap-4 pt-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <FileSpreadsheet size={14} className="text-green-600" />
                    Excel
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <FileText size={14} className="text-blue-600" />
                    CSV
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full">
                    <FileIcon size={14} className="text-red-600" />
                    PDF
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {isParsing && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 className="w-12 h-12 text-primary animate-spin" />
            <p className="text-slate-600 font-medium">Parsing file content...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 border border-red-100 rounded-2xl p-6 flex items-start gap-4"
          >
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
              <AlertCircle size={24} />
            </div>
            <div className="space-y-1">
              <h4 className="font-semibold text-red-900">Upload Failed</h4>
              <p className="text-red-700 text-sm">{error}</p>
              <button 
                onClick={() => setError(null)}
                className="text-sm font-medium text-red-600 hover:underline pt-2"
              >
                Try again
              </button>
            </div>
          </motion.div>
        )}

        {/* Data View */}
        {fileData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* File Info Card */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  fileData.type === 'excel' ? "bg-green-50 text-green-600" :
                  fileData.type === 'csv' ? "bg-blue-50 text-blue-600" :
                  "bg-red-50 text-red-600"
                )}>
                  {fileData.type === 'excel' ? <FileSpreadsheet size={24} /> :
                   fileData.type === 'csv' ? <FileText size={24} /> :
                   <FileIcon size={24} />}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{fileData.name}</h3>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span>{formatSize(fileData.size)}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span>{fileData.rows.length} Rows</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span>{fileData.columns.length} Columns</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Search in data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all w-full md:w-64"
                  />
                </div>
                <button 
                  onClick={() => {
                    const ws = XLSX.utils.json_to_sheet(fileData.rows);
                    const wb = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(wb, ws, "Data");
                    XLSX.writeFile(wb, `Exported_${fileData.name.split('.')[0]}.xlsx`);
                  }}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                  title="Export to Excel"
                >
                  <Download size={20} />
                </button>
              </div>
            </div>

            {/* Table View */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {fileData.columns.map((col, idx) => (
                        <th key={idx} className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRows.length > 0 ? (
                      filteredRows.slice(0, 100).map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-slate-50/50 transition-colors group">
                          {fileData.columns.map((col, colIdx) => (
                            <td key={colIdx} className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={fileData.columns.length} className="px-6 py-20 text-center">
                          <div className="flex flex-col items-center space-y-2">
                            <Search size={40} className="text-slate-200" />
                            <p className="text-slate-500 font-medium">No matching data found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredRows.length > 100 && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-500">
                    Showing first 100 rows of {filteredRows.length}. Use search to find specific records.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
