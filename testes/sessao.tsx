// Teste do selo de sessão aberta (só no `npm run dev`): /testes/sessao.html
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { SessionLiveBadge } from '../src/features/sessions/components/SessionLiveBadge'
import { setLiveSession } from '../src/features/sessions/services/liveSession'

const crowd = { master_online: true, players_online: 2, players_total: 4 }
setLiveSession('horario', { open: true, reason: 'scheduled', next_at: null, ...crowd })
setLiveSession('mesa', { open: true, reason: 'together', next_at: null, ...crowd })
setLiveSession('manual', { open: true, reason: 'manual', next_at: null, override: 'open', ...crowd })
setLiveSession('proxima', { open: false, reason: null, next_at: new Date(Date.now() + 26 * 3600_000).toISOString() })
setLiveSession('fechada', { open: false, reason: null, next_at: null, ...crowd })
setLiveSession('encerrada', { open: false, reason: null, next_at: null, override: 'closed', ...crowd })

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, color: '#eee' }}>
    {['horario', 'mesa', 'manual', 'proxima', 'fechada', 'encerrada'].map((id) => (
      <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <code style={{ width: 90 }}>{id}</code>
        <span style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span>jogador: <SessionLiveBadge campaignId={id} /></span>
          <span>mestre: <SessionLiveBadge campaignId={id} isMaster /></span>
        </span>
      </div>
    ))}
  </div>,
)
