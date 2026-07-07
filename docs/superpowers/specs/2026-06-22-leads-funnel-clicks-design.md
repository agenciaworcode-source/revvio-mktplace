# Leads: captura, funil kanban e ranking de cliques

**Data:** 2026-06-22
**Acesso:** garagista (e equipe, leitura) + superadmin.

## Problema

O formulário "Quero ver o carro" abre o WhatsApp mas não persiste nada. O
garagista não tem onde ver/gerenciar os interessados nem saber quais anúncios
atraem mais cliques. Esta feature cria a captura, o gerenciamento (cards +
funil kanban) e um ranking de anúncios mais clicados, com visão para o
superadmin filtrável por garagista.

## Decisões (brainstorming)

- Campo **Cidade** obrigatório no formulário do lead (alimenta o filtro).
- Funil padrão: **Novo → Em contato → Negociando → Ganho / Perdido**.
- Feature completa num spec (fundação + cards + kanban DnD + admin).

## 1. Banco (`supabase/migrations/0028_leads.sql`)

Enum:
```sql
create type lead_stage as enum ('novo','em_contato','negociando','ganho','perdido');
```

Tabela `rv_leads`:
- `id uuid pk default gen_random_uuid()`
- `seller_id uuid not null references rv_sellers(id) on delete cascade` — a loja/garagista dona do veículo (raiz da garagem).
- `vehicle_id bigint references rv_vehicles(id) on delete set null`
- `name text not null`, `phone text`, `email text`, `city text`, `message text`
- `financing boolean not null default false`
- `stage lead_stage not null default 'novo'`
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- índices: `seller_id`, `stage`, `created_at`
- trigger `set_updated_at`

Tracking de cliques:
- `alter table rv_vehicles add column clicks int not null default 0;`
- RPC `increment_vehicle_clicks(p_id bigint)` — `security definer`, `set search_path=public`, `update rv_vehicles set clicks = clicks + 1 where id = p_id`. `grant execute` para `anon, authenticated`.

RLS `rv_leads`:
- INSERT: liberado para `anon` e `authenticated` (captura pública). Política `with check (true)`.
- SELECT/UPDATE/DELETE: só admin (`is_admin()`) ou dono da loja. Dono = lead cujo `seller_id` é a loja do usuário atual ou descende dela (reusar helper de hierarquia existente, ex.: a mesma lógica de `rv_vehicles`/equipe). Atualização permite mudar `stage`.

## 2. Captura (público)

- `LeadForm` (VehicleDetails): novo campo **Cidade** (obrigatório, entra na
  validação existente). Ao enviar e validar → `useCreateLead` faz INSERT em
  `rv_leads` (`seller_id = v.seller.id`, `vehicle_id = v.id`, demais campos,
  `stage='novo'`) e em seguida abre o WhatsApp como hoje. Falha no insert não
  bloqueia abrir o WhatsApp (captura é best-effort; loga erro).
- `VehicleDetails`: no mount, chama `useTrackVehicleClick(id)` → RPC
  `increment_vehicle_clicks` uma vez por carregamento.

## 3. Tela do garagista (`/painel/leads`)

Item de menu novo (bloco `manager` no `PainelLayout`).

- **Topo "Anúncios mais clicados"**: top 5 veículos da loja por `clicks`
  (`useTopClicked(lojaId)`): foto, `make model`, nº de cliques, link
  "Ver anúncio" → `/veiculo/:id`.
- **Filtros** (`LeadFilters`): busca (nome/telefone/cidade/e-mail), faixa de
  datas (de/até), select de cidade (cidades distintas dos leads).
- **Toggle de visão**:
  - **Cards** (`LeadCard`): nome, e-mail, data formatada, telefone, cidade,
    veículo de interesse, botão **WhatsApp** (ativo só com telefone, usa
    `whatsappLink`).
  - **Kanban** (`LeadKanban`): 5 colunas por `stage`, drag-and-drop com
    `@dnd-kit`; ao soltar numa coluna chama `useUpdateLeadStage` (update
    otimista + persistência).
- **Exportar CSV** dos leads filtrados (reusa padrão `AdminActions`/util CSV).

## 4. Visão do superadmin (`/dashboard/leads`)

Página no admin (item de menu no `AdminLayout`). Mesmos componentes
compartilhados. Filtro adicional **por garagista** (select de lojas); sem loja
selecionada, mostra todos os leads. "Anúncios mais clicados" respeita a loja
selecionada (ou geral).

## 5. Código

- `supabase/migrations/0028_leads.sql`
- `src/features/leads/` — `queries.ts` (`useLeads`, `useCreateLead`,
  `useUpdateLeadStage`, `useTopClicked`, `useTrackVehicleClick`), componentes
  `LeadCard.tsx`, `LeadKanban.tsx`, `LeadFilters.tsx`, `TopClickedCards.tsx`,
  `leadStages.ts` (labels/cores/ordem das colunas), `csv.ts` se necessário.
- `src/features/seller/pages/Leads.tsx`, `src/features/admin/pages/Leads.tsx`.
- Edits: `LeadForm`/`VehicleDetails` (cidade + insert + track), `queries.ts`
  público (campo phone já incluído), `PainelLayout`, `AdminLayout`, `App.tsx`,
  `database.types`.
- Dependências novas: `@dnd-kit/core`, `@dnd-kit/sortable`.

## Estágios (`leadStages.ts`)

| stage | label | cor |
|-------|-------|-----|
| novo | Novo | azul |
| em_contato | Em contato | âmbar |
| negociando | Negociando | roxo |
| ganho | Ganho | verde |
| perdido | Perdido | vermelho |

## Tratamento de erros

- Insert de lead falho: console.error + segue abrindo WhatsApp (não trava o
  interessado).
- RPC de clique falho: silencioso (não afeta a navegação).
- Update de stage falho: reverte o card para a coluna anterior + Alert.

## Não-objetivos (YAGNI)

Atribuir lead a vendedor, notas/histórico por lead, automação de e-mail,
métricas de clique avançadas (únicos/origem/UTM), paginação de leads.
