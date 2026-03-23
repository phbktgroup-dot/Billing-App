
export const getApiUrl = (path: string) => {
  // If we're in Electron (file protocol) or Capacitor (http://localhost or capacitor://localhost)
  if (
    window.location.protocol === 'file:' || 
    window.location.hostname === 'localhost' || 
    window.location.protocol === 'capacitor:'
  ) {
    // Check if we are in development mode
    if (import.meta.env.DEV) {
      return `http://localhost:3000${path.startsWith('/') ? '' : '/'}${path}`;
    }

    // In production desktop/mobile app, use the environment variable if available, otherwise fallback
    const baseUrl = import.meta.env.VITE_APP_URL || 'https://billing-app-mocha.vercel.app';
    
    // Ensure no trailing slash on baseUrl
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${cleanBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  
  // In the browser (web app), relative paths work fine because the frontend and backend are on the same origin
  return path;
};
