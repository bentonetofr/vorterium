import { Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { PublicLayout }   from '../layouts/PublicLayout'
import { ProtectedRoute } from '../../features/auth/ProtectedRoute'
import { GuestRoute }     from '../../features/auth/GuestRoute'

// A porta de entrada (página inicial, login, cadastro) vem no pacote
// principal, pra abrir na hora. Todo o resto chega sob demanda.
import { LandingPage }      from '../../features/public/pages/LandingPage'
import { LoginPage }        from '../../features/auth/pages/LoginPage'
import { RegisterPage }     from '../../features/auth/pages/RegisterPage'
import { AuthCallbackPage } from '../../features/auth/pages/AuthCallbackPage'
import { SecretShortcut, SECRET_PATH } from '../../shared/components/SecretTab'
import { DevRoute }         from '../../features/dev/DevRoute'
import { lazyPage, RouteFallback } from './lazyPage'

const PrivateLayout      = lazyPage(() => import('../layouts/PrivateLayout'), 'PrivateLayout')
const CampaignsPage      = lazyPage(() => import('../../features/campaigns/pages/CampaignsPage'), 'CampaignsPage')
const NewCampaignPage    = lazyPage(() => import('../../features/campaigns/pages/NewCampaignPage'), 'NewCampaignPage')
const CampaignAreaLayout = lazyPage(() => import('../../features/campaigns/pages/CampaignAreaLayout'), 'CampaignAreaLayout')
const VortablePage       = lazyPage(() => import('../../features/vortable/pages/VortablePage'), 'VortablePage')
const ProfilePage        = lazyPage(() => import('../../features/users/pages/ProfilePage'), 'ProfilePage')
const MySheetsPage       = lazyPage(() => import('../../features/sheets/pages/MySheetsPage'), 'MySheetsPage')
const GlobalActivityPage = lazyPage(() => import('../../features/activity/pages/GlobalActivityPage'), 'GlobalActivityPage')
const LibraryPage        = lazyPage(() => import('../../features/library/pages/LibraryPage'), 'LibraryPage')
const MyBestiaryPage     = lazyPage(() => import('../../features/bestiary/pages/MyBestiaryPage'), 'MyBestiaryPage')
const GalleryPage        = lazyPage(() => import('../../features/mesa/pages/GalleryPage'), 'GalleryPage')
const NewsPage           = lazyPage(() => import('../../features/news/pages/NewsPage'), 'NewsPage')
const HelpPage           = lazyPage(() => import('../../features/help/pages/HelpPage'), 'HelpPage')
const FeedbackPage       = lazyPage(() => import('../../features/feedback/pages/FeedbackPage'), 'FeedbackPage')
const MorePage           = lazyPage(() => import('../../features/more/pages/MorePage'), 'MorePage')

const SobrePage       = lazyPage(() => import('../../features/public/pages/SobrePage'), 'SobrePage')
const TermosPage      = lazyPage(() => import('../../features/public/pages/TermosPage'), 'TermosPage')
const PrivacidadePage = lazyPage(() => import('../../features/public/pages/PrivacidadePage'), 'PrivacidadePage')
const InvitePage      = lazyPage(() => import('../../features/invites/pages/InvitePage'), 'InvitePage')
const SecretPage      = lazyPage(() => import('../../shared/components/SecretTab'), 'SecretPage')

const DevLayout        = lazyPage(() => import('../../features/dev/DevLayout'), 'DevLayout')
const DevLoginPage     = lazyPage(() => import('../../features/dev/pages/DevLoginPage'), 'DevLoginPage')
const DevOverviewPage  = lazyPage(() => import('../../features/dev/pages/DevOverviewPage'), 'DevOverviewPage')
const DevFeedbackPage  = lazyPage(() => import('../../features/dev/pages/DevFeedbackPage'), 'DevFeedbackPage')
const DevUsersPage     = lazyPage(() => import('../../features/dev/pages/DevUsersPage'), 'DevUsersPage')
const DevUserPage      = lazyPage(() => import('../../features/dev/pages/DevUsersPage'), 'DevUserPage')
const DevCampaignsPage = lazyPage(() => import('../../features/dev/pages/DevCampaignsPage'), 'DevCampaignsPage')
const DevCampaignPage  = lazyPage(() => import('../../features/dev/pages/DevCampaignsPage'), 'DevCampaignPage')
const DevErrorsPage    = lazyPage(() => import('../../features/dev/pages/DevErrorsPage'), 'DevErrorsPage')

export function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <SecretShortcut />
      <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* ── Aba secreta (Ctrl+Ç): sem layout, sem login, sem link no site ── */}
        <Route path={SECRET_PATH} element={<SecretPage />} />

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
          <Route path="/dev/erros"                element={<DevErrorsPage />} />
        </Route>

        {/* ── Vortable em tela cheia: logado, mas sem o layout do site ── */}
        <Route path="/campanhas/:campaignId/vortable" element={<ProtectedRoute><VortablePage /></ProtectedRoute>} />

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
      </Suspense>
    </BrowserRouter>
  )
}
