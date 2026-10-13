import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './sala.css'
import { AuthProvider } from '../context/AuthContext'
import Sala from './Sala'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Sala />
    </AuthProvider>
  </StrictMode>,
)
