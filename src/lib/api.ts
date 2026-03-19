
export const getApiUrl = (path: string) => {
  // If we're in Electron (file protocol), we need the full URL of the deployed server
  if (window.location.protocol === 'file:') {
    // This should be the URL of your deployed application
    // We try multiple sources for the base URL
    const baseUrl = 
      localStorage.getItem('API_BASE_URL') ||
      import.meta.env.VITE_APP_URL || 
      process.env.APP_URL || 
      'https://ais-dev-63egfcyw5xcnj4izhkgqaa-583844668197.asia-east1.run.app'; // Default to dev URL for testing
    return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  
  // In the browser, relative paths work fine
  return path;
};
