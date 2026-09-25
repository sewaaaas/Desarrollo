import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import { getClientEnvironment } from '@/shared/config/env'
import '@/styles/globals.css'

getClientEnvironment()

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('No se encontró el elemento raíz de la aplicación')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
