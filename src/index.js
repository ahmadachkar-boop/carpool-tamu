import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ActiveNDRProvider } from './ActiveNDRContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <BrowserRouter>
    <AuthProvider>
      <ActiveNDRProvider>
        <App />
      </ActiveNDRProvider>
    </AuthProvider>
  </BrowserRouter>
);