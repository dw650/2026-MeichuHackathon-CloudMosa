import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/global.css'
import './i18n'
import App from './App'
import { installDemoHeaders } from './app/demoHeaders'
import { syncViewportHeight } from './app/viewport'

syncViewportHeight()
installDemoHeaders()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
