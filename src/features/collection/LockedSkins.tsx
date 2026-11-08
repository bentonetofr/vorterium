import { COLLECTION_SKINS } from '../dice3d/skins'
import { TIER_COLOR, TIER_LABEL } from './UnlockCard'
import './LockedSkins.css'

// ────────────────────────────────────────────────────────
// A parte secreta da coleção: os conjuntos que a conta ainda não ganhou aparecem como silhuetas com "?" (só a cor da raridade,
// nunca o nome nem o dado nem como se ganha). Entram como itens de lista no fim da vitrine.
// ────────────────────────────────────────────────────────

/** Quantos conjuntos da coleção a conta já tem (e o total). */
export const collectionCount = (unlocked: ReadonlySet<string>) => ({ have: COLLECTION_SKINS.filter((s) => unlocked.has(s.id)).length, total: COLLECTION_SKINS.length })

export function CollectionProgress({ unlocked, loaded }: { unlocked: ReadonlySet<string>; loaded: boolean }) {
  if (!loaded) return null
  const { have, total } = collectionCount(unlocked)
  return (
    <p className="col-progress" aria-label={`Coleção: ${have} de ${total} descobertos`}>
      <span className="col-progress__bar" aria-hidden="true"><i style={{ width: `${(have / total) * 100}%` }} /></span>
      <span>Coleção secreta · {have}/{total}</span>
    </p>
  )
}

/** As silhuetas dos que faltam (itens <li>, pra ficar na mesma lista dos conjuntos). */
export function LockedSkins({ unlocked, loaded, className = '' }: { unlocked: ReadonlySet<string>; loaded: boolean; className?: string }) {
  if (!loaded) return null
  return (
    <>
      {COLLECTION_SKINS.filter((s) => !unlocked.has(s.id)).map((s) => {
        const [c1, c2] = TIER_COLOR[s.tier ?? 'comum']
        return (
          <li key={s.id} className={`col-locked ${className}`} style={{ ['--tc' as string]: c1, ['--tc2' as string]: c2 }}>
            <span className="col-locked__die" aria-hidden="true">?</span>
            <span className="col-locked__name">Dado secreto</span>
            <span className="col-locked__tier">{TIER_LABEL[s.tier ?? 'comum']}</span>
          </li>
        )
      })}
    </>
  )
}
