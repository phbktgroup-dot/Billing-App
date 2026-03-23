import JSZip from 'jszip';

export const generateGST1Zip = async (filename: string, csvContent: string) => {
  const zip = new JSZip();
  zip.file(`${filename}.csv`, csvContent);
  
  const content = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.zip`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
