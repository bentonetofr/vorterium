-- ============================================================
-- Vorterium — Tira a Raiz Mestre (o botão SE TORNAR UM MESTRE) do site
-- Migration: 20240191000000_tirar_raiz_mestre.sql
-- Aplicar após: 20240190000000_vampiro_marco2.sql
-- ============================================================
--
-- O código saiu do site (guardado/raiz-mestre/). Aqui desfaz tudo o que
-- o botão fez, pra todo mundo:
--   • fichas que viraram Mestre voltam à raiz, Vitalidade, Equilíbrio e
--     TORRE de antes (a cópia mestre_backup);
--   • fichas de quem recusou voltam a ser como eram (a cópia
--     mestre_refusal_backup: ficha, domínios e runas);
--   • ninguém é mais Mestre (profiles.mestre_at): o tema preto e as
--     partículas somem;
--   • apaga quem apertou, as ascensões, as recusas e a campanha escolhida;
--   • desliga o recurso 'raiz-mestre' no Painel de controle.
-- As tabelas e funções ficam no banco, paradas (o recurso desligado
-- bloqueia tudo), pra dar pra religar um dia junto com o código guardado.
-- ============================================================

do $$
declare
  s    public.altherium_character_sheets;
  b    jsonb;
  prev public.altherium_character_sheets;
begin
  -- ── 1. Quem recusou: a ficha volta a ser como era ──
  for s in select * from public.altherium_character_sheets where mestre_refusal_backup is not null for update loop
    b := s.mestre_refusal_backup;
    prev := jsonb_populate_record(null::public.altherium_character_sheets, b->'sheet');
    update public.altherium_character_sheets set
      level               = prev.level,
      attr_furia          = prev.attr_furia,
      attr_destino        = prev.attr_destino,
      attr_espirito       = prev.attr_espirito,
      attr_impulso        = prev.attr_impulso,
      attr_estrategia     = prev.attr_estrategia,
      attr_runico         = prev.attr_runico,
      vitality_max        = prev.vitality_max,
      equilibrio_max      = prev.equilibrio_max,
      fv_max              = prev.fv_max,
      pr_max              = prev.pr_max,
      cards_max           = prev.cards_max,
      vitality_current    = prev.vitality_current,
      equilibrio_current  = prev.equilibrio_current,
      fv_current          = prev.fv_current,
      pr_current          = prev.pr_current,
      cards_current       = prev.cards_current,
      runaskin_scene_uses = prev.runaskin_scene_uses,
      berserker_triumphs  = prev.berserker_triumphs,
      recent_triumphs     = prev.recent_triumphs,
      mestre_refusal_backup = null
    where id = s.id;

    delete from public.altherium_character_domains where sheet_id = s.id;
    insert into public.altherium_character_domains
    select * from jsonb_populate_recordset(null::public.altherium_character_domains, b->'domains');

    insert into public.altherium_runaskin_runes
    select * from jsonb_populate_recordset(null::public.altherium_runaskin_runes, b->'runes')
    on conflict (id) do nothing;
  end loop;

  -- ── 2. Quem virou Mestre: a ficha volta à raiz de antes ──
  update public.altherium_character_sheets s set
    raiz               = s.mestre_backup->>'raiz',
    vitality_max       = (s.mestre_backup->>'vitality_max')::int,
    vitality_current   = (s.mestre_backup->>'vitality_current')::int,
    equilibrio_max     = (s.mestre_backup->>'equilibrio_max')::int,
    equilibrio_current = (s.mestre_backup->>'equilibrio_current')::int,
    torre_current      = coalesce((s.mestre_backup->>'torre_current')::int, 0),
    mestre_backup      = null
  where s.raiz = 'mestre' and s.mestre_backup is not null;

  -- Mestre sem cópia (não devia existir): fica sem raiz, o jogador escolhe de novo.
  update public.altherium_character_sheets set raiz = null where raiz = 'mestre';
end $$;

-- ── 3. Ninguém é mais Mestre (some o tema preto) ──
update public.profiles set mestre_at = null where mestre_at is not null;

-- ── 4. Limpa o resto e desliga o recurso ──
delete from public.altherium_mestre_calls;
delete from public.altherium_mestre_ascensions;
delete from public.altherium_mestre_refusals;
delete from public.altherium_mestre_campaigns;
update public.site_features set enabled = false where key = 'raiz-mestre';
