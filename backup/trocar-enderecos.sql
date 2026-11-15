-- Troca o endereco do projeto ANTIGO pelo do projeto NOVO em todo texto/jsonb do schema public
-- (avatares, capas, retratos e outros links de imagem guardados com o endereco inteiro).
--
-- Roda no projeto NOVO, depois de levar o Storage (passo 5 do guia). Por padrao e um ENSAIO: mostra
-- quantas linhas mudariam em cada coluna e desfaz tudo (ROLLBACK). Pra valer, acrescente  -v aplicar=1 .
--
--   docker run --rm -v D:\baixados\programacao_reserva\vorterium\backup:/app:ro postgres:17 psql "STRING_DO_PROJETO_NOVO" -v antigo=CODIGO_ANTIGO -v novo=CODIGO_NOVO -f /app/trocar-enderecos.sql
--
-- CODIGO_ANTIGO / CODIGO_NOVO: so o codigo do projeto (as letras antes de .supabase.co).
-- Triggers e chaves ficam desligados dentro da transacao (session_replication_role = replica), entao
-- nada dispara por causa da troca. Pode rodar de novo: depois da troca nao ha mais o que trocar.

\set ON_ERROR_STOP on
\if :{?antigo} \else \echo 'FALTOU -v antigo=CODIGO_ANTIGO' \quit \endif
\if :{?novo} \else \echo 'FALTOU -v novo=CODIGO_NOVO' \quit \endif

begin;
set local session_replication_role = replica;
select set_config('troca.antigo', :'antigo' || '.supabase.co', true) as _a, set_config('troca.novo', :'novo' || '.supabase.co', true) as _n \gset

do $$
declare
  r record;
  n bigint;
  total bigint := 0;
  velho text := current_setting('troca.antigo');
  novo  text := current_setting('troca.novo');
begin
  for r in
    select c.table_name, c.column_name, c.data_type
    from information_schema.columns c
    join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
    where c.table_schema = 'public' and t.table_type = 'BASE TABLE'
      and c.data_type in ('text', 'character varying', 'jsonb')
    order by c.table_name, c.column_name
  loop
    if r.data_type = 'jsonb' then
      execute format('update public.%I set %I = replace(%I::text, $1, $2)::jsonb where %I::text like $3', r.table_name, r.column_name, r.column_name, r.column_name)
        using velho, novo, '%' || velho || '%';
    else
      execute format('update public.%I set %I = replace(%I, $1, $2) where %I like $3', r.table_name, r.column_name, r.column_name, r.column_name)
        using velho, novo, '%' || velho || '%';
    end if;
    get diagnostics n = row_count;
    if n > 0 then
      raise notice '  %.%: % linha(s)', r.table_name, r.column_name, n;
      total := total + n;
    end if;
  end loop;
  raise notice 'TOTAL: % valor(es) trocado(s) de % para %', total, velho, novo;
end $$;

\if :{?aplicar}
  \echo 'APLICADO (commit).'
  commit;
\else
  \echo 'ENSAIO: nada foi gravado (rollback). Rode de novo com -v aplicar=1 pra valer.'
  rollback;
\endif
