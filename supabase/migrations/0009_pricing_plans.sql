-- ============================================================
-- REVVIO 2.0 · Fase 8 — Catálogo público de planos (página Vender)
-- Planos/tiers de assinatura exibidos em /vender. Diferente de rv_plans
-- (que é o plano de comercialização CUSTOM por garagista, billing ASAAS):
-- aqui são os TIERS padronizados que o garagista escolhe ao se cadastrar.
-- ============================================================

create table public.rv_pricing_plans (
  id            uuid primary key default gen_random_uuid(),
  key           text not null unique,                 -- essencial | profissional | enterprise
  name          varchar(80) not null,
  tagline       text,
  price_monthly numeric(10,2) not null,
  price_annual  numeric(10,2) not null,               -- valor por mês na cobrança anual
  color         varchar(9) not null default '#10b981',-- cor de destaque do card
  popular       boolean not null default false,
  cta_label     varchar(60) not null default 'Escolher plano',
  highlights    text[] not null default '{}',         -- bullets do card
  vehicle_limit int,                                  -- null = ilimitado
  trial_days    int not null default 7,
  sort_order    int not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.rv_pricing_plans enable row level security;

-- leitura pública dos planos ativos (landing /vender)
create policy "pricing_public_read" on public.rv_pricing_plans
  for select using (active);
-- admin lê todos (inclusive inativos) e gerencia
create policy "pricing_admin_read" on public.rv_pricing_plans
  for select using (public.is_admin());
create policy "pricing_admin_write" on public.rv_pricing_plans
  for all using (public.is_admin()) with check (public.is_admin());

create trigger trg_rv_pricing_plans_updated_at
  before update on public.rv_pricing_plans
  for each row execute function public.set_updated_at();

-- ── Seed dos 3 planos ───────────────────────────────────────
insert into public.rv_pricing_plans
  (key, name, tagline, price_monthly, price_annual, color, popular, cta_label, highlights, vehicle_limit, sort_order)
values
  ('essencial', 'Essencial', 'Para quem está começando a vender online',
   149, 119, '#64748b', false, 'Escolher Essencial',
   array['Até 15 veículos','Mini-loja pública','Catálogo com filtros','Gerador de WhatsApp','1 usuário'],
   15, 1),
  ('profissional', 'Profissional', 'O mais escolhido pelas garagens',
   297, 237, '#10b981', true, 'Escolher Profissional',
   array['Até 60 veículos','Tudo do Essencial','Selo "Abaixo da FIPE"','Destaque no marketplace','Leads ilimitados','Relatórios de desempenho','3 usuários'],
   60, 2),
  ('enterprise', 'Enterprise', 'Para redes e grandes operações',
   597, 477, '#8b5cf6', false, 'Falar com vendas',
   array['Veículos ilimitados','Tudo do Profissional','Domínio próprio','API e integrações','Multi-usuário','Gerente de conta dedicado'],
   null, 3)
on conflict (key) do nothing;

-- ── Vínculo do plano escolhido ao vendedor (gravado no cadastro) ──
alter table public.rv_sellers
  add column if not exists pricing_plan_key text references public.rv_pricing_plans(key);
