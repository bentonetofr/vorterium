// Teste do selo de sessão aberta (só no `npm run dev`): /testes/sessao.html
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { SessionLiveBadge } from '../src/features/sessions/components/SessionLiveBadge'
import { setLiveSession } from '../src/features/sessions/services/liveSession'

setLiveSession('horario', { open: true, reason: 'scheduled', next_at: null })
setLiveSession('mesa', { open: true, reason: 'together', next_at: null })
setLiveSession('proxima', { open: false, reason: null, next_at: new Date(Date.now() + 26 * 3600_000).toISOString() })
setLiveSession('nada', { open: false, reason: null, next_at: null })

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, color: '#eee' }}>
    {['horario', 'mesa', 'proxima', 'nada'].map((id) => (
      <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}><code style={{ width: 90 }}>{id}</code><SessionLiveBadge campaignId={id} /></div>
    ))}
  </div>,
)
