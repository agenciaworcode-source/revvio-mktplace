-- ============================================================
-- REVVIO 2.0 · Ciclo de vida da comissão de venda
-- - admin marca comissão como paga / reverte para pendente
-- - varredura pending → overdue quando passa o vencimento
-- (agendada via pg_cron quando disponível; idempotente)
-- ============================================================

-- ── Marcar comissão como paga (admin) ───────────────────────
create or replace function public.mark_commission_paid(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas o admin pode quitar comissões.';
  end if;

  update public.rv_commissions
    set status  = 'paid',
        paid_at = now()
  where id = p_commission_id;

  if not found then
    raise exception 'Comissão % não encontrada.', p_commission_id;
  end if;
end;
$$;

-- ── Reverter comissão para pendente (admin) ─────────────────
create or replace function public.mark_commission_pending(p_commission_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas o admin pode alterar comissões.';
  end if;

  update public.rv_commissions
    set status  = case
                    when due_date is not null and due_date < current_date then 'overdue'
                    else 'pending'
                  end,
        paid_at = null
  where id = p_commission_id;

  if not found then
    raise exception 'Comissão % não encontrada.', p_commission_id;
  end if;
end;
$$;

-- ── Varredura: pending → overdue após o vencimento ──────────
-- Retorna quantas comissões foram marcadas como atrasadas.
create or replace function public.mark_overdue_commissions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.rv_commissions
    set status = 'overdue'
  where status = 'pending'
    and due_date is not null
    and due_date < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.mark_commission_paid(uuid)    to authenticated;
grant execute on function public.mark_commission_pending(uuid) to authenticated;
grant execute on function public.mark_overdue_commissions()    to authenticated;

-- ── Agendamento diário (apenas se pg_cron existir no projeto) ─
-- Em produção (Supabase cloud) habilite a extensão pg_cron no Dashboard.
-- Local/sem pg_cron: a função continua chamável manualmente / pelo app.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'rv_mark_overdue_commissions',
      '5 3 * * *',                       -- todo dia às 03:05
      $cron$ select public.mark_overdue_commissions(); $cron$
    );
  end if;
end;
$$;
