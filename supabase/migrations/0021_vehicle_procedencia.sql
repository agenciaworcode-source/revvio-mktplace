-- ============================================================
-- REVVIO · Procedência e histórico do veículo (página de detalhes)
-- Campos exibidos na seção "Procedência e Histórico" e preenchidos pelo
-- garagista no cadastro do veículo. Todos opcionais (anúncios antigos ficam null).
-- ============================================================

alter table public.rv_vehicles
  add column if not exists origem        text,     -- 'nacional' | 'importado'
  add column if not exists primeiro_dono boolean,  -- é o primeiro dono?
  add column if not exists documentacao  text,     -- ex.: 'Regular', 'Pendente'
  add column if not exists ipva          text,     -- ex.: 'Pago 2026', 'Em aberto'
  add column if not exists garantia      text,     -- ex.: 'Não possui', 'De fábrica'
  add column if not exists leilao        boolean;  -- passou por leilão?
