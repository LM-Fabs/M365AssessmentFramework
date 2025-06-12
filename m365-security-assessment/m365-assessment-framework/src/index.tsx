import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Cache-busting comment - force new build hash
console.log('M365 Assessment Framework v1.0.3 - Cache-busting deployment');

const container = document.getElementById('root');
if (!container) throw new Error('Failed to find the root element');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);