
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

/**
 * Robust Service Worker registration
 */
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) return;

  // Service workers require a secure context (HTTPS or localhost)
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isSecure = window.location.protocol === 'https:';

  if (!isLocalhost && !isSecure) {
    console.warn('Linguist Pro: Service Worker skipped (Not a secure context)');
    return;
  }

  try {
    // Using sw.js directly relative to the root for maximum compatibility
    // In some environments, './sw.js' is safer than '/sw.js'
    const registration = await navigator.serviceWorker.register('sw.js', {
      scope: './'
    });
    
    console.log('Linguist Pro: Service Worker registered with scope:', registration.scope);
  } catch (error) {
    // Log the error but don't crash the app
    console.error('Linguist Pro: Service Worker registration failed:', error);
  }
};

// Initiate registration
registerServiceWorker();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
