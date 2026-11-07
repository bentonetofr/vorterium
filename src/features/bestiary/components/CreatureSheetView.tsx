import { abilityKindLabel, readSheet, textBlocks, type TextPiece } from '../utils/creatureSheet'
import { diceAverage, formatNumber } from '../utils/bestiaryCalculations'
import type { CreatureSheet } from '../../../shared/types'
import './CreatureSheet.css'

function Pieces({ pieces }: { pieces: TextPiece[] }) {
  return (
    <>
      {pieces.map((p, i) =>
        p.mark ? <mark key={i} className={`csheet-mark csheet-mark--${p.mark}`}>{p.text}</mark> : <span key={i}>{p.text}</span>,
      )}
    </>
  )
}

/** Texto de habilidade: parágrafos, listas com "-" e destaque pra dados e DT. */
export function AbilityText({ value }: { value: string }) {
  return (
    <div className="csheet-text">
      {textBlocks(value).map((b, i) =>
        b.type === 'p' ? (
          <p key={i}><Pieces pieces={b.pieces} /></p>
        ) : (
          <ul key={i}>{b.items.map((it, j) => <li key={j}><Pieces pieces={it} /></li>)}</ul>
        ),
      )}
    </div>
  )
}

interface Props {
  hp:         number
  damageDice: string
  sheet:      unknown
}

/** A ficha lida: PV e Dano (da conta) em cima, depois os campos de texto. */
export function CreatureSheetView({ hp, damageDice, sheet: raw }: Props) {
  const sheet: CreatureSheet = readSheet(raw)
  const average = diceAverage(damageDice)
  const stats: { label: string; value: string; sub?: string; wide?: boolean }[] = [
    { label: 'PV', value: String(hp) },
    ...(sheet.attack  ? [{ label: 'Ataque',  value: sheet.attack }]  : []),
    ...(sheet.defense ? [{ label: 'Defesa',  value: sheet.defense }] : []),
    { label: 'Dano', value: damageDice, sub: average != null ? `média ${formatNumber(average)}` : undefined },
    ...(sheet.db      ? [{ label: 'DB',      value: sheet.db, wide: sheet.db.length > 12 }] : []),
    ...(sheet.movement ? [{ label: 'Movimento', value: sheet.movement, wide: sheet.movement.length > 12 }] : []),
  ]

  return (
    <div className="csheet">
      {(sheet.tier || sheet.tags.length > 0) && (
        <div className="csheet__ident">
          {sheet.tier && <span className="csheet__tier">{sheet.tier}</span>}
          {sheet.tags.map((t) => <span key={t} className="csheet__tag">{t}</span>)}
        </div>
      )}

      {sheet.lore && <blockquote className="csheet__lore">{sheet.lore}</blockquote>}

      <dl className="csheet__stats">
        {stats.map((s) => (
          <div key={s.label} className={`csheet-stat${s.wide ? ' csheet-stat--wide' : ''}${s.label === 'PV' ? ' csheet-stat--hp' : ''}`}>
            <dt>{s.label}</dt>
            <dd>{s.value}</dd>
            {s.sub && <small>{s.sub}</small>}
          </div>
        ))}
      </dl>

      {sheet.attacks.length > 0 && (
        <section className="csheet__section" aria-label="Ataques">
          <h5 className="csheet__heading">Ataques</h5>
          <ul className="csheet__attacks">
            {sheet.attacks.map((a, i) => {
              const avg = a.dice ? diceAverage(a.dice) : null
              return (
                <li key={i} className="csheet-attack" title={avg != null ? `média ${formatNumber(avg)}` : undefined}>
                  <span className="csheet-attack__name">{a.name || 'Ataque'}</span>
                  {a.dice && <mark className="csheet-mark csheet-mark--dice">{a.dice}</mark>}
                  {a.kind && <span className="csheet-attack__kind">{a.kind}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {sheet.abilities.length > 0 && (
        <section className="csheet__section" aria-label="Habilidades">
          <h5 className="csheet__heading">Habilidades</h5>
          <div className="csheet__abilities">
            {sheet.abilities.map((a, i) => (
              <article key={i} className={`csheet-ability csheet-ability--${a.kind}`}>
                <header className="csheet-ability__head">
                  <span className="csheet-ability__name">{a.name || 'Sem nome'}</span>
                  <span className="csheet-ability__kind">{abilityKindLabel(a.kind)}</span>
                  {a.freq && <span className="csheet-ability__freq">{a.freq}</span>}
                </header>
                {a.text && <AbilityText value={a.text} />}
              </article>
            ))}
          </div>
        </section>
      )}

      {(sheet.tactics || sheet.weak) && (
        <div className="csheet__notes">
          {sheet.tactics && (
            <section className="csheet-note">
              <h5 className="csheet__heading">Táticas</h5>
              <p>{sheet.tactics}</p>
            </section>
          )}
          {sheet.weak && (
            <section className="csheet-note csheet-note--weak">
              <h5 className="csheet__heading">Fraquezas e resistências</h5>
              <p>{sheet.weak}</p>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
