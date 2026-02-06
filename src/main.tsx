import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { AuthProvider } from './contexts/AuthContext'
import { ErrorBoundary } from './components/ErrorBoundary'
import App from './App.tsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// Obtener el Client ID de Google desde las variables de entorno
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

if (!GOOGLE_CLIENT_ID) {
  console.error('⚠️ VITE_GOOGLE_CLIENT_ID no está configurado. Por favor, agrega esta variable en tu archivo .env.local')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {GOOGLE_CLIENT_ID ? (
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <App />
            </AuthProvider>
          </QueryClientProvider>
        </GoogleOAuthProvider>
      ) : (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          flexDirection: 'column',
          padding: '20px',
          textAlign: 'center'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: '10px' }}>⚠️ Error de Configuración</h1>
          <p style={{ color: '#6b7280' }}>
            VITE_GOOGLE_CLIENT_ID no está configurado.
          </p>
          <p style={{ color: '#6b7280', marginTop: '10px' }}>
            Por favor, crea un archivo <code>.env.local</code> en la raíz del proyecto y agrega:
          </p>
          <pre style={{ 
            background: '#f3f4f6', 
            padding: '15px', 
            borderRadius: '5px',
            marginTop: '10px',
            textAlign: 'left'
          }}>
            VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
          </pre>
        </div>
      )}
    </ErrorBoundary>
  </React.StrictMode>,
)
