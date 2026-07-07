-- ============================================================
-- REVVIO 2.0 · Fase 1 — Row Level Security
-- Isolamento por seller_id + bypass de admin.
-- ============================================================

alter table public.rv_sellers     enable row level security;
alter table public.rv_vehicles    enable row level security;
alter table public.rv_sales       enable row level security;
alter table public.rv_commissions enable row level security;

-- ── rv_sellers ──────────────────────────────────────────────
-- leitura pública só de vendedores ativos (marketplace / mini-loja)
create policy "rv_sellers_public_read_active" on public.rv_sellers
  for select using (status = 'active');

-- vendedor lê o próprio registro (mesmo pending/suspended)
create policy "rv_sellers_read_own" on public.rv_sellers
  for select using (user_id = auth.uid());

-- admin lê todos
create policy "rv_sellers_admin_read" on public.rv_sellers
  for select using (public.is_admin());

-- usuário cria o próprio cadastro (defaults forçam status=pending, role=seller)
create policy "rv_sellers_insert_self" on public.rv_sellers
  for insert with check (user_id = auth.uid());

-- vendedor edita o próprio perfil (trigger bloqueia colunas sensíveis)
create policy "rv_sellers_update_own" on public.rv_sellers
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- admin edita qualquer vendedor (aprovar/suspender/configurar comissão)
create policy "rv_sellers_admin_update" on public.rv_sellers
  for update using (public.is_admin()) with check (public.is_admin());

-- ── rv_vehicles ─────────────────────────────────────────────
-- catálogo é público (marketplace mostra veículos de todos)
create policy "rv_vehicles_public_read" on public.rv_vehicles
  for select using (true);

-- vendedor cria veículos atrelados a si mesmo
create policy "rv_vehicles_insert_own" on public.rv_vehicles
  for insert with check (seller_id = public.current_seller());

-- vendedor edita/remove os próprios; admin todos
create policy "rv_vehicles_update_own" on public.rv_vehicles
  for update using (seller_id = public.current_seller() or public.is_admin())
  with check (seller_id = public.current_seller() or public.is_admin());

create policy "rv_vehicles_delete_own" on public.rv_vehicles
  for delete using (seller_id = public.current_seller() or public.is_admin());

-- ── rv_sales (privado: só dono + admin) ─────────────────────
create policy "rv_sales_read_own" on public.rv_sales
  for select using (seller_id = public.current_seller() or public.is_admin());

create policy "rv_sales_insert_own" on public.rv_sales
  for insert with check (seller_id = public.current_seller());

create policy "rv_sales_update_own" on public.rv_sales
  for update using (seller_id = public.current_seller() or public.is_admin())
  with check (seller_id = public.current_seller() or public.is_admin());

-- ── rv_commissions (leitura própria; escrita só admin) ──────
create policy "rv_commissions_read_own" on public.rv_commissions
  for select using (seller_id = public.current_seller() or public.is_admin());

-- só admin marca como paga / ajusta status
create policy "rv_commissions_admin_update" on public.rv_commissions
  for update using (public.is_admin()) with check (public.is_admin());
-- INSERT de rv_commissions ocorre só via register_sale() (SECURITY DEFINER),
-- portanto não há policy de insert para clientes.
