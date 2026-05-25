import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout } from '../layouts/PublicLayout'
import { PrivateLayout } from '../layouts/PrivateLayout'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { GuestRoute } from '../../features/auth/GuestRoute'

import { LoginPage }       from '../../features/auth/pages/LoginPage'
import { RegisterPage }    from '../../features/auth/pages/RegisterPage'
import { AuthCallbackPage } from '../../features/auth/pages/AuthCallbackPage'

import { CampaignsPage }   from '../../features/campaigns/pages/CampaignsPage'
import { NewCampaignPage } from '../../features/campaigns/pages/NewCampaignPage'
import { CampaignAreaPage } from '../../features/campaigns/pages/CampaignAreaPage'

import { LandingPage }     from '../../features/public/pages/LandingPage'
import { SobrePage }       from '../../features/public/pages/SobrePage'
import { TermosPage }      from '../../features/public/pages/TermosPage'
import { PrivacidadePage } from '../../features/public/pages/PrivacidadePage'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Rotas públicas (sem autenticação) ── */}
        <Route element={<PublicLayout />}>
          {/* Landing page — acessível a todos */}
          <Route path="/" element={<LandingPage />} />

          {/* Páginas institucionais — acessíveis a todos */}
          <Route path="/sobre"       element={<SobrePage />} />
          <Route path="/termos"      element={<TermosPage />} />
          <Route path="/privacidade" element={<PrivacidadePage />} />

          {/* Auth — bloqueadas para usuários logados */}
          <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/cadastro" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Callback OAuth — sempre acessível */}
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        {/* ── Rotas privadas (requerem autenticação) ── */}
        <Route element={<ProtectedRoute><PrivateLayout /></ProtectedRoute>}>
          <Route path="/campanhas"              element={<CampaignsPage />} />
          <Route path="/campanhas/nova"         element={<NewCampaignPage />} />
          <Route path="/campanhas/:campaignId"  element={<CampaignAreaPage />} />
        </Route>

        {/* ── 404 → raiz ── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
