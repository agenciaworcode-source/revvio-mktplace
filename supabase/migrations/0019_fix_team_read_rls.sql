-- ============================================================
-- Fix: rv_sellers_team_read deve ser restrito ao garagista
-- O spec (hierarquia-garagista-vendedor-design.md) diz:
--   "Garagista vê a própria equipe (parent_id = current_loja())"
-- A policy anterior não tinha o guard is_loja_manager(), então
-- vendedores podiam ver os vendedores irmãos da mesma loja via
-- current_loja() (que para vendedor retorna parent_id).
-- Detectado pelo teste F1 (isolamento intra-loja).
-- ============================================================

drop policy if exists "rv_sellers_team_read" on public.rv_sellers;
create policy "rv_sellers_team_read" on public.rv_sellers
  for select using (
    public.is_loja_manager()
    and parent_id = public.current_loja()
  );
