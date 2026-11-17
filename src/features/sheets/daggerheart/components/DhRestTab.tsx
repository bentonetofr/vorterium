import { useState } from 'react'
import { CONDITIONS, DEATH_MOVES, LONG_REST, SHORT_REST } from '../catalog/rules'
import { hopeSlots, hpSlots, isDown, stressSlots, tierOf } from '../model/derive'
import { rollDie } from '../model/dice'
import type { DhSheetData } from '../model/types'
import { Banner } from './DhUi'

// ────────────────────────────────────────────────────────
// Descansos (curto: 2 movimentos, até 3 seguidos; longo: 2 movimentos), Movimentos de Morte e condições.
// Cada movimento aplica o efeito na ficha; "Terminar descanso" renova o que dura "até o próximo descanso".
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  canEdit: boolean
}

export function DhRestTab({ data, update, canEdit }: Props) {
  const [kind, setKind] = useState<'curto' | 'longo'>('curto')
  const [moves, setMoves] = useState<string[]>([])
  const [log, setLog] = useState<string[]>([])
  const [party, setParty] = useState(false)
  const tier = tierOf(data.level)
  const list = kind === 'curto' ? SHORT_REST : LONG_REST

  function pick(key: string) {
    setMoves((m) => (m.length >= 2 ? m : [...m, key]))
  }

  function apply() {
    const out: string[] = []
    update((d) => {
      let n = { ...d }
      for (const key of moves) {
        if (key === 'tend') {
          const v = kind === 'curto' ? rollDie(4) + tier : n.hpMarked
          n = { ...n, hpMarked: Math.max(0, n.hpMarked - v) }
          out.push(kind === 'curto' ? `Cuidar dos Ferimentos: −${v} PV marcados` : 'Cuidar de Todos os Ferimentos: todos os PV recuperados')
        } else if (key === 'stress') {
          const v = kind === 'curto' ? rollDie(4) + tier : n.stressMarked
          n = { ...n, stressMarked: Math.max(0, n.stressMarked - v) }
          out.push(kind === 'curto' ? `Aliviar a Fadiga: −${v} Fadiga` : 'Aliviar Toda a Fadiga')
        } else if (key === 'armor') {
          const v = kind === 'curto' ? rollDie(4) + tier : n.armorMarked
          n = { ...n, armorMarked: Math.max(0, n.armorMarked - v) }
          out.push(kind === 'curto' ? `Consertar a Armadura: −${v} marcados` : 'Consertar Toda a Armadura')
        } else if (key === 'prepare') {
          const v = party ? 2 : 1
          n = { ...n, hope: Math.min(hopeSlots(n), n.hope + v) }
          out.push(`Preparar-se: +${v} Esperança`)
        } else if (key === 'project') out.push('Trabalhar em um Projeto: anote o progresso nas Anotações')
      }
      return n
    })
    setLog(out)
    setMoves([])
  }

  function finish() {
    update((d) => ({ ...d, cardsUsed: [], trackers: kind === 'longo' ? { ...d.trackers, unstoppable: 0 } : d.trackers }))
    setLog((l) => [...l, kind === 'longo' ? 'Descanso longo encerrado: habilidades de “por descanso” e “por descanso longo” renovadas.' : 'Descanso curto encerrado: habilidades de “por descanso” renovadas.'])
  }

  const down = isDown(data)

  function deathMove(key: string) {
    if (key === 'risk') {
      const hope = rollDie(12)
      const fear = rollDie(12)
      if (hope === fear) {
        update((d) => ({ ...d, hpMarked: 0, stressMarked: 0 }))
        setLog([`Arriscar Tudo: ${hope} e ${fear}, sucesso crítico! Você se levanta e recupera todos os PV e toda a Fadiga.`])
      } else if (hope > fear) {
        update((d) => ({ ...d, hpMarked: Math.max(0, d.hpMarked - hope) }))
        setLog([`Arriscar Tudo: Esperança ${hope} × Medo ${fear}. Você se levanta e recupera até ${hope} entre Vida e Fadiga (aqui foi tudo para a Vida; ajuste à mão se preferir dividir).`])
      } else setLog([`Arriscar Tudo: Esperança ${hope} × Medo ${fear}. Seu personagem atravessa o véu da morte.`])
    } else if (key === 'avoid') {
      const d = rollDie(12)
      setLog([`Evitar a Morte: seu personagem fica inconsciente. Dado de Esperança: ${d} — ${d <= data.level ? 'ele ganha uma cicatriz (risque uma casa de Esperança no ajuste).' : 'sem cicatriz.'}`])
    } else setLog(['Chama de Glória: uma ação com sucesso crítico, e então seu personagem atravessa o véu.'])
  }

  return (
    <div className="dh-rest">
      <section className="dh-box">
        <Banner>Descanso</Banner>
        <p className="dh-hint">Cada personagem faz 2 movimentos. O grupo pode fazer até 3 descansos curtos antes de um longo. Descanso interrompido: curto não dá nada; o longo vira curto.</p>
        <span className="dh-seg" role="group">
          <button type="button" className={kind === 'curto' ? 'is-on' : ''} onClick={() => { setKind('curto'); setMoves([]) }}>Descanso curto</button>
          <button type="button" className={kind === 'longo' ? 'is-on' : ''} onClick={() => { setKind('longo'); setMoves([]) }}>Descanso longo</button>
        </span>
        <ul className="dh-opts">
          {list.map((m) => (
            <li key={m.key}>
              <span><b>{m.name}</b><small>{m.text}</small></span>
              {canEdit && <button type="button" className="btn" disabled={moves.length >= 2} onClick={() => pick(m.key)}>Escolher</button>}
            </li>
          ))}
        </ul>
        <p>Escolhidos: {moves.length === 0 ? '—' : moves.map((k) => list.find((m) => m.key === k)?.name).join(' + ')}</p>
        <label className="dh-check"><input type="checkbox" checked={party} onChange={(e) => setParty(e.target.checked)} /> Preparar-se com outros do grupo (+2 Esperança)</label>
        {canEdit && (
          <div className="dh-actions">
            <button type="button" className="btn btn-primary" disabled={moves.length !== 2} onClick={apply}>Aplicar movimentos</button>
            <button type="button" className="btn" onClick={finish}>Terminar descanso</button>
          </div>
        )}
        <p className="dh-hint">O mestre ganha Medo no descanso (curto: 1d4; longo: 1d4 + número de personagens).</p>
      </section>

      <section className="dh-box">
        <Banner>Movimento de Morte</Banner>
        {down && <p className="dh-alert">Você marcou o último Ponto de Vida: escolha um Movimento de Morte.</p>}
        <ul className="dh-opts">
          {DEATH_MOVES.map((m) => (
            <li key={m.key}>
              <span><b>{m.name}</b><small>{m.text}</small></span>
              {canEdit && <button type="button" className="btn" onClick={() => deathMove(m.key)}>{m.key === 'risk' ? 'Rolar' : 'Registrar'}</button>}
            </li>
          ))}
        </ul>
        <p className="dh-hint">Cicatrizes são permanentes: risque uma casa de Esperança (Ajustar números → Cicatrizes). Sem nenhuma casa de Esperança, a jornada do personagem termina.</p>
      </section>

      {log.length > 0 && (
        <section className="dh-box" role="status">
          <Banner>Resultado</Banner>
          <ul className="dh-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          <p className="dh-hint">PV {hpSlots(data) - data.hpMarked}/{hpSlots(data)} livres · Fadiga {stressSlots(data) - data.stressMarked}/{stressSlots(data)} livres</p>
        </section>
      )}

      <section className="dh-box">
        <Banner>Condições</Banner>
        {CONDITIONS.map((c) => <p key={c.name}><strong>{c.name}.</strong> {c.text}</p>)}
        <p className="dh-hint">Condições “temporárias” saem com um teste (Dificuldade do mestre) ou do jeito que a história pedir.</p>
      </section>
    </div>
  )
}
