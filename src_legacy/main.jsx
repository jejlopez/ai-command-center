import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { SystemStateProvider } from './context/SystemStateContext'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SystemStateProvider>
      <App />
    </SystemStateProvider>
  </StrictMode>,
)
