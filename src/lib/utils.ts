import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCompactCurrency(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatSeriesNumber(series: any, numberToFormat?: number) {
  if (!series) return '';
  const num = numberToFormat !== undefined ? numberToFormat : (series.current_number || 1);
  let padded = num.toString();
  if (series.name && series.prefix && series.name.startsWith(series.prefix)) {
    const numPart = series.name.substring(series.prefix.length);
    if (/^\d+$/.test(numPart)) {
      padded = num.toString().padStart(numPart.length, '0');
    }
  }
  return `${series.prefix}${padded}`;
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export type FilterType = 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'last7Days' | 'last30Days' | 'day' | 'custom' | 'year';

export function getDateRange(
  filterType: FilterType,
  day: string,
  year: number,
  customRange: { start: string; end: string }
): { startDate: Date; endDate: Date } {
  const now = new Date();
  let startDate: Date;
  let endDate: Date;

  if (filterType === 'thisMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  } else if (filterType === 'lastMonth') {
    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
  } else if (filterType === 'thisYear') {
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
  } else if (filterType === 'lastYear') {
    startDate = new Date(now.getFullYear() - 1, 0, 1);
    endDate = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
  } else if (filterType === 'last7Days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (filterType === 'last30Days') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(now);
    endDate.setHours(23, 59, 59, 999);
  } else if (filterType === 'day') {
    const [y, m, d] = day.split('-').map(Number);
    startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
    endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
  } else if (filterType === 'year') {
    startDate = new Date(year, 0, 1, 0, 0, 0, 0);
    endDate = new Date(year, 11, 31, 23, 59, 59, 999);
  } else {
    const [startYear, startMonth, startDateNum] = customRange.start.split('-').map(Number);
    const [endYear, endMonth, endDateNum] = customRange.end.split('-').map(Number);
    startDate = new Date(startYear, startMonth - 1, startDateNum, 0, 0, 0, 0);
    endDate = new Date(endYear, endMonth - 1, endDateNum, 23, 59, 59, 999);
  }

  return { startDate, endDate };
}

export async function downloadFile(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    
    // 1. Direct Download (Works on Desktop and most Mobile browsers)
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // 2. Web Share API (Convenience for Mobile)
    // This allows users to easily send the file to WhatsApp, Email, or Save to Files
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare({ files: [file] })) {
          // We don't await here to avoid blocking the UI
          navigator.share({
            files: [file],
            title: filename,
          }).catch((err) => {
            // Ignore AbortError (user cancelled)
            if (err.name !== 'AbortError') {
              console.warn('Share failed:', err);
            }
          });
        }
      } catch (shareError) {
        console.warn('Error preparing share:', shareError);
      }
    }

    // Revoke the URL after a delay to ensure the browser has started the download
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (error) {
    console.error('Download failed:', error);
  }
}
