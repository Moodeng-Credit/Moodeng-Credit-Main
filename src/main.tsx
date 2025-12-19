import { StrictMode } from 'react';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.tsx';
import './globals.css';

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <BrowserRouter>
         <App />
      </BrowserRouter>
   </StrictMode>
);
