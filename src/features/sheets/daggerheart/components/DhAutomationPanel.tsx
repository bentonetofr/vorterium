import { ModalOverlay } from '../../../../shared/components/ModalOverlay'
import { TRAIT_INFO } from '../catalog/rules'
import { armorScore, evasion, hopeSlots, hpSlots, manualOf, proficiency, stressSlots, thresholds, traitValue, type ManualKey } from '../model/derive'
import { HOPE_MAX, MAX_LEVEL } from '../model/defaults'
import type { DhSheetData, DhTrait } from '../model/types'
import { DH_TRAITS } from '../model/types'
import { Stepper, signed } from './DhUi'

// ────────────────────────────────────────────────────────
// Janela Automatizar (no jeito da do D&D): cada número da ficha vem calculado (Automático); em Manual a pessoa digita o valor
// e o site para de calcular aquele item. Embaixo, os bônus que somam ao automático (cartas, habilidades) e os atributos base.
// ────────────────────────────────────────────────────────

interface Props {
  data: DhSheetData
  update: (fn: (d: DhSheetData) => DhSheetData) => void
  onClose: () => void
}

interface Item {
  key: ManualKey
  label: string
  hint: string
  min: number
  max: number
  auto: (d: DhSheetData) => number
  format?: (n: number) => string
}

const ITEMS: Item[] = [
  { key: 'evasion', label: 'Evasão', hint: 'Classe + armadura + subidas + bônus', min: 0, max: 30, auto: evasion },
  { key: 'armor', label: 'Armadura', hint: 'Armadura equipada + escudo + bônus (no máximo 12)', min: 0, max: 12, auto: armorScore },
  { key: 'major', label: 'Limiar de dano maior', hint: 'Base da armadura + nível + bônus', min: 0, max: 80, auto: (d) => thresholds(d).major },
  { key: 'severe', label: 'Limiar de dano grave', hint: 'Base da armadura + nível + bônus', min: 0, max: 120, auto: (d) => thresholds(d).severe },
  { key: 'hp', label: 'Espaços de Vida', hint: 'Classe + subidas + ancestralidade + bônus (no máximo 12)', min: 1, max: 12, auto: hpSlots },
  { key: 'stress', label: 'Espaços de Fadiga', hint: '6 + subidas + ancestralidade + bônus (no máximo 12)', min: 1, max: 12, auto: stressSlots },
  { key: 'hope', label: 'Esperança máxima', hint: '6 menos as cicatrizes', min: 0, max: HOPE_MAX + 1, auto: hopeSlots },
  { key: 'proficiency', label: 'Proficiência', hint: '1 + conquistas dos níveis 2, 5 e 8 + escolhas', min: 0, max: 8, auto: proficiency },
  ...DH_TRAITS.map((t): Item => ({ key: `trait:${t}`, label: TRAIT_INFO[t].label, hint: 'Base + subidas + equipamento', min: -5, max: 12, auto: (d) => traitValue(d, t), format: signed })),
]

export function DhAutomationPanel({ data, update, onClose }: Props) {
  const plain: DhSheetData = { ...data, manual: {} }

  function setManual(key: ManualKey, value: number | null) {
    update((d) => {
      const manual = { ...d.manual }
      if (value === null) delete manual[key]
      else manual[key] = value
      return { ...d, manual }
    })
  }

  function setBase(t: DhTrait, v: number) {
    update((d) => ({ ...d, traits: { ...d.traits, [t]: v } }))
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className="dh-dialog dh-auto" role="dialog" aria-modal="true" aria-label="Automatizar">
        <header className="dh-dialog__head">
          <h3>Automatizar</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </header>
        <p className="dh-hint">Tudo vem calculado pelas regras do livro (Automático). Em Manual você digita o valor e o site deixa de calcular aquele item; dá para voltar ao Automático quando quiser.</p>

        <div className="dh-auto__level">
          <span><b>Nível</b><small>Em geral sobe pelo botão Subir de nível, no fim das abas; aqui você acerta o número direto, se entrou numa mesa já avançada.</small></span>
          <Stepper value={data.level} min={1} max={MAX_LEVEL} label="Nível" onChange={(v) => update((d) => ({ ...d, level: v }))} />
        </div>

        <ul className="dh-auto__list">
          {ITEMS.map((it) => {
            const m = manualOf(data, it.key)
            const manual = m !== undefined
            const auto = it.auto(plain)
            const fmt = it.format ?? String
            return (
              <li key={it.key} className={manual ? 'is-manual' : ''}>
                <span className="dh-auto__what"><b>{it.label}</b><small>{manual ? `Automático seria ${fmt(auto)}` : `${it.hint} → ${fmt(auto)}`}</small></span>
                <span className="dh-auto__ctl">
                  <span className="dh-seg" role="group" aria-label={`${it.label}: automático ou manual`}>
                    <button type="button" className={manual ? '' : 'is-on'} aria-pressed={!manual} onClick={() => setManual(it.key, null)}>Automático</button>
                    <button type="button" className={manual ? 'is-on' : ''} aria-pressed={manual} onClick={() => setManual(it.key, manual ? m : it.auto(data))}>Manual</button>
                  </span>
                  {manual && <Stepper value={m} min={it.min} max={it.max} label={it.label} format={it.format} onChange={(v) => setManual(it.key, v)} />}
                </span>
              </li>
            )
          })}
        </ul>

        <h4>Atributos base</h4>
        <p className="dh-hint">O valor de cada atributo antes das subidas de nível (no Automático). Os bônus das subidas e do equipamento somam por cima.</p>
        <div className="dh-auto__grid">
          {DH_TRAITS.map((t) => (
            <label key={t}>{TRAIT_INFO[t].label}
              <Stepper value={data.traits[t]} min={-5} max={8} label={`${TRAIT_INFO[t].label} base`} format={signed} onChange={(v) => setBase(t, v)} />
            </label>
          ))}
        </div>

        <h4>Bônus que somam ao automático</h4>
        <p className="dh-hint">Para efeitos de cartas e habilidades que o site não calcula sozinho (Vitalidade, Armadura Corporal, feitiços de proteção…).</p>
        <div className="dh-auto__grid">
          <label>Evasão<Stepper value={data.evasionBonus} min={-10} max={10} label="Bônus de Evasão" format={signed} onChange={(v) => update((d) => ({ ...d, evasionBonus: v }))} /></label>
          <label>Armadura<Stepper value={data.armorBonus} min={-10} max={10} label="Bônus de Armadura" format={signed} onChange={(v) => update((d) => ({ ...d, armorBonus: v }))} /></label>
          <label>Limiar maior<Stepper value={data.majorBonus} min={-20} max={40} label="Bônus do limiar maior" format={signed} onChange={(v) => update((d) => ({ ...d, majorBonus: v }))} /></label>
          <label>Limiar grave<Stepper value={data.severeBonus} min={-20} max={40} label="Bônus do limiar grave" format={signed} onChange={(v) => update((d) => ({ ...d, severeBonus: v }))} /></label>
          <label>Espaços de Vida<Stepper value={data.hpBonus} min={0} max={6} label="Vida extra" onChange={(v) => update((d) => ({ ...d, hpBonus: v }))} /></label>
          <label>Espaços de Fadiga<Stepper value={data.stressBonus} min={0} max={6} label="Fadiga extra" onChange={(v) => update((d) => ({ ...d, stressBonus: v }))} /></label>
          <label>Cicatrizes<Stepper value={data.scars} min={0} max={HOPE_MAX} label="Cicatrizes" onChange={(v) => update((d) => ({ ...d, scars: v, hope: Math.min(d.hope, HOPE_MAX - v) }))} /></label>
        </div>

        <footer className="dh-dialog__foot"><button type="button" className="btn btn-primary" onClick={onClose}>Pronto</button></footer>
      </div>
    </ModalOverlay>
  )
}
