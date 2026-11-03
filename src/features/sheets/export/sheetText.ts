// ────────────────────────────────────────────────────────
// Ficha em texto (.txt): blocos pequenos que cada sistema monta e o
// download. Valor vazio some do arquivo, pra ele só trazer o que a ficha tem.
// ────────────────────────────────────────────────────────

export type Line = string | null | undefined | false

const DIVIDER = '='.repeat(60)

/** "Rótulo: valor"; some se o valor for vazio. */
export function kv(label: string, value: string | number | boolean | null | undefined): Line {
  if (value === null || value === undefined || value === '') return null
  const text = typeof value === 'boolean' ? (value ? 'sim' : 'não') : String(value)
  return `${label}: ${text}`
}

/** "atual/máximo". */
export function ratio(current: number, max: number): string {
  return `${current}/${max}`
}

/** Item de lista; texto de várias linhas fica alinhado embaixo do traço. */
export function bullet(text: string): string {
  const [first, ...rest] = text.split('\n')
  return [`- ${first}`, ...rest.map((l) => `  ${l}`)].join('\n')
}

/** Texto livre (história, notas): mantém as quebras de linha. */
export function prose(text: string | null | undefined): Line {
  const t = text?.trim()
  return t ? t : null
}

export interface Section {
  title: string
  lines: Line[]
}

/** Junta as seções; seção sem nenhuma linha não aparece. */
export function buildSheetText(title: string, sections: Section[], extraHeader: Line[] = []): string {
  const out: string[] = [DIVIDER, title.toUpperCase(), ...extraHeader.filter((l): l is string => !!l), `Exportada em ${new Date().toLocaleString('pt-BR')}`, DIVIDER]
  for (const s of sections) {
    const lines = s.lines.filter((l): l is string => !!l)
    if (lines.length === 0) continue
    out.push('', s.title.toUpperCase(), '-'.repeat(Math.min(60, s.title.length)), ...lines)
  }
  return `${out.join('\n')}\n`
}

/** Nome de arquivo seguro: "Personagem - Sistema.txt". */
export function sheetFileName(character: string | null | undefined, system: string): string {
  const clean = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim()
  const name = clean(character ?? '') || 'Personagem'
  return `${name} - ${clean(system)}.txt`
}

/** Baixa o texto como arquivo .txt (com BOM, pros acentos abrirem certo no Bloco de Notas). */
export function downloadTextFile(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
