# DaggerHeart — Plano de Implementação
*Sistema: DaggerHeart SRD 2.0 (Darrington Press, 2026)*
*Spec criada em: 2026-11-16*

---

## 1. Mecânicas centrais do sistema

### 1.1 Duality Dice (rolagens com dois d12)

Toda rolagem de ação usa 2d12 — um dado de Esperança (Hope) e um dado de Medo (Fear). O jogador soma os dois, adiciona o modificador do traço relevante e compara com uma Dificuldade definida pelo Mestre.

| Resultado | Condição | Consequência |
|-----------|----------|--------------|
| **Sucesso com Esperança** | total ≥ dificuldade **e** dado de Esperança maior | Jogador ganha +1 Esperança |
| **Sucesso com Medo** | total ≥ dificuldade **e** dado de Medo maior | Mestre ganha +1 Medo |
| **Falha com Esperança** | total < dificuldade **e** dado de Esperança maior | Jogador ganha +1 Esperança |
| **Falha com Medo** | total < dificuldade **e** dado de Medo maior | Mestre ganha +1 Medo |
| **Sucesso Crítico** | ambos os dados mostram o mesmo número | Sucesso automático + limpa 1 Estresse + ganha Esperança |

Crítico = Sucesso com Esperança para fins de outras regras.

### 1.2 Traços (6 atributos)

| Traço | Usos típicos |
|-------|-------------|
| **Agilidade** (Agility) | Correr, pular, manobrar |
| **Força** (Strength) | Levantar, esmagar, agarrar |
| **Destreza** (Finesse) | Controlar, esconder, manipular |
| **Instinto** (Instinct) | Perceber, sentir, navegar |
| **Presença** (Presence) | Encantar, atuar, enganar |
| **Conhecimento** (Knowledge) | Lembrar, analisar, compreender |

Distribuição na criação: **+2, +1, +1, +0, +0, −1** (em qualquer ordem).  
Alguns subclasses concemdem um traço de Lançamento (Spellcast) baseado em um desses seis.

### 1.3 Proficiência (Proficiency)

- Começa em **1** no nível 1.
- Multiplica o **número de dados de dano** das armas (não é bônus de d20).
- Exemplo: Prof 2 + arma d8+2 → 2d8+2 de dano.
- Ataque sem arma: `[Prof]d4` de dano físico.

### 1.4 Pontos de Vida e Limiares de Dano

- HP representa "slots" (caixas), não valor numérico — começa com o HP da classe, máximo 12.
- **Limiares de Dano** são comparados ao dano total recebido:
  - Dano < Limiar Grave → marca **1 HP**
  - Limiar Grave ≤ Dano < Limiar Severo → marca **2 HP**
  - Dano ≥ Limiar Severo → marca **3 HP**
  - Dano reduzido a 0 ou menos → **0 HP** marcado
  - Regra opcional: dano ≥ 2× Limiar Severo → marca **4 HP**
- Limiares calculados: `base_da_armadura + nível_do_personagem`
- Ao marcar o último HP, o personagem cai → movimento de morte.

### 1.5 Estresse (Stress)

- Slots de estresse (caixas). Todos começam com **6**, máximo **12**.
- Marcar o último Stress → condição Vulnerável até limpar ≥ 1.
- Quando obrigado a marcar Stress mas todos estão marcados → marca 1 HP.
- Limpa com movimentos de descanso (Downtime).

### 1.6 Esperança (Hope) — PC

- Começa com **2**, máximo **6**, persiste entre sessões.
- Usos:
  - **Ajudar um Aliado** (Help an Ally): rola 1d6 de vantagem para aliado
  - **Usar uma Experiência** (Utilize an Experience): +modificador da Experiência na rolagem
  - **Tag Team Roll**: 3 Esperança — dois PCs fazem rolagens separadas, escolhe-se o melhor resultado
  - **Ativar Feature de Esperança**: 3 Esperança (feature específica da classe)

### 1.7 Medo (Fear) — Mestre

- Começa com 1 Medo por PC na mesa. Máximo **12**, persiste entre sessões.
- Ganho quando PC rola com Medo, PCs descansam, ou efeitos específicos.
- Gasto para interromper e fazer movimentos do Mestre, usar Features de Medo, etc.

### 1.8 Vantagem e Desvantagem

- Vantagem: +1d6 ao total (adicionar resultado)
- Desvantagem: −1d6 ao total (subtrair resultado)
- Cancelam uma a uma. Nunca mais de 1 de cada lado por vez.
- Exceção: "Ajudar um Aliado" empilha — o ator usa o maior d6 de todos os aliados que ajudaram.

### 1.9 Experiências (Experiences)

- 2 Experiências na criação, modificador **+2** cada.
- Frase livre descrevendo uma habilidade/background do personagem.
- Gasta 1 Esperança para usar; adiciona o modificador à rolagem relevante.
- Sem lista fixa; não pode ser muito ampla nem conceder benefícios mecânicos específicos.

### 1.10 Armadura

- **Pontuação de Armadura** (Armor Score): número de slots marcáveis para reduzir dano. Carrega entre batalhas se recarregada.
- **Limiar Grave** (Major Threshold): `base_major + nível`
- **Limiar Severo** (Severe Threshold): `base_severe + nível`
- Marcar 1 slot de Armadura → reduz dano recebido de um passo (Severo→Grave→Menor→0).

### 1.11 Evasão (Evasion)

- Número estático. Ataques inimigos devem atingir ou superar a Evasão do PC para acertar.
- Base definida pela classe; modificável por cartas, equipamento e condições.

---

## 2. Criação de Personagem (9 Passos)

| Passo | Conteúdo |
|-------|----------|
| 1 | Escolhe Classe + Subclasse (Foundation card) |
| 2 | Escolhe Herança: 1 Ancestral + 1 Comunidade |
| 3 | Distribui Traços: +2/+1/+1/+0/+0/−1 |
| 4 | Registra Nível (1), Evasão (da classe), HP inicial, 6 slots de Estresse, 2 Esperança |
| 5 | Escolhe Equipamento inicial (arma Tier 1 + armadura Tier 1) |
| 6 | Cria Background (perguntas da guia da classe) |
| 7 | Cria 2 Experiências (+2 cada) |
| 8 | Escolhe 2 Cartas de Domínio (nível 1, das 2 domains da classe) |
| 9 | Cria Conexões com os outros PCs |

---

## 3. Classes (13)

| Classe | Evasão Base | HP Base | Domínios | Traço de Lançamento |
|--------|-------------|---------|----------|----------------------|
| Assassin | 12 | 5 | Midnight, Blade | Instinct ou Finesse |
| Bard | 11 | 6 | Splendor, Grace | Presence |
| Brawler | 10 | 7 | Bone, Valor | — |
| Druid | 10 | 6 | Sage, Arcana | Instinct |
| Guardian | 11 | 6 | Valor, Codex | — |
| Ranger | 11 | 6 | Wanderer, Blade | — |
| Rogue | 12 | 5 | Midnight, Grace | — |
| Seraph | 10 | 6 | Grace, Splendor | Presence |
| Sorcerer | 10 | 5 | Arcana, Midnight | Knowledge |
| Warlock | 10 | 5 | Midnight, Bone | Presence |
| Warrior | 11 | 6 | Blade, Valor | — |
| Witch | 10 | 5 | Arcana, Sage | Instinct |
| Wizard | 10 | 5 | Arcana, Codex | Knowledge |

> ⚠️ Valores de Evasão e HP baseados em conhecimento comum do SRD 1.0/2.0 — conferir contra o livro impresso e ajustar se necessário.

---

## 4. Domínios (10)

Arcana, Blade, Bone, Codex, Grace, Midnight, Sage, Splendor, Valor, Wanderer

Cada domínio tem cartas de nível 1–6 (SRD 2.0 inclui apenas algumas por domínio). Implementação das cartas é Marco 2 — nesta fase só armazenamos nome livre + nível + domínio.

---

## 5. Ancestrais (24) e Comunidades (15)

**Ancestrais:** Aetheris, Clank, Drakona, Dwarf, Earthkin, Elf, Emberkin, Faerie, Faun, Firbolg, Fungril, Galapa, Giant, Gnome, Goblin, Halfling, Human, Infernis, Katari, Orc, Ribbet, Simiah, Skykin, Tidekin  
**Ancestral Misto:** combina 1ª feature de um + 2ª feature de outro

**Comunidades:** Duneborne, Freeborne, Frostborne, Hearthborne, Highborne, Loreborne, Orderborne, Reborne, Ridgeborne, Seaborne, Slyborne, Underborne, Warborne, Wanderborne, Wildborne

---

## 6. Armaduras Tier 1

| Armadura | Score | Limiar Grave (base) | Limiar Severo (base) |
|----------|-------|---------------------|----------------------|
| Sem armadura | 0 | 3 | 7 |
| Couro (Light) | 2 | 5 | 11 |
| Cota de Malha (Medium) | 3 | 7 | 14 |
| Placa (Heavy) | 4 | 10 | 18 |

Limiar final = base + nível do personagem.

---

## 7. Armas — exemplos Tier 1

| Arma | Traço | Dados de Dano | Mão(s) |
|------|-------|--------------|--------|
| Espada Curta | Finesse | d6+1 | 1H |
| Espada Longa | Strength | d8 | 2H ou 1H |
| Arco Curto | Agility | d6 | 2H |
| Adaga | Finesse | d4+2 | 1H |
| Machado de Mão | Strength | d8+1 | 1H |
| Lança | Strength | d8 | 2H |
| Cajado | Knowledge | d6 | 2H |
| Bordão | Instinct | d6+1 | 2H |

Dano efetivo = `[Proficiência]d[tipo]+[modificador]`

---

## 8. Ouro (Gold)

DaggerHeart não usa valores absolutos; usa uma abstração em 3 camadas:
- **Punhados** (Handfuls) — moeda corrente do dia a dia
- **Sacolas** (Bags) — riqueza moderada (1 bag = 10 handfuls)
- **Baús** (Chests) — riqueza significativa (1 chest = 10 bags)

---

## 9. Arquitetura no Vorterium

### 9.1 Estrutura de diretórios

```
src/features/sheets/daggerheart/
├── constants/
│   └── daggerheart.ts          # DAGGERHEART_FEATURE, constantes
├── rules/
│   ├── types.ts                # todos os tipos TypeScript
│   └── derive.ts               # cálculos derivados (limiares, dano)
├── catalog/
│   ├── classes.ts              # 13 classes com stats base
│   ├── ancestries.ts           # 24 ancestrais + 15 comunidades
│   ├── armor.ts                # tabelas de armaduras
│   └── weapons.ts              # tabelas de armas Tier 1
└── services/
    └── dhSheetService.ts       # CRUD completo
```

### 9.2 Tabelas Supabase

| Tabela | Responsabilidade |
|--------|-----------------|
| `dh_character_sheets` | Dados principais da ficha |
| `dh_experiences` | 2+ experiências por personagem |
| `dh_domain_cards` | Cartas de domínio (ativas + cofre) |
| `dh_weapons` | Armas equipadas/no inventário |
| `dh_inventory` | Itens gerais do inventário |

### 9.3 Campos calculados (não salvos no banco)

| Campo | Fórmula |
|-------|---------|
| `threshold_major` | `armor.base_major + level` |
| `threshold_severe` | `armor.base_severe + level` |
| `damage_roll` | `[proficiency]d[weapon.die]+[weapon.mod]` |

### 9.4 Sistema de Dados (rolagem)

A rolagem DaggerHeart é: `2d12 + trait_modifier`. O resultado retorna:
- `hope_die`: valor do dado de Esperança
- `fear_die`: valor do dado de Medo
- `total`: soma dos dados + modificador
- `outcome`: 'crit' | 'success_hope' | 'success_fear' | 'fail_hope' | 'fail_fear'

Usar o sistema de dice_rolls existente com `type = 'dh_duality'`.

---

## 10. Marcos de implementação

| Marco | Conteúdo |
|-------|----------|
| **0** ✅ Spec + base de dados | Migration, types, derive, catalog básico, service CRUD |
| **1** | Ficha completa (UI), rolagem de Duality Dice integrada ao canal |
| **2** | Cartas de Domínio com texto e efeitos; Movimentos de Descanso |
| **3** | Progressão de nível (advancements), tabela de Proficiência por nível |
| **4** | Bestiário DaggerHeart (adversários com Evasão/HP/Fear Features) |

---

*Baseado no Daggerheart SRD 2.0 — licença Creative Commons. Não inclui regras proprietárias fora do SRD.*
