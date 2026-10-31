-- Altherium 2.0: o domínio "Esconder" saiu do livro. Apaga os pontos que
-- alguém tinha nele e tira o valor da lista aceita pela tabela.

delete from public.altherium_character_domains where domain = 'esconder';

alter table public.altherium_character_domains
  drop constraint if exists altherium_character_domains_domain_check;

alter table public.altherium_character_domains
  add constraint altherium_character_domains_domain_check check (domain in (
    'brutalidade', 'crime', 'determinacao', 'direcao',
    'furtividade', 'iniciativa', 'intimidacao', 'investigacao',
    'leveza', 'luta', 'medicina', 'percepcao', 'persuasao',
    'precisao', 'pressentimento', 'reflexo', 'religiao',
    'resiliencia', 'runologia', 'saberes', 'sobrevivencia',
    'tatica', 'vontade'
  ));
