import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export type FilterType = 'today' | 'yesterday' | 'last7Days' | 'last30Days' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear' | 'allTime' | 'custom' | 'day' | 'year';

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatCompactCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export function formatCurrencyNoDecimals(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(amount);
}

export function getDateRange(filter: FilterType, day?: string, year?: number, customRange?: { start: string; end: string }) {
  const now = new Date();
  let start = new Date();
  let end = new Date();

  switch (filter) {
    case 'today':
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case 'yesterday':
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'last7Days':
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'last30Days':
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case 'thisWeek':
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      break;
    case 'lastWeek':
      start.setDate(now.getDate() - now.getDay() - 7);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - now.getDay() - 1);
      end.setHours(23, 59, 59, 999);
      break;
    case 'thisMonth':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'lastMonth':
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
      break;
    case 'thisQuarter':
      const currentQuarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), currentQuarter * 3, 1);
      break;
    case 'lastQuarter':
      const lastQuarter = Math.floor(now.getMonth() / 3) - 1;
      start = new Date(now.getFullYear(), lastQuarter * 3, 1);
      end = new Date(now.getFullYear(), (lastQuarter + 1) * 3, 0);
      break;
    case 'thisYear':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'lastYear':
      start = new Date(now.getFullYear() - 1, 0, 1);
      end = new Date(now.getFullYear() - 1, 11, 31);
      break;
    case 'allTime':
      start = new Date(2000, 0, 1);
      break;
    case 'day':
      if (day) {
        const [y, m, d] = day.split('-').map(Number);
        start = new Date(y, m - 1, d);
        end = new Date(y, m - 1, d);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      }
      break;
    case 'year':
      if (year) {
        start = new Date(year, 0, 1);
        end = new Date(year, 11, 31);
      }
      break;
    case 'custom':
      if (customRange?.start && customRange?.end) {
        const [sy, sm, sd] = customRange.start.split('-').map(Number);
        const [ey, em, ed] = customRange.end.split('-').map(Number);
        start = new Date(sy, sm - 1, sd);
        end = new Date(ey, em - 1, ed);
      }
      break;
  }

  return {
    startDate: start,
    endDate: end
  };
}

export function downloadFile(data: string | Blob, filename: string) {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (typeof data !== 'string') {
    URL.revokeObjectURL(url);
  }
}

export function formatSeriesNumber(num: number, prefix: string = '', lengthOrName: number | string = 4): string {
  let length = 4;
  if (typeof lengthOrName === 'number') {
    length = lengthOrName;
  } else if (typeof lengthOrName === 'string') {
    const match = lengthOrName.match(/([0-9]+)$/);
    if (match) {
      length = match[0].length;
    }
  }
  return `${prefix}${String(num).padStart(length, '0')}`;
}

export async function resizeImage(file: File | string, maxWidth: number = 800, maxHeight: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = reject;
    
    if (typeof file === 'string') {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    }
  });
}
