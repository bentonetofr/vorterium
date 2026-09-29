import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout }   from '../layouts/PublicLayout'
import { PrivateLayout }  from '../layouts/PrivateLayout'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { GuestRoute }     from '../../features/auth/GuestRoute'

import { LoginPage }        from '../../features/auth/pages/LoginPage'
import { RegisterPage }     from '../../features/auth/pages/RegisterPage'
import { AuthCallbackPage } from '../../features/auth/pages/AuthCallbackPage'

import { CampaignsPage }   from '../../features/campaigns/pages/CampaignsPage'
import { NewCampaignPage } from '../../features/campaigns/pages/NewCampaignPage'
import { CampaignAreaLayout } from '../../features/campaigns/pages/CampaignAreaLayout'
import { ProfilePage }     from '../../features/users/pages/ProfilePage'
import { MySheetsPage }        from '../../features/sheets/pages/MySheetsPage'
import { GlobalActivityPage } from '../../features/activity/pages/GlobalActivityPage'
import { LibraryPage }        from '../../features/library/pages/LibraryPage'
import { MyBestiaryPage }     from '../../features/bestiary/pages/MyBestiaryPage'
import { GalleryPage }        from '../../features/mesa/pages/GalleryPage'
import { NewsPage }           from '../../features/news/pages/NewsPage'
import { HelpPage }           from '../../features/help/pages/HelpPage'
import { FeedbackPage }       from '../../features/feedback/pages/FeedbackPage'
import { MorePage }           from '../../features/more/pages/MorePage'

import { LandingPage }     from '../../features/public/pages/LandingPage'
import { SobrePage }       from '../../features/public/pages/SobrePage'
import { TermosPage }      from '../../features/public/pages/TermosPage'
import { PrivacidadePage } from '../../features/public/pages/PrivacidadePage'

import { InvitePage } from '../../features/invites/pages/InvitePage'

import { DevRoute }         from '../../features/dev/DevRoute'
import { DevLayout }        from '../../features/dev/DevLayout'
import { DevLoginPage }     from '../../features/dev/pages/DevLoginPage'
import { DevOverviewPage }  from '../../features/dev/pages/DevOverviewPage'
import { DevFeedbackPage }  from '../../features/dev/pages/DevFeedbackPage'
import { DevUsersPage, DevUserPage } from '../../features/dev/pages/DevUsersPage'
import { DevCampaignsPage, DevCampaignPage } from '../../features/dev/pages/DevCampaignsPage'

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* ── Rotas públicas (sem autenticação obrigatória) ── */}
        <Route element={<PublicLayout />}>
          <Route path="/"            element={<LandingPage />} />
          <Route path="/sobre"       element={<SobrePage />} />
          <Route path="/termos"      element={<TermosPage />} />
          <Route path="/privacidade" element={<PrivacidadePage />} />

          {/* Convite: acessível a todos; processa auth internamente */}
          <Route path="/convite/:token" element={<InvitePage />} />

          {/* Auth — bloqueadas para usuários logados */}
          <Route path="/login"    element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/cadastro" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          <Route path="/auth/callback" element={<AuthCallbackPage />} />
        </Route>

        {/* ── Desenvolvedor: login próprio (sem link no site) e painel ── */}
        <Route path="/dev/entrar" element={<DevLoginPage />} />
        <Route element={<DevRoute><DevLayout /></DevRoute>}>
          <Route path="/dev"                       element={<DevOverviewPage />} />
          <Route path="/dev/feedback"              element={<DevFeedbackPage />} />
          <Route path="/dev/usuarios"              element={<DevUsersPage />} />
          <Route path="/dev/usuarios/:userId"      element={<DevUserPage />} />
          <Route path="/dev/campanhas"             element={<DevCampaignsPage />} />
          <Route path="/dev/campanhas/:campaignId" element={<DevCampaignPage />} />
        </Route>

        {/* ── Rotas privadas (requerem autenticação) ── */}
        <Route element={<ProtectedRoute><PrivateLayout /></ProtectedRoute>}>
          <Route path="/campanhas"             element={<CampaignsPage />} />
          <Route path="/campanhas/nova"        element={<NewCampaignPage />} />
          <Route path="/campanhas/:campaignId/*" element={<CampaignAreaLayout />} />
          <Route path="/minhas-fichas"         element={<MySheetsPage />} />
          <Route path="/atividade"            element={<GlobalActivityPage />} />
          <Route path="/perfil"               element={<ProfilePage />} />
          <Route path="/biblioteca"           element={<LibraryPage />} />
          <Route path="/meu-bestiario"        element={<MyBestiaryPage />} />
          <Route path="/galeria"              element={<GalleryPage />} />
          <Route path="/novidades"            element={<NewsPage />} />
          <Route path="/ajuda"                element={<HelpPage />} />
          <Route path="/feedback"             element={<FeedbackPage />} />
          <Route path="/mais"                 element={<MorePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
