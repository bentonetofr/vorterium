// ────────────────────────────────────────────────────────
// Prévia da tela Mundos do Vortable (só no `npm run dev`): /testes/mundos.html
//   ?largura=420 põe numa caixa dessa largura. Banco falso na memória, sessão falsa de mestre.
// ────────────────────────────────────────────────────────
import { seedFakeDb } from './_ficha-viva-db'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/shared/theme/motion.css'
import '../src/shared/theme/refine.css'
import '../src/shared/theme/touch.css'

const params = new URLSearchParams(location.search)
const ref = new URL(import.meta.env.VITE_SUPABASE_URL as string).hostname.split('.')[0]
const user = { id: 'user-1', aud: 'authenticated', role: 'authenticated', email: 'mestre@teste.dev', app_metadata: {}, user_metadata: { display_name: 'Mestre' }, created_at: new Date().toISOString() }
localStorage.setItem(`sb-${ref}-auth-token`, JSON.stringify({
  access_token: 'fake', refresh_token: 'fake', token_type: 'bearer', expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user,
}))

const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString()
seedFakeDb({
  vortable_worlds: [
    { id: 'w1', campaign_id: 'camp-1', name: 'Torvallen', active: false, updated_at: ago(500) },
    { id: 'w2', campaign_id: 'camp-1', name: 'Saltmore', active: false, updated_at: ago(400) },
    { id: 'w3', campaign_id: 'camp-1', name: 'Altherium', active: true, updated_at: ago(300) },
  ],
  vortable_zones: [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `z1-${i}`, campaign_id: 'camp-1', world_id: 'w1' })),
    ...Array.from({ length: 9 }, (_, i) => ({ id: `z2-${i}`, campaign_id: 'camp-1', world_id: 'w2' })),
    { id: 'z3-0', campaign_id: 'camp-1', world_id: 'w3' },
  ],
})

;(async () => {
  const { AuthProvider } = await import('../src/features/auth/AuthProvider')
  const { CurrentCampaignProvider } = await import('../src/features/campaigns/CurrentCampaignContext')
  const { MesaStreamProvider } = await import('../src/features/mesa/MesaStreamProvider')
  const { VortableWorldProvider } = await import('../src/features/vortable/worlds/VortableWorldProvider')
  const { WorldsPanel } = await import('../src/features/vortable/worlds/WorldsPanel')
  const { DialogHost } = await import('../src/shared/components/dialogs')
  const width = Number(params.get('largura')) || undefined
  const campaign = { id: 'camp-1', name: 'Campanha', system: 'altherium', role: 'master' } as never
  createRoot(document.getElementById('root')!).render(
    <AuthProvider>
      <CurrentCampaignProvider initial={campaign}>
        <MesaStreamProvider>
          <VortableWorldProvider>
            <DialogHost />
            <div style={{ position: 'relative', width: '100%', maxWidth: width ?? 1100, height: '100dvh', margin: '0 auto' }}>
              <WorldsPanel campaignId="camp-1" onClose={() => {}} onEdit={() => {}} />
            </div>
          </VortableWorldProvider>
        </MesaStreamProvider>
      </CurrentCampaignProvider>
    </AuthProvider>,
  )
})()
