import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import { installNoSpaceActivation } from './shared/lib/noSpaceActivation'
import { installScrollReveal } from './shared/lib/scrollReveal'
import './index.css'
import './shared/theme/motion.css'
import './shared/theme/refine.css'
import './shared/theme/touch.css'

installNoSpaceActivation()
installScrollReveal()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
)
