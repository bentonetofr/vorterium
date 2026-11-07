import { abilityKindLabel } from '../utils/creatureSheet'
import { formatNumber } from '../utils/bestiaryCalculations'
import type { CreatureSheet } from '../../../shared/types'
import './CreatureSheet.css'

// ────────────────────────────────────────────────────────
// A ficha de mesa da criatura, como o livro apresenta os inimigos: classificação, descrição, faixa de números (PV, Dano,
// Ataque, Defesa, DB, Movimento), golpes e habilidades. Serve de miolo pro card do bestiário da campanha e do Meu bestiário.
// ────────────────────────────────────────────────────────

interface Props {
  hp:          number
  damageDice:  string
  damageAvg:   number | null
  sheet?:      CreatureSheet | null
  /** Classificação de reserva (a faixa de perigo) quando a ficha não tem uma. */
  tierFallback?: string
}

export function CreatureStatBlock({ hp, damageDice, damageAvg, sheet, tierFallback }: Props) {
  const tier = sheet?.tier || tierFallback
  const strikes = sheet?.strikes ?? []
  const abilities = sheet?.abilities ?? []
  const extra: { label: string; value: string; mono?: boolean }[] = [
    sheet?.attack   ? { label: 'Ataque', value: sheet.attack, mono: true } : null,
    sheet?.defense  ? { label: 'Defesa', value: sheet.defense, mono: true } : null,
    sheet?.db       ? { label: 'DB', value: sheet.db } : null,
    sheet?.movement ? { label: 'Movimento', value: sheet.movement } : null,
  ].filter((x): x is { label: string; value: string; mono?: boolean } => x != null)

  return (
    <div className="cs-block">
      {tier && <p className="cs-block__tier">{tier}</p>}
      {sheet?.lore && <blockquote className="cs-block__lore">{sheet.lore}</blockquote>}

      <div className="cs-block__stats">
        <div className="cs-stat cs-stat--big">
          <span className="cs-stat__label">PV</span>
          <span className="cs-stat__value">{hp}</span>
        </div>
        <div className="cs-stat cs-stat--big">
          <span className="cs-stat__label">Dano</span>
          <span className="cs-stat__value cs-stat__value--mono">{damageDice}</span>
          {damageAvg != null && <span className="cs-stat__sub">média {formatNumber(damageAvg)}</span>}
        </div>
        {extra.map((e) => (
          <div key={e.label} className="cs-stat">
            <span className="cs-stat__label">{e.label}</span>
            <span className={`cs-stat__text${e.mono ? ' cs-stat__text--mono' : ''}`}>{e.value}</span>
          </div>
        ))}
      </div>

      {strikes.length > 0 && (
        <section className="cs-block__section" aria-label="Golpes">
          <h5 className="cs-block__heading">Golpes</h5>
          <ul className="cs-strikes">
            {strikes.map((s, i) => (
              <li key={i} className="cs-strike">
                <span className="cs-strike__name">{s.name || 'Golpe'}</span>
                {s.dice && <span className="cs-strike__dice">{s.dice}</span>}
                {s.type && <span className="cs-strike__type" title="Tipo de dano">{s.type}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {abilities.length > 0 && (
        <section className="cs-block__section" aria-label="Habilidades">
          <h5 className="cs-block__heading">Habilidades</h5>
          <ul className="cs-abilities">
            {abilities.map((a, i) => (
              <li key={i} className={`cs-habil cs-habil--${a.kind}`}>
                <div className="cs-habil__head">
                  <span className="cs-habil__kind">{abilityKindLabel(a.kind)}</span>
                  <strong className="cs-habil__name">{a.name || 'Sem nome'}</strong>
                  {a.uses && <span className="cs-habil__uses">{a.uses}</span>}
                </div>
                {a.text && <p className="cs-habil__text">{a.text}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
