import { useState } from 'react'
import type { TdaSupplies } from '../../../../shared/types'
import { HEALTH_MAX, TEXT_LIMITS } from '../constants/terraDevastadaAdaptada'
import {
  KIT_HEAL,
  MATERIAL_CAP,
  MAX_BACKPACK,
  PARTS_MAX,
  RECIPES,
  SUPPLY_LIST,
  UNIT,
  amountLabel,
  canAfford,
  capacity,
  costLabel,
  kitCap,
  supplyCap,
  throwableCap,
  type SupplyKey,
} from '../utils/tdaSupplies'

// ────────────────────────────────────────────────────────
// Aba Suprimentos: Mochila, materiais (em pedaços: 100% = 1 inteiro),
// kits médicos, fabricação e suplementos. Só mostra e pede; quem aplica é
// a ficha.
// ────────────────────────────────────────────────────────

interface TdaSuppliesTabProps {
  supplies:     TdaSupplies
  backpack:     number
  health:       number
  traitsFull:   boolean
  /** Define o valor novo (porcentagem nos materiais, unidades em kits e suplementos). */
  onSupply:     (key: SupplyKey, value: number) => void
  onBackpack:   (value: number) => void
  onCraft:      (recipeId: string) => void
  onUseKit:     () => void
  onSupplement: (traitName: string) => void
}

const FIND_CHIPS = [25, 50, 100] as const

/** "60% de um inteiro", "1 inteiro e 60%"... */
function pieceLabel(percent: number): string {
  if (percent <= 0) return 'Nenhum'
  const whole = Math.floor(percent / UNIT)
  const rest = percent % UNIT
  if (whole === 0) return `${rest}% de um inteiro`
  const inteiros = `${whole} ${whole === 1 ? 'inteiro' : 'inteiros'}`
  return rest === 0 ? inteiros : `${inteiros} e ${rest}%`
}

export function TdaSuppliesTab({
  supplies, backpack, health, traitsFull, onSupply, onBackpack, onCraft, onUseKit, onSupplement,
}: TdaSuppliesTabProps) {
  const [supplementText, setSupplementText] = useState('')

  function takeSupplement() {
    const name = supplementText.trim()
    if (!name || supplies.suplementos < 1 || traitsFull) return
    onSupplement(name)
    setSupplementText('')
  }

  return (
    <div className="tda-tab-panel tda-columns anim-tab-panel">
      <div className="tda-stack">
        <section className="tda-card">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Materiais <span className="tda-card__subtitle">em pedaços</span></h4>
            <span className="tda-counter">até {MATERIAL_CAP / UNIT} de cada, peças sem limite</span>
          </div>
          <p className="tda-hint">
            Trapos, álcool, lâminas, explosivos e sucata se acham em pedaços: meio trapo, um terço de frasco. Só serve pra
            fabricar com <strong>100%</strong> de cada ingrediente, então os pedaços vão se somando pelo caminho. Peças
            sempre se acham inteiras (valem no mínimo 1) e não têm limite.
          </p>
          <ul className="tda-list">
            {SUPPLY_LIST.map((s) => {
              const value = supplies[s.key]
              return (
                <li key={s.key} className="tda-material">
                  <div className="tda-material__head">
                    <span className="tda-supply__name">
                      {s.label}
                      <span className="tda-supply__hint">{s.hint}</span>
                    </span>
                    {s.whole ? (
                      <div className="tda-stepper">
                        <button type="button" className="tda-stepper__btn" aria-label={`Menos uma ${s.label.toLowerCase()}`}
                          onClick={() => onSupply(s.key, value - UNIT)} disabled={value < UNIT}>−</button>
                        <input
                          type="number" className="input tda-parts__input" min={0} max={PARTS_MAX / UNIT} step={1}
                          value={Math.floor(value / UNIT)} aria-label={`Quantidade de ${s.label.toLowerCase()}`}
                          onChange={(e) => onSupply(s.key, (parseInt(e.target.value, 10) || 0) * UNIT)}
                        />
                        <button type="button" className="tda-stepper__btn" aria-label={`Mais uma ${s.label.toLowerCase()}`}
                          onClick={() => onSupply(s.key, value + UNIT)} disabled={value >= PARTS_MAX}>+</button>
                      </div>
                    ) : (
                      <label className="tda-pct">
                        <input
                          type="number" className="input tda-pct__input" min={0} max={MATERIAL_CAP} step={5}
                          value={value} aria-label={`${s.label} em porcentagem`}
                          onChange={(e) => onSupply(s.key, parseInt(e.target.value, 10) || 0)}
                        />
                        <span className="tda-pct__unit">%</span>
                      </label>
                    )}
                  </div>

                  {!s.whole && (
                  <div className="tda-gauge" role="img" aria-label={`${s.label}: ${amountLabel(value)} de ${MATERIAL_CAP / UNIT}`}>
                    {[0, 1, 2].map((i) => {
                      const fill = Math.max(0, Math.min(1, (value - i * UNIT) / UNIT))
                      return (
                        <span key={i} className={`tda-gauge__cell${fill >= 1 ? ' tda-gauge__cell--full' : ''}`}>
                          <span className="tda-gauge__fill" style={{ width: `${fill * 100}%` }} />
                        </span>
                      )
                    })}
                  </div>
                  )}

                  <div className="tda-material__foot">
                    <span className="tda-hint">
                      {s.whole ? '' : pieceLabel(value)}
                    </span>
                    {!s.whole && (
                      <span className="tda-material__find">
                        <span className="tda-item__label">Achei</span>
                        {FIND_CHIPS.map((n) => (
                          <button key={n} type="button" className="tda-btn tda-btn--chip"
                            onClick={() => onSupply(s.key, Math.min(MATERIAL_CAP, value + n))}
                            disabled={value >= MATERIAL_CAP}>
                            +{n}%
                          </button>
                        ))}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="tda-card">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Mochila <span className="tda-card__subtitle">o que cabe</span></h4>
            <div className="tda-stepper">
              <button type="button" className="tda-stepper__btn" aria-label="Menos um nível de Mochila"
                onClick={() => onBackpack(backpack - 1)} disabled={backpack <= 0}>−</button>
              <span className="tda-stepper__value">Nv {backpack}</span>
              <button type="button" className="tda-stepper__btn" aria-label="Mais um nível de Mochila"
                onClick={() => onBackpack(backpack + 1)} disabled={backpack >= MAX_BACKPACK}>+</button>
            </div>
          </div>
          <p className="tda-hint">
            Os materiais cabem sempre até {MATERIAL_CAP / UNIT} de cada (peças não têm limite). A Mochila aumenta as balas de cada arma de fogo
            (até <strong>{capacity(backpack)}</strong>), os kits médicos (até <strong>{kitCap(backpack)}</strong>) e os
            explosivos de arremesso (até <strong>{throwableCap(backpack)}</strong>). Nível máximo: {MAX_BACKPACK}.
          </p>
        </section>
      </div>

      <div className="tda-stack">
        <section className="tda-card">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Kits médicos</h4>
            <div className="tda-stepper">
              <button type="button" className="tda-stepper__btn" aria-label="Menos um kit"
                onClick={() => onSupply('kits', supplies.kits - 1)} disabled={supplies.kits <= 0}>−</button>
              <span className="tda-stepper__value">{supplies.kits}<small>/{kitCap(backpack)}</small></span>
              <button type="button" className="tda-stepper__btn" aria-label="Mais um kit"
                onClick={() => onSupply('kits', supplies.kits + 1)} disabled={supplies.kits >= kitCap(backpack)}>+</button>
            </div>
          </div>
          <div className="tda-actions tda-actions--start">
            <button type="button" className="tda-btn tda-btn--primary" onClick={onUseKit}
              disabled={supplies.kits < 1 || health >= HEALTH_MAX}>
              Usar kit (+{KIT_HEAL} Vida)
            </button>
          </div>
          <p className="tda-hint">
            {health >= HEALTH_MAX ? 'A Vida já está cheia.' : `Vida ${health}/${HEALTH_MAX}.`}{' '}
            Um kit sai de 1 trapo + 1 álcool inteiros, os mesmos do coquetel molotov: curar ou atacar?
          </p>
        </section>

        <section className="tda-card">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Fabricar <span className="tda-card__subtitle">sem bancada, sem pressa</span></h4>
          </div>
          <ul className="tda-list">
            {RECIPES.map((r) => (
              <li key={r.id} className="tda-recipe">
                <div className="tda-recipe__info">
                  <strong>{r.name}</strong>
                  <span className="tda-recipe__cost">{costLabel(r.cost)}</span>
                  <span className="tda-hint">{r.hint}</span>
                </div>
                <button type="button" className="tda-btn" onClick={() => onCraft(r.id)} disabled={!canAfford(r.cost, supplies)}>
                  Fabricar
                </button>
              </li>
            ))}
          </ul>
          <p className="tda-hint">Melhorar uma arma (1 peça + 1 sucata) é na aba Inventário, na própria arma.</p>
        </section>

        <section className="tda-card">
          <div className="tda-card__header">
            <h4 className="tda-card__title">Suplementos <span className="tda-card__subtitle">pílulas raras</span></h4>
            <div className="tda-stepper">
              <button type="button" className="tda-stepper__btn" aria-label="Menos um suplemento"
                onClick={() => onSupply('suplementos', supplies.suplementos - 1)} disabled={supplies.suplementos <= 0}>−</button>
              <span className="tda-stepper__value">{supplies.suplementos}</span>
              <button type="button" className="tda-stepper__btn" aria-label="Mais um suplemento"
                onClick={() => onSupply('suplementos', supplies.suplementos + 1)} disabled={supplies.suplementos >= supplyCap('suplementos', backpack)}>+</button>
            </div>
          </div>
          <p className="tda-hint">
            Tomar um suplemento dá uma nova característica fixa, como "Escuta apurada" ou "Mãos firmes" (a que o Narrador aprovar).
          </p>
          <div className="tda-add-row">
            <input
              type="text" className="input" maxLength={TEXT_LIMITS.item} value={supplementText}
              placeholder="Nova característica (Enter)" aria-label="Característica do suplemento"
              disabled={supplies.suplementos < 1 || traitsFull}
              onChange={(e) => setSupplementText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); takeSupplement() } }}
            />
            <button type="button" className="tda-btn" onClick={takeSupplement}
              disabled={supplies.suplementos < 1 || traitsFull || !supplementText.trim()}>
              Tomar
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
