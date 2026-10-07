import { useState } from 'react'
import type { VtmConviction } from '../../../../shared/types'
import { VTM_HUMANITY_MAX } from '../constants/vampiro'
import { newId } from '../utils/vampiroRules'
import type { VtmForm, VtmUpdate } from './vtmForm'

// ────────────────────────────────────────────────────────
// Aba Convicções: cada Convicção tem o seu Pilar de Toque, um mortal que
// representa aquilo. Enquanto o Pilar vive, a Convicção protege da mancha
// (o Narrador pode tirar uma mancha quando a Convicção explica o ato). Se o
// Pilar é ferido, o vampiro leva mancha; se morre ou se perde de vez, leva
// manchas e a Convicção vai junto. As manchas entram na Humanidade lá em
// cima e, no fim da sessão, o teste de remorso decide se ela cai.
// ────────────────────────────────────────────────────────

const MAX = 3

export function VtmConvictionsTab({ form, update }: { form: VtmForm; update: VtmUpdate }) {
  const list = form.convictions
  const alive = list.filter((c) => c.status !== 'perdido').length

  function patch(id: string, p: Partial<VtmConviction>) {
    update((prev) => ({ ...prev, convictions: prev.convictions.map((c) => (c.id === id ? { ...c, ...p } : c)) }))
  }
  function stain(n: number) {
    update((prev) => ({ ...prev, stains: Math.min(VTM_HUMANITY_MAX, prev.stains + n) }))
  }
  function add() {
    update((prev) => ({
      ...prev,
      convictions: [...prev.convictions, { id: newId(), conviction: '', touchstone: '', note: '', status: 'vivo' }],
    }))
  }
  function remove(id: string) {
    update((prev) => ({ ...prev, convictions: prev.convictions.filter((c) => c.id !== id) }))
  }

  return (
    <div className="vtm-tab-panel anim-tab-panel">
      <section className="vtm-card">
        <div className="vtm-card__header">
          <h4 className="vtm-card__title">Convicções e Pilares de Toque</h4>
          <span className={`vtm-badge${alive >= 1 && alive <= MAX ? ' vtm-badge--ok' : ''}`}>{alive} de 1 a {MAX}</span>
        </div>
        <p className="vtm-muted vtm-lead">
          Na criação, de 1 a 3 Convicções, cada uma ligada a um Pilar de Toque: um mortal vivo que encarna aquilo em que
          você acredita. Agir por uma Convicção pode poupar a mancha de um ato terrível. Pilar ferido custa mancha;
          Pilar morto ou perdido custa manchas e leva a Convicção junto.
        </p>
        {form.stains > 0 && (
          <p className="vtm-muted">Manchas agora: {form.stains}. No fim da sessão, o teste de remorso decide se a Humanidade cai.</p>
        )}
      </section>

      {list.map((c, i) => (
        <ConvictionCard key={c.id} c={c} index={i} onPatch={(p) => patch(c.id, p)} onStain={stain} onRemove={() => remove(c.id)} />
      ))}

      {list.length < 6 && (
        <button type="button" className="vtm-chip vtm-chip--wide" onClick={add}>+ Convicção e Pilar</button>
      )}
    </div>
  )
}

function ConvictionCard({ c, index, onPatch, onStain, onRemove }: {
  c: VtmConviction; index: number
  onPatch: (p: Partial<VtmConviction>) => void; onStain: (n: number) => void; onRemove: () => void
}) {
  const [losing, setLosing] = useState(false)
  const lost = c.status === 'perdido'
  return (
    <section className={`vtm-card vtm-conviction vtm-conviction--${c.status}`}>
      <div className="vtm-card__header">
        <h4 className="vtm-card__title">Convicção {index + 1}</h4>
        <span className={`vtm-tag vtm-tag--${c.status}`}>
          {c.status === 'vivo' ? 'Pilar vivo' : c.status === 'ferido' ? 'Pilar ferido' : 'Pilar perdido: Convicção perdida'}
        </span>
      </div>
      <label className="vtm-field">
        <span className="vtm-label">Convicção</span>
        <input className="input" maxLength={160} value={c.conviction} disabled={lost}
          placeholder="Ex.: Nunca machucar uma criança." onChange={(e) => onPatch({ conviction: e.target.value })} />
      </label>
      <label className="vtm-field">
        <span className="vtm-label">Pilar de Toque</span>
        <input className="input" maxLength={80} value={c.touchstone}
          placeholder="Ex.: Ana, a sobrinha de 8 anos" onChange={(e) => onPatch({ touchstone: e.target.value })} />
      </label>
      <label className="vtm-field">
        <span className="vtm-label">Quem é, onde vive, o que significa</span>
        <textarea className="input vtm-textarea" rows={2} maxLength={300} value={c.note} onChange={(e) => onPatch({ note: e.target.value })} />
      </label>

      <div className="vtm-track__btns">
        {c.status === 'vivo' && (
          <button type="button" className="vtm-chip" onClick={() => { onStain(1); onPatch({ status: 'ferido' }) }}
            title="O Pilar foi ferido: +1 mancha">Pilar ferido (+1 mancha)</button>
        )}
        {c.status === 'ferido' && (
          <button type="button" className="vtm-chip" onClick={() => onPatch({ status: 'vivo' })}>Pilar se recuperou</button>
        )}
        {!lost && !losing && (
          <button type="button" className="vtm-chip vtm-chip--agg" onClick={() => setLosing(true)}>Pilar morreu ou se perdeu</button>
        )}
        {lost && (
          <>
            <button type="button" className="vtm-chip" onClick={() => onPatch({ status: 'vivo', touchstone: '', note: '' })}>
              Novo Pilar pra esta Convicção
            </button>
            <button type="button" className="vtm-chip" onClick={() => onPatch({ status: 'vivo' })} title="Desfaz só a marcação, sem tirar as manchas">
              Foi engano
            </button>
          </>
        )}
        <button type="button" className="vtm-chip" onClick={onRemove}>Apagar</button>
      </div>

      {losing && (
        <div className="vtm-confirm">
          <p>
            Quantas manchas? O Narrador decide pelo peso da perda: uma pra perda clara, duas ou mais quando é monstruosa
            (por exemplo, se foi você quem causou). A Convicção se perde junto com o Pilar.
          </p>
          <div className="vtm-track__btns">
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" className="vtm-chip vtm-chip--agg"
                onClick={() => { onStain(n); onPatch({ status: 'perdido' }); setLosing(false) }}>
                +{n} {n === 1 ? 'mancha' : 'manchas'}
              </button>
            ))}
            <button type="button" className="vtm-chip" onClick={() => setLosing(false)}>Cancelar</button>
          </div>
        </div>
      )}
    </section>
  )
}
