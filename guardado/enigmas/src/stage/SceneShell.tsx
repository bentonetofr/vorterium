import { useState, type CSSProperties, type ReactNode } from 'react'
import type { PhaseView } from '../enigmaService'
import { Accuse, Hints, type Act, type Proposal } from '../phases/common'
import { Token } from '../phases/visual'
import { Stage } from './Stage'

// ────────────────────────────────────────────────────────
// A moldura comum das cenas: o palco, a barra de botões do canto
// (história, dicas, acusar + os da fase) e a faixa de "acusação
// pendente" que chama o parceiro pra confirmar.
// ────────────────────────────────────────────────────────

export interface Tool { id: string; icon: ReactNode; label: string; title?: string; badge?: boolean; panel: ReactNode }

interface Props {
  v:        PhaseView
  act:      Act
  readOnly: boolean
  accuse:   { names: string[]; proposal: Proposal | null | undefined; label: string }
  tools?:   Tool[]
  /** Onde fica a faixa de acusação pendente (cada cena tem seu canto livre). */
  bannerStyle?: CSSProperties
  children: ReactNode
}

export function SceneShell({ v, act, readOnly, accuse, tools = [], bannerStyle, children }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const spectator = v.role === 'espectador'
  const all: Tool[] = [
    ...tools,
    { id: 'lore', icon: '📜', label: 'História', panel: <Lore v={v} /> },
    ...(spectator ? [] : [{ id: 'hints', icon: '🕯️', label: 'Dicas', badge: v.hints.length > 0, panel: <Hints v={v} act={act} readOnly={readOnly} /> }]),
    { id: 'accuse', icon: '⚖️', label: 'Acusar', badge: !!accuse.proposal, panel: <Accuse names={accuse.names} proposal={accuse.proposal} act={act} readOnly={readOnly} label={accuse.label} /> },
  ]
  const cur = all.find((t) => t.id === open) ?? null
  const p = accuse.proposal

  return (
    <Stage
      label={v.titulo}
      tools={all.map((t) => ({ id: t.id, icon: t.icon, label: t.label, badge: t.badge, accent: t.id === 'accuse', onClick: () => setOpen(t.id) }))}
      panel={cur ? { title: cur.title ?? cur.label, node: cur.panel } : null}
      onClosePanel={() => setOpen(null)}
    >
      {children}

      {p && (
        <button type="button" className={`es-banner${p.mine ? '' : ' is-call'}`} style={bannerStyle} onClick={() => setOpen('accuse')}>
          <span aria-hidden="true">⚖️</span>
          <strong>{p.by_name}</strong> acusa <Token name={p.name} size={56} /> <strong>{p.name}</strong>
          <span className="es-banner__cta">{readOnly ? '' : p.mine ? 'esperando o parceiro' : 'toque para confirmar'}</span>
        </button>
      )}

    </Stage>
  )
}

function Lore({ v }: { v: PhaseView }) {
  const spectator = v.role === 'espectador'
  return (
    <div className="en-lore-panel">
      {!spectator && v.role !== 'mestre' && v.role_resumo && (
        <p className="en-role-note">Você é <strong>{v.role_nome}</strong>. {v.role_resumo}</p>
      )}
      {v.cenario && <p className="en-phase__scene">{v.cenario}</p>}
      {v.regras && v.regras.length > 0 && <ul className="en-phase__rules">{v.regras.map((r) => <li key={r}>{r}</li>)}</ul>}
    </div>
  )
}
