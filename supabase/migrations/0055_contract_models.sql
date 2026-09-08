-- ============================================================
-- 0055_contract_models.sql — catálogo de modelos de contrato
-- ============================================================
-- Os modelos padrão viviam no código (`src/features/contracts/templates.ts`):
-- o superadmin emitia os três e o garagista ficava travado no de compra e
-- venda. Acrescentar ou tirar um modelo exigia deploy.
--
-- Agora o catálogo é dado: o superadmin cria, edita, ativa/desativa e exclui
-- modelos pelo painel, e decide para quem cada um aparece (`audience`).
-- `contract_type` continua sendo a natureza jurídica do documento — é o que
-- define os rótulos das partes, a validação do formulário, o cálculo da
-- comissão e a diagramação da folha; vários modelos podem compartilhá-la.

create table if not exists public.rv_contract_models (
  id    uuid primary key default gen_random_uuid(),
  -- Só os três modelos que vieram do código têm slug. Serve de âncora: o
  -- seed é idempotente e o molde da loja sabe qual modelo ele sobrescreve.
  slug  text unique,
  name  text not null,
  contract_type public.contract_type not null,
  -- quem pode emitir um documento com este modelo
  audience text not null default 'garagista'
    check (audience in ('admin', 'garagista', 'ambos')),
  -- texto com as tags [campo], igual ao editor de cláusulas
  body   text not null default '',
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.rv_contract_models is
  'Modelos padrão de contrato oferecidos nos painéis. Mantido pelo superadmin.';
comment on column public.rv_contract_models.audience is
  'Painéis em que o modelo aparece: admin (só Revvio), garagista (só lojas) ou ambos.';
comment on column public.rv_contract_models.contract_type is
  'Natureza do documento: define rótulos das partes, validação, comissão e diagramação.';

create index if not exists idx_rv_contract_models_listagem
  on public.rv_contract_models (audience, active, sort_order);

drop trigger if exists trg_rv_contract_models_updated_at on public.rv_contract_models;
create trigger trg_rv_contract_models_updated_at
  before update on public.rv_contract_models
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
alter table public.rv_contract_models enable row level security;

-- O catálogo é da Revvio: só o superadmin mexe.
drop policy if exists "rv_contract_models_admin_all" on public.rv_contract_models;
create policy "rv_contract_models_admin_all" on public.rv_contract_models
  for all using (public.is_admin()) with check (public.is_admin());

-- A loja lê o que pode emitir. Modelo desativado ou exclusivo do admin não
-- chega ao painel do garagista nem pela API.
drop policy if exists "rv_contract_models_painel_read" on public.rv_contract_models;
create policy "rv_contract_models_painel_read" on public.rv_contract_models
  for select to authenticated
  using (active and audience in ('garagista', 'ambos'));

-- ── Carga inicial: os três modelos que estavam no código ────
-- Cópia fiel de templates.ts (as constantes da intermediadora já resolvidas).
-- Daqui para frente o texto vivo é o do banco; o do código fica só como
-- reserva para o caso de o catálogo estar vazio ou fora do ar.
insert into public.rv_contract_models
  (slug, name, contract_type, audience, sort_order, body)
values (
  'intermediacao',
  'Contrato de Intermediação de Venda de Veículo Automotor',
  'intermediacao',
  'admin',
  10,
  $tpl$CONTRATO DE INTERMEDIAÇÃO DE VENDA DE VEÍCULO AUTOMOTOR - REVVIO LTDA

Pelo presente instrumento particular, de um lado:

PROPRIETÁRIO / VENDEDOR:
Nome: [vendedor_name]
CPF: [vendedor_cpf_cnpj]
Endereço: [vendedor_address]

E, de outro lado:

INTERMEDIADORA:
REVVIO LTDA
CNPJ: 63.340.233/0001-53
Endereço: AV. IPIRANGA, 207 - CENTRO - MARÍLIA/SP

As partes têm entre si justo e contratado o que segue:

CLÁUSULA 1 - DO OBJETO
O presente contrato tem por objeto a intermediação da venda do veículo automotor de propriedade do VENDEDOR, não havendo, em nenhuma hipótese, a compra do veículo pela INTERMEDIADORA.

CLÁUSULA 2 - IDENTIFICAÇÃO DO VEÍCULO
Marca/Modelo: [vehicle_brand_model]
Ano/Modelo: [vehicle_year_model]
Placa: [vehicle_plate]
RENAVAM: [vehicle_renavam]

CLÁUSULA 3 - NATUREZA DA INTERMEDIAÇÃO
A INTERMEDIADORA atuará exclusivamente como intermediadora entre VENDEDOR e COMPRADOR, não se responsabilizando por:
I - pagamento do preço do veículo;
II - vícios ocultos ou aparentes;
III - inadimplência do comprador;
IV - problemas mecânicos, estruturais ou históricos do veículo.

CLÁUSULA 4 - DECLARAÇÕES DO VENDEDOR
O VENDEDOR declara, sob as penas da lei, que:
I - é legítimo proprietário do veículo;
II - o veículo está livre de quaisquer ônus, restrições judiciais ou administrativas, salvo se expressamente informado;
III - todas as informações prestadas são verdadeiras;
IV - assume integral responsabilidade civil, criminal e administrativa por informações falsas.

CLÁUSULA 5 - COMISSÃO DA INTERMEDIAÇÃO
Pela intermediação realizada, a INTERMEDIADORA fará jus à comissão de [commission_value], equivalente a 4% sobre o valor total da venda de [sale_value]. A comissão será devida no momento da assinatura do documento de transferência, independentemente do recebimento integral do valor pelo VENDEDOR.

CLÁUSULA 6 - EXCLUSIVIDADE
O presente contrato é firmado sob regime de exclusividade/sem exclusividade conforme acordado previamente pelas partes. Em caso de venda realizada sem a participação da INTERMEDIADORA durante o prazo de exclusividade, a comissão será integralmente devida.

CLÁUSULA 7 - PAGAMENTOS
A INTERMEDIADORA não receberá valores referentes ao preço do veículo, sendo o pagamento realizado diretamente entre VENDEDOR e COMPRADOR.

CLÁUSULA 8 - ISENÇÃO DE RESPONSABILIDADE
A INTERMEDIADORA não responderá por:
I - multas, tributos ou encargos anteriores ou posteriores à venda;
II - atrasos na transferência;
III - sinistros, defeitos ou vícios ocultos;
IV - litígios entre VENDEDOR e COMPRADOR.

CLÁUSULA 9 - MULTA POR DESCUMPRIMENTO
O descumprimento de quaisquer cláusulas implicará multa equivalente a 100% do valor da comissão, sem prejuízo de perdas e danos.

CLÁUSULA 10 - VIGÊNCIA
O presente contrato entra em vigor na data de sua assinatura e permanece válido até a conclusão da venda ou rescisão formal por escrito.

CLÁUSULA 11 - FORO
Fica eleito o foro da comarca de Marília/SP, com renúncia de qualquer outro, por mais privilegiado que seja.

E, por estarem justas e contratadas, as partes assinam o presente instrumento em duas vias de igual teor.

Local e data: Marília, [data_atual]

____________________________________
VENDEDOR: [vendedor_name]

____________________________________
INTERMEDIADORA: REVVIO LTDA$tpl$
)
on conflict (slug) do nothing;

insert into public.rv_contract_models
  (slug, name, contract_type, audience, sort_order, body)
values (
  'compra_venda',
  'Contrato de Compra e Venda de Veículo',
  'compra_venda',
  'ambos',
  20,
  $tpl$CONTRATO DE COMPRA E VENDA DE VEÍCULO

Pelo presente instrumento particular, as partes abaixo identificadas:

VENDEDOR: [vendedor_name], CPF: [vendedor_cpf_cnpj], residente e domiciliado em [vendedor_address].

COMPRADOR: [comprador_name], CPF: [comprador_cpf_cnpj], residente e domiciliado em [comprador_address].

OBJETO: Venda do veículo marca/modelo [vehicle_brand_model], placa [vehicle_plate], ano [vehicle_year_model], RENAVAM [vehicle_renavam].

CLÁUSULA 1 - O vendedor declara ser legítimo proprietário do veículo e que este encontra-se livre de ônus, multas e débitos, salvo os expressamente informados neste contrato.

CLÁUSULA 2 - O valor total da venda é de [sale_value], pago na data de assinatura deste contrato.

CLÁUSULA 3 - O comprador se compromete a realizar a transferência do veículo junto ao Detran no prazo legal de 30 (trinta) dias.

CLÁUSULA 4 - Após a assinatura, a posse do veículo é transferida ao comprador, bem como todas as responsabilidades sobre multas, acidentes e demais encargos.

E por estarem assim justos e contratados, assinam o presente instrumento em duas vias de igual teor.

Local e data: Marília, [data_atual]

____________________________________
Assinatura do Vendedor: [vendedor_name]

____________________________________
Assinatura do Comprador: [comprador_name]$tpl$
)
on conflict (slug) do nothing;

insert into public.rv_contract_models
  (slug, name, contract_type, audience, sort_order, body)
values (
  'procuracao',
  'Procuração de Veículo',
  'procuracao',
  'admin',
  30,
  $tpl$PROCURAÇÃO PARA FINS DE TRÂMITE VEICULAR

OUTORGANTE: [vendedor_name], inscrito(a) no CPF/CNPJ sob o nº [vendedor_cpf_cnpj], residente e domiciliado(a) em [vendedor_address].

OUTORGADO: [comprador_name], inscrito(a) no CPF/CNPJ sob o nº [comprador_cpf_cnpj], residente e domiciliado(a) em [comprador_address].

VEÍCULO: [vehicle_brand_model], ano/modelo [vehicle_year_model], placa [vehicle_plate], RENAVAM [vehicle_renavam].

PODERES: Pelo presente instrumento particular, o OUTORGANTE nomeia e constitui o OUTORGADO seu bastante procurador, conferindo-lhe poderes específicos, exclusivamente quanto ao veículo acima identificado, para: representá-lo perante o DETRAN, CIRETRAN e demais órgãos executivos de trânsito; requerer, assinar e retirar documentos do veículo, incluindo CRV, CRLV e segundas vias; promover a transferência de propriedade, assinando o documento único de transferência (ATPV-e) e reconhecendo firmas quando exigido; quitar débitos, multas, taxas, IPVA, licenciamento e demais encargos; solicitar baixa de restrições, emissão de certidões e vistorias; e substabelecer, no todo ou em parte, quando indispensável ao cumprimento do mandato.

Os poderes são outorgados em caráter específico para os fins acima, vedada a utilização para qualquer outra finalidade. Validade de 90 (noventa) dias a contar da assinatura, salvo revogação expressa anterior.

Local e data: Marília, [data_atual]

____________________________________
OUTORGANTE: [vendedor_name]
CPF/CNPJ: [vendedor_cpf_cnpj]$tpl$
)
on conflict (slug) do nothing;

notify pgrst, 'reload schema';
