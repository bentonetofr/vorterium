import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../../../auth/AuthProvider'
import { subscribeToRolls } from '../../../dice/services/diceService'
import type { AltheriumAttribute, AltheriumDomain } from '../constants/altherium'
import type { AltheriumScene } from '../services/altheriumSceneService'
import {
  listAltheriumAnswers,
  listOpenAltheriumRequests,
  subscribeToAltheriumRequests,
  type AltheriumRequest,
} from '../services/altheriumRequestService'
import { AltheriumTestModal, type AfterCtx, type AltheriumTestSpec } from './AltheriumTestModal'
import type { DomainCheck } from './AltheriumCombatPanel'
import { LossResult } from './AltheriumMindWindow'
import { StealthResult } from './AltheriumStealthWindow'
import { Icon } from './AltheriumPlayKit'
import './AltheriumMaster.css'

// ────────────────────────────────────────────────────────
// Pedidos do mestre, na ficha do jogador: "Furtividade, DT 8" aparece aqui
// com o botão Rolar. A janela abre com a DT já preenchida (o jogador só
// ajusta os dados de situação e rola). O resultado já faz o que o livro
// manda: a Furtividade mostra se o estado dos inimigos sobe, o Equilíbrio
// calcula a perda (metade se passou, tudo se falhou). A resposta é a própria
// rolagem, e o pedido some daqui quando você responde.
// ────────────────────────────────────────────────────────

interface Props {
  campaignId: string
  sheetId:    string
  character:  string
  check:      (domain: AltheriumDomain, attribute?: AltheriumAttribute) => DomainCheck
  scene:      AltheriumScene
  onScene:    (patch: Partial<AltheriumScene>) => Promise<void>
  /** Armadura de 8 DB ou mais, Escudo Pesado ou arma pesada equipada (−1 dado na Furtividade). */
  heavyGear:  boolean
  /** Tira Equilíbrio (perda do evento já calculada). */
  onLoseEquilibrium: (n: number) => void
  announce:   (text: string) => void
}

export function AltheriumRequestCard({ campaignId, sheetId, character, check, scene, onScene, heavyGear, onLoseEquilibrium, announce }: Props) {
  const { user } = useAuth()
  const me = user?.id ?? null
  const [open, setOpen] = useState<AltheriumRequest[]>([])
  const [answered, setAnswered] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<AltheriumRequest | null>(null)

  const refresh = useCallback(async () => {
    const list = await listOpenAltheriumRequests(campaignId)
    const mine = me ? list.filter((r) => r.targets.includes(me)) : []
    const rolls = await listAltheriumAnswers(campaignId, mine.map((r) => r.id))
    setOpen(mine)
    setAnswered(new Set(rolls.filter((r) => r.user_id === me).map((r) => String((r.roll_context as { request_id?: string } | null)?.request_id))))
  }, [campaignId, me])

  useEffect(() => {
    void refresh()
    const off = subscribeToAltheriumRequests(campaignId, () => { void refresh() })
    const offRolls = subscribeToRolls(campaignId, () => { void refresh() })
    return () => { off(); offRolls() }
  }, [campaignId, refresh])

  const pending = open.filter((r) => !answered.has(r.id))
  if (pending.length === 0 && !active) return null

  function specFor(r: AltheriumRequest): { spec: AltheriumTestSpec; after?: (ctx: AfterCtx) => ReactNode } {
    if (r.kind === 'stealth') {
      const base = check('furtividade')
      const state = scene.enemy
      return {
        spec: {
          ...base, title: r.label, diceMods: heavyGear ? [{ label: 'Peso (armadura, escudo ou arma pesada)', value: -1 }] : [],
          targetLabel: 'DT (pedido do mestre)', initialTarget: r.dt ?? scene.dts[state], critSucceeds: true,
          words: ['passou despercebido', 'foi notado'],
          notes: ['Pedido do mestre. Ajuste os dados de situação (sombra, ritmo, cobertura...) e role.'],
        },
        after: (ctx) => <StealthResult ctx={ctx} state={state} scene={scene} onScene={onScene} announce={announce} character={character} />,
      }
    }
    if (r.kind === 'equilibrium') {
      const base = check('vontade')
      const amount = r.amount ?? 0
      return {
        spec: {
          ...base, title: r.label, targetLabel: 'DT do evento', initialTarget: r.dt, words: ['resistiu', 'abalou'],
          notes: [`Pedido do mestre. Passou: perde metade (${Math.floor(amount / 2)}). Falhou: perde tudo (${amount}).`],
        },
        after: (ctx) => <LossResult ctx={ctx} amount={amount} onApply={onLoseEquilibrium} />,
      }
    }
    const base = check((r.domain ?? 'percepcao') as AltheriumDomain)
    return { spec: { ...base, title: r.label, targetLabel: 'DT (pedido do mestre)', initialTarget: r.dt, notes: ['Pedido do mestre.'] } }
  }

  const act = active ? specFor(active) : null

  return (
    <section className="alth-requests" aria-label="Pedidos do mestre">
      {pending.map((r) => (
        <div key={r.id} className="alth-requests__row" role="status">
          <Icon name={r.kind === 'stealth' ? 'stealth' : r.kind === 'equilibrium' ? 'mind' : 'test'} />
          <div className="alth-requests__info">
            <strong>O mestre pediu: {r.label}</strong>
            <small>
              {r.kind === 'stealth' ? 'Furtividade + Impulso' : r.kind === 'equilibrium' ? `Vontade + Espírito · perda de ${r.amount ?? 0}` : 'Teste de domínio'}
              {r.dt ? ` · DT ${r.dt}` : ''}
            </small>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setActive(r)}>Rolar</button>
        </div>
      ))}

      {active && act && (
        <AltheriumTestModal
          key={active.id} noAgain
          campaignId={campaignId} sheetId={sheetId} character={character} spec={act.spec}
          contextExtra={{ request_id: active.id }}
          onRolled={() => setAnswered((prev) => new Set(prev).add(active.id))}
          after={act.after}
          onClose={() => { setActive(null); void refresh() }}
        />
      )}
    </section>
  )
}
