// ────────────────────────────────────────────────────────
// As animações de tela do 20 natural e do 1 natural. Cada crítico sorteia
// uma das animações boas e cada falha crítica, uma das ruins, sem repetir a
// anterior. A paleta de cada uma também tinge a explosão em volta do dado
// (critFx.ts) e o som (sound.ts).
// ────────────────────────────────────────────────────────

export type FxKind = 'crit' | 'fumble'

export type CritTheme = 'fire' | 'glow' | 'lightning' | 'water' | 'ice' | 'arcane' | 'nature' | 'cosmos'
export type FumbleTheme = 'darkfire' | 'redlightning' | 'blood' | 'shadow' | 'cracks' | 'poison' | 'void' | 'ash'
export type FxTheme = CritTheme | FumbleTheme

export const CRIT_THEMES: readonly CritTheme[] = ['fire', 'glow', 'lightning', 'water', 'ice', 'arcane', 'nature', 'cosmos']
export const FUMBLE_THEMES: readonly FumbleTheme[] = ['darkfire', 'redlightning', 'blood', 'shadow', 'cracks', 'poison', 'void', 'ash']

/** Nome para mostrar (e para testes). */
export const THEME_NAMES: Record<FxTheme, string> = {
  fire: 'Fogo', glow: 'Brilho', lightning: 'Relâmpago', water: 'Água', ice: 'Gelo', arcane: 'Arcano', nature: 'Natureza', cosmos: 'Cosmos',
  darkfire: 'Chamas sombrias', redlightning: 'Relâmpago rubro', blood: 'Sangue', shadow: 'Trevas', cracks: 'Rachaduras', poison: 'Veneno', void: 'Vazio', ash: 'Cinzas',
}

/** Cores de cada animação: [núcleo claro, cor principal, cor escura]. */
export const THEME_COLORS: Record<FxTheme, readonly [string, string, string]> = {
  fire: ['#fff3b8', '#ff9a2a', '#e8430c'],
  glow: ['#ffffff', '#ffd25a', '#ffa21f'],
  lightning: ['#ffffff', '#bfe0ff', '#6f9dff'],
  water: ['#eaffff', '#6fd0ff', '#2a82f0'],
  ice: ['#ffffff', '#c4f1ff', '#7cc8ff'],
  arcane: ['#ffffff', '#e2a9ff', '#9a55ff'],
  nature: ['#f4ffc8', '#8cff6a', '#35c85a'],
  cosmos: ['#ffffff', '#c3b4ff', '#ff8fe2'],
  darkfire: ['#ffb199', '#d42a3a', '#701448'],
  redlightning: ['#ffe0e0', '#ff5a5a', '#b3121b'],
  blood: ['#ff9a9a', '#c4121e', '#6e0610'],
  shadow: ['#b9a0ff', '#6a3fc8', '#241048'],
  cracks: ['#ffe9d0', '#ff6a3a', '#a01818'],
  poison: ['#e6ff9a', '#8ae02a', '#3a8a1a'],
  void: ['#e8c6ff', '#9a3cff', '#2a0c52'],
  ash: ['#e6e0d8', '#9a9088', '#50463e'],
}

/** Sorteia um tema do tipo, diferente do anterior (`rnd` vem de fora para os testes). */
export function pickTheme(kind: FxKind, previous: FxTheme | null, rnd: () => number = Math.random): FxTheme {
  const all: readonly FxTheme[] = kind === 'crit' ? CRIT_THEMES : FUMBLE_THEMES
  const pool = all.filter((t) => t !== previous)
  return pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))]
}

export function themeKind(theme: FxTheme): FxKind {
  return (CRIT_THEMES as readonly string[]).includes(theme) ? 'crit' : 'fumble'
}
