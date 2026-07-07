-- ============================================================
-- Fase C · comissão: o GARAGISTA (manager da própria loja) pode
-- quitar/reverter as comissões da sua loja (além do admin).
-- ============================================================

create or replace function public.mark_commission_paid(p_commission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_loja uuid;
begin
  select seller_id into v_loja from public.rv_commissions where id = p_commission_id;
  if v_loja is null then raise exception 'Comissão % não encontrada.', p_commission_id; end if;
  if not (public.is_admin() or (public.is_loja_manager() and v_loja = public.current_loja())) then
    raise exception 'Sem permissão para quitar esta comissão.';
  end if;
  update public.rv_commissions set status = 'paid', paid_at = now() where id = p_commission_id;
end;
$$;

create or replace function public.mark_commission_pending(p_commission_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_loja uuid;
begin
  select seller_id into v_loja from public.rv_commissions where id = p_commission_id;
  if v_loja is null then raise exception 'Comissão % não encontrada.', p_commission_id; end if;
  if not (public.is_admin() or (public.is_loja_manager() and v_loja = public.current_loja())) then
    raise exception 'Sem permissão para alterar esta comissão.';
  end if;
  update public.rv_commissions
    set status = case when due_date is not null and due_date < current_date
                      then 'overdue'::commission_status else 'pending'::commission_status end,
        paid_at = null
  where id = p_commission_id;
end;
$$;
