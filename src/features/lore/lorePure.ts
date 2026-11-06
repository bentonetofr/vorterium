// ────────────────────────────────────────────────────────
// Lore dos personagens — contas puras (tipos de arquivo, tamanhos, palavras).
// ────────────────────────────────────────────────────────

export const LORE_BODY_MAX = 60000
export const LORE_FILE_MAX_BYTES = 20 * 1024 * 1024
export const LORE_FILES_MAX = 25

export type LoreFileKind = 'pdf' | 'docx' | 'text' | 'other'

const TEXT_EXT = ['txt', 'md', 'markdown', 'json', 'csv', 'log']
const OTHER_EXT = ['doc', 'odt', 'rtf']

export function loreFileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i < 0 ? '' : name.slice(i + 1).toLowerCase()
}

/** Como o arquivo é mostrado no leitor; null se o tipo não é aceito. */
export function loreFileKind(name: string): LoreFileKind | null {
  const ext = loreFileExt(name)
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (TEXT_EXT.includes(ext)) return 'text'
  if (OTHER_EXT.includes(ext)) return 'other'
  return null
}

export const LORE_ACCEPT = ['pdf', 'docx', ...OTHER_EXT, ...TEXT_EXT].map((e) => `.${e}`).join(',')

/** Mensagem de erro se o arquivo não pode ser enviado; null se está tudo certo. */
export function checkLoreFile(file: { name: string; size: number }, alreadyHave = 0): string | null {
  if (alreadyHave >= LORE_FILES_MAX) return `Você já tem ${LORE_FILES_MAX} arquivos. Remova algum para enviar outro.`
  if (!loreFileKind(file.name)) return `“${file.name}”: tipo não aceito. Use PDF, DOCX, DOC, ODT, RTF, TXT, MD, JSON ou CSV.`
  if (file.size <= 0) return `“${file.name}” está vazio.`
  if (file.size > LORE_FILE_MAX_BYTES) return `“${file.name}” passa de 20 MB.`
  return null
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Nome seguro para o caminho no Storage (sem acentos nem símbolos). */
export function safeLoreFileName(name: string): string {
  const ext = loreFileExt(name)
  const base = ext ? name.slice(0, name.length - ext.length - 1) : name
  const clean = base.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${clean || 'arquivo'}${ext ? `.${ext}` : ''}`
}

export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/** "agora", "há 5 min", "há 3 h", "há 2 dias", ou a data. */
export function relativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
  return new Date(iso).toLocaleDateString('pt-BR')
}
