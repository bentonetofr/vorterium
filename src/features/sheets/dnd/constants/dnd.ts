// ────────────────────────────────────────────────────────
// D&D 5e — constantes do sistema. Planejamento completo em
// docs/superpowers/specs/2026-10-13-ficha-dnd5e-design.md
// ────────────────────────────────────────────────────────

/** Chave do recurso no Painel de controle (nasce guardado). */
export const DND_FEATURE = 'dnd5e'

/** Conjunto de regras do catálogo e das fichas (a 2024 entra depois como outro). */
export const DND_RULESET = 'dnd5e_2014'

/**
 * Atribuição exigida pela licença CC-BY-4.0 do SRD 5.1. Texto idêntico ao do
 * preâmbulo do `SRD_CC_v5.1.pdf` oficial (conferido em 13/10/2026). O SRD pede
 * que nenhuma outra atribuição à Wizards seja incluída; dizer "compatível com
 * a quinta edição" é permitido.
 */
export const SRD_ATTRIBUTION =
  'This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC ' +
  'and available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under the ' +
  'Creative Commons Attribution 4.0 International License available at https://creativecommons.org/licenses/by/4.0/legalcode.'

/** Retrato da ficha (bucket dnd-portraits, caminho "<id da ficha>/portrait"). */
export const DND_PORTRAIT_MAX_BYTES = 2 * 1024 * 1024
/** Tamanho máximo da imagem escolhida: o editor de enquadramento a reduz para um JPG pequeno antes de enviar. */
export const DND_PORTRAIT_PICK_MAX_BYTES = 10 * 1024 * 1024
export const DND_PORTRAIT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

/** Nível máximo do personagem: a soma dos níveis das classes não passa de 20 (o banco confere também). */
export const DND_MAX_LEVEL = 20
