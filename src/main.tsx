import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register the ConnectX PWA Service Worker (/sw.js)
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch(() => {
        // Fallback handled gracefully by VitePWA module service worker in dev mode
      });
  });
}

createRoot(document.getElementById('root')!).render(<App />);
