import { useState } from 'react'
import type { EnigmaView } from './enigmaService'
import { play } from './enigmaService'
import { EnigmaPhase } from './EnigmaPhase'
import { fmtClock } from './useEnigmaRoom'

// ────────────────────────────────────────────────────────
// A tela do jogador durante o jogo: no topo papel, dupla, fase, relógio
// e Pausar; embaixo a fase da dupla — ou, na outra aba, a outra dupla
// jogando (como espectador: vê tudo, menos os fragmentos da Banca).
// ────────────────────────────────────────────────────────

export function EnigmaGame({ view, now }: { view: EnigmaView; now: number }) {
  const [tab, setTab] = useState<'mine' | 'other'>('mine')
  const d = view.me.dupla!
  const other = d === 'A' ? 'B' : 'A'
  const info = view.duplas[d]!
  const otherInfo = view.duplas[other]
  const v = view.mine
  const partner = info.members.find((m) => m.uid !== view.me.uid)
  const deadline = typeof v?.deadline === 'number' ? (v.deadline as number) : null
  const wrong = typeof v?.wrong === 'number' ? (v.wrong as number) : null
  const act = (a: Record<string, unknown>) => play(view.room.id, a)

  return (
    <div className="en-game">
      <header className={`en-top en-top--${d}`}>
        <div className="en-top__who">
          <span className="en-crest" aria-hidden="true">{d}</span>
          <div>
            <p className="en-top__dupla">{info.nome}</p>
            <p className="en-top__sub">
              {v && v.phase <= 3 ? <>Fase {v.phase} · {v.titulo}</> : 'Rumo à Banca'}
              {partner && <> · com {partner.name}</>}
            </p>
          </div>
        </div>
        <div className="en-top__right">
          {v && v.stage === 'jogo' && <span className="en-pill en-pill--role">{v.role_nome}</span>}
          {deadline != null && v?.stage === 'jogo' && <span className={`en-pill${deadline - now <= 0 ? ' is-over' : ''}`}>⏳ {deadline - now <= 0 ? '0:00' : fmtClock(deadline - now)}</span>}
          {wrong != null && v?.stage === 'jogo' && <span className="en-pill">Erros: {wrong}</span>}
          <button type="button" className="en-btn en-btn--pause" onClick={() => void act({ a: 'pause' })}>Pausar</button>
        </div>
      </header>

      <nav className="en-tabs" role="tablist" aria-label="O que ver">
        <button type="button" role="tab" aria-selected={tab === 'mine'} className={`en-tab${tab === 'mine' ? ' is-on' : ''}`} onClick={() => setTab('mine')}>Sua dupla</button>
        {otherInfo && (
          <button type="button" role="tab" aria-selected={tab === 'other'} className={`en-tab${tab === 'other' ? ' is-on' : ''}`} onClick={() => setTab('other')}>
            Assistir: {otherInfo.nome}
          </button>
        )}
      </nav>

      {tab === 'mine'
        ? <EnigmaPhase dupla={d} info={info} v={v} act={act} readOnly={false} now={now} />
        : otherInfo && <EnigmaPhase dupla={other} info={otherInfo} v={view.other} act={act} readOnly now={now} />}
    </div>
  )
}
