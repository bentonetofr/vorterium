import { getClass, spellListClass } from '../catalog'

// ────────────────────────────────────────────────────────
// De qual classe é cada magia do personagem (conjurador multiclasse). A classe fica em `class_key` da magia (migration 20240231) e
// só aparece quando a ficha tem mais de uma classe conjuradora.
// ────────────────────────────────────────────────────────

/** O nome da classe: a do catálogo, a digitada à mão ou a própria chave. */
export function spellClassLabel(classKey: string, names: Record<string, string> = {}): string {
  return getClass(classKey)?.name ?? names[classKey] ?? classKey
}

export interface CastingClassRef { classKey: string; subclassKey?: string | null }

/**
 * A classe que a magia do livro leva sozinha: só quando UMA das classes conjuradoras da ficha tem a magia na lista.
 * Com duas ou nenhuma (Clérigo e Druida dividem várias), fica sem classe até a pessoa escolher.
 */
export function autoSpellClass(spellLists: readonly string[], casting: readonly CastingClassRef[]): string | null {
  const matches = casting.filter((c) => spellLists.includes(spellListClass(c.classKey, c.subclassKey)))
  return matches.length === 1 ? matches[0].classKey : null
}
