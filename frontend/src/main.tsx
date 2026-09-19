import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/global.css'
import './i18n'
import App from './App'
import { syncViewportHeight } from './app/viewport'

syncViewportHeight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
