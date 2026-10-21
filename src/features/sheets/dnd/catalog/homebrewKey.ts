/**
 * Chave estável a partir do nome do homebrew: minúsculas, sem acento, com
 * sublinhado ("Espada Flamejante" -> "espada_flamejante"). Sempre devolve algo
 * que o banco aceita (2 a 60 caracteres, só a-z, 0-9 e _).
 */
export function homebrewKeyFromName(name: string): string {
  const base = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60).replace(/_+$/g, '')
  if (base.length >= 2) return base
  return `item_${base || 'x'}`
}
