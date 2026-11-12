// Teste do painel do dono (só no `npm run dev`): /testes/dono.html (dados de mentira, sem login)
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../src/index.css'
import '../src/app/layouts/PrivateLayout.css'
import '../src/features/owner/OwnerToolsFab.css'
import { PlayersList } from '../src/features/owner/OwnerPlayersTab'
import { summarizePlayers, type StatRoll } from '../src/features/owner/playerStats'

let n = 0
const d20 = (user: string, v: number, mins: number, over: Partial<StatRoll> = {}): StatRoll => {
  n += 1
  return {
    id: `r${n}`, campaign_id: 'c', user_id: user, die_type: 'd20', result: v, individual_results: [v],
    roll_breakdown: [{ type: 'sum', notation: '1d20', quantity: 1, sides: 20, results: [v], subtotal: v }],
    roll_context: null, formula: '1d20', created_at: new Date(Date.now() - mins * 60000).toISOString(), ...over,
  }
}
const rolls: StatRoll[] = [
  d20('a', 20, 2, { roll_label: 'Furtividade', roll_context: { outcome: 'success', crit: 'crit' } }), d20('a', 7, 30, { roll_label: 'Ataque com espada' }), d20('a', 1, 90, { roll_context: { outcome: 'failure', crit: 'fumble' } }), d20('a', 14, 400, { is_private: true }),
  d20('b', 11, 5), d20('b', 16, 200, { roll_context: { outcome: 'success' } }),
]
const players = summarizePlayers(rolls, [
  { userId: 'a', name: 'Ana Beatriz', role: 'player' }, { userId: 'b', name: 'Beto', role: 'player' },
  { userId: 'c', name: 'Caio, o silencioso', role: 'player' }, { userId: 'm', name: 'Mestre', role: 'master' },
])

function App() {
  const [tab, setTab] = useState<'dados' | 'jogadores'>('jogadores')
  return (
    <div style={{ minHeight: '100vh', padding: 24, color: '#eee', display: 'flex', justifyContent: 'center' }}>
      <div className="owner-panel fab-panel fab-panel--fit" style={{ position: 'static' }}>
        <div className="owner-panel__head"><span className="owner-panel__titles"><span className="owner-panel__title">Trapaças</span><span className="owner-panel__sub">Só você vê, em qualquer campanha</span></span><button className="owner-panel__close">✕</button></div>
        <div className="owner-panel__tabs">
          {(['dados', 'jogadores'] as const).map((t) => <button key={t} className={`owner-panel__tab${tab === t ? ' owner-panel__tab--on' : ''}`} onClick={() => setTab(t)}>{t === 'dados' ? 'Dados' : 'Jogadores'}</button>)}
        </div>
        <div className="owner-panel__body">
          <section className="owner-panel__section">
            <div className="owner-players__bar"><span className="owner-panel__h">Campanha de teste</span><button className="owner-panel__ghost">Atualizar</button></div>
            <PlayersList players={players} read={rolls.length} nudges={[{ campaign_id: 'c', target_user_id: 'b', mode: 'fixed', fixed: 18, d20_only: true }]} onNudge={() => {}} onClear={() => {}} />
          </section>
        </div>
        <div className="owner-panel__foot"><span><kbd>Alt+Shift+T</kbd> esconde e mostra este botão</span><button className="owner-panel__ghost">Esconder agora</button></div>
      </div>
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<App />)
