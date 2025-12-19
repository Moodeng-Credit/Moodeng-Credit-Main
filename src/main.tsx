import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fortawesome/fontawesome-free/css/all.min.css';
import '@rainbow-me/rainbowkit/styles.css';

import App from './App';
import { Providers } from './components/providers';

import './app/globals.css';
import './lib/startup';

createRoot(document.getElementById('root')!).render(
   <StrictMode>
      <BrowserRouter>
         <Providers>
            <App />
         </Providers>
      </BrowserRouter>
   </StrictMode>
);
