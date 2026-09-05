-- ============================================================
-- 0053_pricing_plan_free.sql — plano gratuito controlado pelo admin
-- ============================================================
-- Até aqui todo cadastro de garagista passava pelo ASAAS. Um plano com preço
-- zerado não era "grátis": o ASAAS recusa assinatura sem valor ("O parâmetro
-- value deve ser informado") e o erro estourava na cara do lojista no fim do
-- checkout, como se o formulário dele estivesse errado.
--
-- A gratuidade agora é uma decisão explícita do super admin (`is_free`), não
-- um efeito colateral de digitar 0 no preço. Com a flag ligada o cadastro
-- pula o ASAAS e libera a conta na hora; ligar/desligar é o `active` de sempre.
--
-- O CHECK impede as duas configurações que quebram o checkout:
--   - plano pago com preço <= 0 (o acidente que gerou o bug);
--   - plano grátis com preço > 0 (cobraria sem gerar cobrança).

alter table public.rv_pricing_plans
  add column if not exists is_free boolean not null default false;

comment on column public.rv_pricing_plans.is_free is
  'Quando true, o cadastro do garagista não gera cobrança no ASAAS: a conta é criada e ativada na hora. Exige price_monthly e price_annual iguais a zero.';

-- Planos já existentes são todos pagos; só normaliza quem estiver zerado por
-- engano, para o CHECK abaixo poder entrar sem quebrar dado legado.
update public.rv_pricing_plans
   set is_free = true
 where price_monthly <= 0 and price_annual <= 0;

alter table public.rv_pricing_plans
  drop constraint if exists rv_pricing_plans_free_price_ck;

alter table public.rv_pricing_plans
  add constraint rv_pricing_plans_free_price_ck check (
    case when is_free
      then price_monthly = 0 and price_annual = 0
      else price_monthly > 0 and price_annual > 0
    end
  );
