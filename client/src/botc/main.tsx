import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './botc.css'
import { AuthProvider } from '../context/AuthContext'
import Botc from './Botc'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Botc />
    </AuthProvider>
  </StrictMode>,
)
