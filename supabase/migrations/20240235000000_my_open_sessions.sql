-- ────────────────────────────────────────────────────────
-- Aviso de sessão aberta para os jogadores, em qualquer página do site: uma consulta só devolve as campanhas da pessoa cuja sessão está
-- aberta agora (a mesma regra de _campaign_session_reason, migrations 20240233 e 20240234), com o papel dela em cada uma.
-- ────────────────────────────────────────────────────────

create or replace function public.my_open_sessions()
returns table (campaign_id uuid, campaign_name text, role text, reason text)
language sql
stable
security definer
set search_path = public
as $$
  select t.campaign_id, t.campaign_name, t.role, t.reason
  from (
    select c.id as campaign_id, c.name as campaign_name, m.role::text as role, public._campaign_session_reason(c.id) as reason
    from public.campaign_members m
    join public.campaigns c on c.id = m.campaign_id
    where m.user_id = auth.uid()
  ) t
  where t.reason is not null;
$$;

revoke all on function public.my_open_sessions() from public;
grant execute on function public.my_open_sessions() to authenticated;
