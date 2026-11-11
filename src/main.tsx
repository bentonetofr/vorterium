import './styles' // todo o CSS do site, na ordem certa: tem que ser o primeiro import
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppProviders } from './app/providers'
import { installNoSpaceActivation } from './shared/lib/noSpaceActivation'
import { installScrollReveal } from './shared/lib/scrollReveal'
import './shared/lib/installApp' // ouve desde o começo o aviso de que dá pra instalar (ele só vem uma vez)

installNoSpaceActivation()
installScrollReveal()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders />
  </React.StrictMode>
)
