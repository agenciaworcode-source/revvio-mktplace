-- ============================================================
-- 0052_vehicle_hide_fipe.sql — ocultar a FIPE no anúncio público
-- ============================================================
-- Alguns lojistas não querem expor a referência FIPE do carro na vitrine
-- (o preço de tabela pode atrapalhar a negociação). A flag é por veículo:
-- quando ligada, o catálogo público deixa de mostrar o valor FIPE, o selo
-- "-X% FIPE" e o filtro "Abaixo da FIPE" ignora o anúncio.
-- O valor continua gravado em fipe_price e visível nos painéis internos.

alter table public.rv_vehicles
  add column if not exists hide_fipe boolean not null default false;

comment on column public.rv_vehicles.hide_fipe is
  'Quando true, a FIPE (valor, selo de desconto e filtro) não aparece no anúncio público. O valor em fipe_price continua registrado para uso interno.';
