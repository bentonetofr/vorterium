// Teste do selo de sessão aberta (só no `npm run dev`): /testes/sessao.html
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import { SessionLiveBadge } from '../src/features/sessions/components/SessionLiveBadge'
import { setLiveSession } from '../src/features/sessions/services/liveSession'
import '../src/features/sessions/components/SessionOpenNotice.css'

const crowd = { master_online: true, players_online: 2, players_total: 4 }
setLiveSession('horario', { open: true, reason: 'scheduled', next_at: null, ...crowd })
setLiveSession('mesa', { open: true, reason: 'together', next_at: null, ...crowd })
setLiveSession('manual', { open: true, reason: 'manual', next_at: null, override: 'open', ...crowd })
setLiveSession('proxima', { open: false, reason: null, next_at: new Date(Date.now() + 26 * 3600_000).toISOString() })
setLiveSession('fechada', { open: false, reason: null, next_at: null, ...crowd })
setLiveSession('encerrada', { open: false, reason: null, next_at: null, override: 'closed', ...crowd })
setLiveSession('semmestre', { open: false, reason: null, next_at: null, master_online: false, players_online: 3, players_total: 4 })
setLiveSession('faltam', { open: false, reason: null, next_at: null, master_online: true, players_online: 1, players_total: 4 })

createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14, color: '#eee' }}>
    {['horario', 'mesa', 'manual', 'proxima', 'fechada', 'encerrada', 'semmestre', 'faltam'].map((id) => (
      <div key={id} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <code style={{ width: 90 }}>{id}</code>
        <span style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <span>jogador: <SessionLiveBadge campaignId={id} /></span>
          <span>mestre: <SessionLiveBadge campaignId={id} isMaster /></span>
        </span>
      </div>
    ))}
    {/* o aviso do canto, só o desenho (o componente de verdade precisa de login e do roteador) */}
    <div className="session-notice" role="status" style={{ marginTop: 18 }}>
      <span className="session-notice__tag"><i aria-hidden="true" />Sessão aberta</span>
      <div className="session-notice__body">
        <p className="session-notice__message"><strong>Reino de Altherium</strong> está em sessão.</p>
        <p className="session-notice__why">A mesa está reunida · as rolagens contam pra coleção de dados</p>
      </div>
      <div className="session-notice__actions">
        <button type="button" className="btn btn-primary session-notice__go">Ir pra campanha</button>
        <button type="button" className="session-notice__close" aria-label="Fechar aviso">✕</button>
      </div>
    </div>
  </div>,
)
