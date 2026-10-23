# Importar ficha de D&D por PDF

Pedido do usuário (23/10/2026): na ficha do jogador, mesmo que já criada, um botão para **importar um PDF da ficha**. O sistema **lê tudo, faz perguntas em cards no centro da tela (como um questionário) onde houver dúvida e importa a ficha inteira do personagem sem erros**, mesmo que isso custe perguntas.

## O PDF de exemplo

`FICHA DE DND DANDRELIS ELDRICON.pdf` é a ficha preenchível **"JohnBard.com DnD 5e CS v1.4"** (formulário de Jeremy Wunders, traduzida por Mario Mazzero), muito usada por jogadores brasileiros. É um PDF de **formulário (AcroForm)**: 2152 campos com nomes fixos (`Character Name`, `STR2`, `SklAcrProf`, `SklAcrExp`, `Attack1Name`, `Spells 1014`, `Check Box 251`, `Class`, `Race`...). Ler os campos pelo nome é exato: não há adivinhação de texto nem OCR.

Mapa da ficha (7 páginas): p1 = atributos, perícias, salvaguardas, PV, ataques, equipamento, características; p2 = aparência, história, facção, inventário (texto livre), traços; p3 = lista de magias por nível (a ordem das linhas é por posição na página); p4 a p7 = cartas de magia com alcance, tempo de conjuração, duração, componentes e texto.

## Como funciona (decisões)

1. **Leitura no navegador** com `pdfjs-dist` (carregado só ao importar, pedaço separado do site). O PDF não sai do computador da pessoa.
2. **Reconhece o modelo** pelos nomes dos campos. Modelo conhecido = importação exata. PDF sem campos de formulário ou de outro modelo: o sistema avisa com clareza o que não consegue ler (não inventa).
3. **Monta um rascunho** da ficha (classes, atributos, perícias, ataques, inventário, magias, características, moedas, texto) casando nomes com o catálogo (português e original, sem acento).
4. **Confere o rascunho contra os números do próprio PDF**: roda o motor de regras do sistema no rascunho e compara CA, PV, iniciativa, deslocamento, bônus de perícias e salvaguardas, CD e ataque de magia, percepção passiva. Toda diferença vira uma pergunta ("no PDF a Furtividade é +2, no sistema deu +3, qual vale?"). É isso que garante "sem erros".
5. **Perguntas em cards no centro da tela**, um por vez, com Voltar, progresso e "pular". Tipos: escolher uma opção, confirmar uma lista (marcar o que entra), digitar um valor, escolher o destino de um texto.
6. **Resumo final** do que vai ser gravado e do que será substituído; só então grava. A importação **substitui o conteúdo da ficha aberta** (classes, perícias, ataques, inventário, magias, características e campos), com confirmação explícita. Nada é gravado antes disso.
7. **Gravação** nas mesmas tabelas da ficha (sheet, classes, perícias, ataques, inventário, magias, proficiências, características, recursos, sobrescritas manuais). Itens e magias fora do catálogo viram itens e magias próprias, com aviso.

## Perguntas previstas (o que o exemplo já mostra)

- **Classe e nível** ("Bard Nível 5"): confirmar; multiclasse; **subclasse** (o PDF não traz, e um Bardo 5 já tem Colégio).
- **Raça, sub-raça e antecedente** ("Half-Elf", "Entertainer"): casar com o catálogo.
- **XP inválido** ("MUITA"): pedir o número (ou usar o do nível).
- **PV máximo**: o PDF diz 28; o sistema calcula pela média. Opções: ajustar a rolagem de PV de cada nível para dar 28, usar 28 como valor manual, ou usar a média.
- **Perícias e especialização**: inferir pelos marcadores e conferir com o valor escrito.
- **Proficiências** (idiomas, ferramentas, armas, armaduras): casar texto livre com o catálogo.
- **Ataques**: casar com armas do catálogo ("Besta Leve", "Adaga"), dano e tipo.
- **Equipamento em texto livre** ("- Pacote de Diplomata (39 po)..."): separar em itens, casar com o catálogo, perguntar o resto.
- **Magias**: casar por nome; as que não casam, perguntar (corrigir o nome, criar própria, descartar). Preparadas, espaços gastos.
- **Características** (talentos, raça, classe, antecedente): separar o texto em blocos e confirmar cada bloco.
- **Textos sem lugar na ficha** (aparência, idade, altura, olhos, facção, aliados): escolher o destino (História, Notas, Aparência na História).
- **Divergências de números**: CA, deslocamento, iniciativa, dados de vida, espaços de magia.

## Etapas

1. Leitura do PDF (campos, posição) e modelo "JohnBard 1.4" → `PdfRead`, com testes sobre os campos do exemplo.
2. Casamento com o catálogo e rascunho da ficha (`plan`), com testes.
3. Conferência contra o motor de regras e geração das perguntas.
4. Janela de perguntas em cards (UI) e resumo final.
5. Gravação, botão na ficha ("Importar ficha (PDF)"), recarregar a ficha, testes e revisão.
6. Depois: outros modelos de PDF (ficha oficial da Wizards, D&D Beyond) conforme o usuário trouxer exemplos.

## Limites conhecidos

- O retrato do personagem e o símbolo da facção (imagens do PDF) não entram.
- PDF impresso e escaneado (só imagem) não tem dados para ler; o sistema avisa.
- A ficha do exemplo é a única testada até agora; cada modelo novo precisa de um PDF de exemplo.
