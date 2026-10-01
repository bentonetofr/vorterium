import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import { installNoSpaceActivation } from './shared/lib/noSpaceActivation'
import './index.css'
import './shared/theme/motion.css'

installNoSpaceActivation()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
)
