import JSZip from 'jszip';
import { downloadFile } from './utils';

export const generateGST1Zip = async (filename: string, csvContent: string) => {
  const zip = new JSZip();
  zip.file(`${filename}.csv`, csvContent);
  
  const content = await zip.generateAsync({ type: 'blob' });
  await downloadFile(content, `${filename}_${new Date().toISOString().split('T')[0]}.zip`);
};
