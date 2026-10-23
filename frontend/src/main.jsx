import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App'
import { AuthProvider } from './context/AuthContext'
import { LiveProvider } from './context/LiveContext'
import { CartProvider } from './context/CartContext'
import { ThemeProvider } from './context/ThemeContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <LiveProvider>
            <CartProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  className: '!rounded-xl !text-sm !font-medium dark:!bg-slate-800 dark:!text-slate-100',
                  style: { whiteSpace: 'pre-line' },
                }}
              />
            </CartProvider>
          </LiveProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
