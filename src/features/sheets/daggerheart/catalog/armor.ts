import type { DhArmorEntry } from '../model/types'

// ────────────────────────────────────────────────────────
// Armaduras do Livro Básico (patamares 1 a 4): limiares base (Maior / Grave), Armadura base e característica.
// ────────────────────────────────────────────────────────

export const ARMORS: DhArmorEntry[] = [
  { id: "gambeson-armor", name: "Gibão", tier: 1, major: 5, severe: 11, score: 3, featureName: "Flexível", feature: "+1 na Evasão", mods: { evasion: 1 } },
  { id: "leather-armor", name: "Armadura de couro", tier: 1, major: 6, severe: 13, score: 3 },
  { id: "chainmail-armor", name: "Cota de malha", tier: 1, major: 7, severe: 15, score: 4, featureName: "Pesada", feature: "−1 na Evasão", mods: { evasion: -1 } },
  { id: "full-plate-armor", name: "Armadura de placas", tier: 1, major: 8, severe: 17, score: 4 },
  { id: "improved-gambeson-armor", name: "Gibão aprimorado", tier: 2, major: 7, severe: 16, score: 4, featureName: "Flexível", feature: "+1 na Evasão", mods: { evasion: 1 } },
  { id: "improved-leather-armor", name: "Armadura de couro aprimorada", tier: 2, major: 9, severe: 20, score: 4 },
  { id: "improved-chainmail-armor", name: "Cota de malha aprimorada", tier: 2, major: 11, severe: 24, score: 5, featureName: "Pesada", feature: "−1 na Evasão", mods: { evasion: -1 } },
  { id: "improved-full-plate-armor", name: "Armadura de placas aprimorada", tier: 2, major: 13, severe: 28, score: 5, featureName: "Muito Pesada", feature: "−2 na Evasão; −1 em Agilidade", mods: { evasion: -2, traits: { agility: -1 } } },
  { id: "elundrian-chain-armor", name: "Cota de Malha Elundriana", tier: 2, major: 9, severe: 21, score: 4, featureName: "Protegida", feature: "Você reduz o dano mágico sofrido pelo valor da sua Armadura antes de aplicá-lo aos limiares de dano." },
  { id: "harrowbone-armor", name: "Armadura do Tormento", tier: 2, major: 9, severe: 21, score: 4, featureName: "Resiliente", feature: "Antes de marcar seu último Ponto de Armadura, role 1d6. Com resultado 6, reduza a gravidade em uma categoria sem marcar o Ponto de Armadura." },
  { id: "irontree-breastplate-armor", name: "Peitoral de Placas de Pau-Ferro", tier: 2, major: 9, severe: 20, score: 4, featureName: "Reforçada", feature: "Ao marcar seu último Ponto de Armadura, aumente seus limiares de dano em +2 até recuperar ao menos 1 Ponto de Armadura." },
  { id: "runetan-floating-armor", name: "Armadura Flutuante de Runetan", tier: 2, major: 9, severe: 20, score: 4, featureName: "Cambiante", feature: "Ao ser alvo de um ataque, você pode marcar 1 Ponto de Armadura para dar desvantagem ao teste de ataque contra você." },
  { id: "tyris-soft-armor", name: "Armadura Graciosa de Tyris", tier: 2, major: 8, severe: 18, score: 5, featureName: "Silenciosa", feature: "Você recebe +2 de bônus em testes para se mover em silêncio." },
  { id: "rosewild-armor", name: "Armadura de Rosamata", tier: 2, major: 11, severe: 23, score: 5 },
  { id: "advanced-gambeson-armor", name: "Gibão avançado", tier: 3, major: 9, severe: 23, score: 5, featureName: "Flexível", feature: "+1 na Evasão", mods: { evasion: 1 } },
  { id: "advanced-leather-armor", name: "Armadura de couro avançada", tier: 3, major: 11, severe: 27, score: 5 },
  { id: "advanced-chainmail-armor", name: "Cota de malha avançada", tier: 3, major: 13, severe: 31, score: 6, featureName: "Pesada", feature: "−1 na Evasão", mods: { evasion: -1 } },
  { id: "advanced-full-plate-armor", name: "Armadura de placas avançada", tier: 3, major: 15, severe: 35, score: 6, featureName: "Muito Pesada", feature: "−2 na Evasão; −1 em Agilidade", mods: { evasion: -2, traits: { agility: -1 } } },
  { id: "bellamoi-fine-armor", name: "Armadura de Bellamoi", tier: 3, major: 11, severe: 27, score: 5, featureName: "Dourada", feature: "+1 em Presença", mods: { traits: { presence: 1 } } },
  { id: "dragonscale-armor", name: "Armadura de escamas de dragão", tier: 3, major: 11, severe: 27, score: 5, featureName: "Impenetrável", feature: "Uma vez por descanso curto, ao marcar seu último Ponto de Vida, você pode marcar 1 Ponto de Fadiga em vez disso." },
  { id: "spiked-plate-armor", name: "Armadura de placas com espinhos", tier: 3, major: 10, severe: 25, score: 5, featureName: "Afiada", feature: "Em um ataque bem-sucedido contra um alvo em alcance corpo a corpo, some 1d4 à rolagem de dano." },
  { id: "bladefare-armor", name: "Armadura Passalâmina", tier: 3, major: 16, severe: 39, score: 6, featureName: "Física", feature: "Você não pode marcar Pontos de Armadura para reduzir dano mágico." },
  { id: "monetts-cloak", name: "Capa de Monett", tier: 3, major: 16, severe: 39, score: 6, featureName: "Mágica", feature: "Você não pode marcar Pontos de Armadura para reduzir dano físico." },
  { id: "runes-of-fortification", name: "Runas da Fortificação", tier: 3, major: 17, severe: 43, score: 6 },
  { id: "legendary-gambeson-armor", name: "Gibão lendário", tier: 4, major: 11, severe: 32, score: 6, featureName: "Flexível", feature: "+1 na Evasão", mods: { evasion: 1 } },
  { id: "legendary-leather-armor", name: "Armadura de couro lendária", tier: 4, major: 13, severe: 36, score: 6 },
  { id: "legendary-chainmail-armor", name: "Cota de malha lendária", tier: 4, major: 15, severe: 40, score: 7, featureName: "Pesada", feature: "−1 na Evasão", mods: { evasion: -1 } },
  { id: "legendary-full-plate-armor", name: "Armadura de placas lendária", tier: 4, major: 17, severe: 44, score: 7, featureName: "Muito Pesada", feature: "−2 na Evasão; −1 em Agilidade", mods: { evasion: -2, traits: { agility: -1 } } },
  { id: "dunamis-silkchain", name: "Cota de Seda de Dunamis", tier: 4, major: 13, severe: 36, score: 7, featureName: "Lentidão Temporal", feature: "Marque 1 Ponto de Armadura para rolar 1d4 e somar o resultado como bônus na Evasão contra um ataque." },
  { id: "channeling-armor", name: "Armadura da Canalização", tier: 4, major: 13, severe: 36, score: 5, featureName: "Canalizadora", feature: "+1 em testes de conjuração", mods: { spellcast: 1 } },
  { id: "emberwoven-armor", name: "Armadura de tecido âmbar", tier: 4, major: 13, severe: 36, score: 6, featureName: "Ardente", feature: "Quando um adversário atacar você em alcance corpo a corpo, ele marca 1 Ponto de Fadiga." },
  { id: "full-fortified-armor", name: "Armadura fortificada", tier: 4, major: 15, severe: 40, score: 4, featureName: "Fortificada", feature: "Ao marcar 1 Ponto de Armadura, você reduz a gravidade do ataque em duas categorias em vez de uma." },
  { id: "veritas-opal-armor", name: "Armadura de Opala da Verdade", tier: 4, major: 13, severe: 36, score: 6, featureName: "Busca da Verdade", feature: "Esta armadura brilha quando outra criatura em alcance próximo conta uma mentira." },
  { id: "savior-chainmail", name: "Cota de Malha Salvadora", tier: 4, major: 18, severe: 48, score: 8, featureName: "Difícil", feature: "−1 em todos os atributos e na Evasão", mods: { allTraits: -1, evasion: -1 } },
]

const BY_ID = new Map(ARMORS.map((a) => [a.id, a]))

export function armorEntry(id: string): DhArmorEntry | undefined {
  return BY_ID.get(id)
}
