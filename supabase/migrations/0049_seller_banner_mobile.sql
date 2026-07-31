-- ============================================================
-- 0049_seller_banner_mobile.sql — banner responsivo da mini-loja
-- ============================================================
-- A mini-loja passa a ter dois banners: o já existente `banner_url`
-- (computador / telas largas) e o novo `banner_mobile_url` (celular,
-- proporção mais alta). A vitrine escolhe um dos dois por media query;
-- quando o vendedor sobe só um, ele é usado nos dois tamanhos.

alter table public.rv_sellers
  add column if not exists banner_mobile_url text;

comment on column public.rv_sellers.banner_url is
  'Banner da mini-loja exibido em computador / telas largas (~1600x312).';
comment on column public.rv_sellers.banner_mobile_url is
  'Banner da mini-loja exibido em celular (~1080x720). Fallback: banner_url.';
