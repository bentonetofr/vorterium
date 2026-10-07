# Raiz Mestre (guardada)

O botão SE TORNAR UM MESTRE das campanhas de Altherium, tirado do site a
pedido em 06/10/2026. Alguns jogadores continuavam com o tema preto e as
partículas douradas mesmo com o botão desligado: a marca de Mestre ficava no
perfil (`profiles.mestre_at`) e o tema ligava sozinho em qualquer página.
Nada nesta pasta vai pro ar: o build só compila `src/`.

## O que ela fazia
- Botão SE TORNAR UM MESTRE (e NÃO ME TORNAR UM MESTRE) no meio da tela dos
  jogadores da campanha escolhida no Painel de controle (recurso `raiz-mestre`).
- Quando todos apertavam: um livro fechando por cima do site, 4 s de escuro,
  e o site todo preto e dourado, com partículas subindo.
- A ficha virava raiz **Mestre**: Vitalidade e Equilíbrio dobrados, todos os
  triunfos das três raízes pagos com TORRE (Estratégia × 5).
- Quem recusava tinha a ficha rebaixada ao nível 1 (o mestre da mesa podia
  desfazer).

## O banco
A migration `20240191000000_tirar_raiz_mestre.sql` desfez tudo pra todo mundo:
fichas de volta como eram antes (pelas cópias `mestre_backup` e
`mestre_refusal_backup`), ninguém mais Mestre, apertos, ascensões, recusas e
campanha escolhida apagados, recurso desligado.

As migrations da Raiz Mestre (`20240176`, `20240184`, `20240186`) continuam em
`supabase/migrations/`, porque já rodaram e as tabelas e funções seguem no
banco, paradas: com o recurso desligado, as funções recusam tudo. As colunas
`raiz = 'mestre'`, `torre_current`, `cards_max`, `mestre_backup` e
`mestre_refusal_backup` da ficha de Altherium também ficaram, sem uso.

## Arquivos
| Aqui             | Volta para                                        |
|------------------|---------------------------------------------------|
| `src/`           | `src/features/mestre/`                            |
| `_ligacao.diff`  | trechos na ficha de Altherium, no layout, no Painel de controle e nos tipos |

## Pra religar
1. Copie `src/` de volta pra `src/features/mestre/`.
2. `git apply guardado/raiz-mestre/_ligacao.diff`: devolve o botão, a
   animação e o tema ao `PrivateLayout`, o recurso ao Painel de controle
   (`siteFeatures`), a raiz Mestre e a TORRE à ficha de Altherium (constantes,
   cálculos, formulário, painel, CSS, histórico) e os campos aos tipos. Se a
   ficha mudou muito desde 06/10, aplique à mão olhando o diff.
3. `npm run verify`.
4. Ligue o recurso "Raiz Mestre" no Painel de controle e escolha a campanha.
