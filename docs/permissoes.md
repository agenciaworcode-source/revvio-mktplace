# Permissões de acesso ao painel

Duas camadas independentes. Um item do painel só aparece quando **as duas**
liberam.

```
Plano da loja (superadmin)  →  módulos disponíveis para a loja inteira
        ↓
Permissões da equipe (garagista)  →  o que os vendedores fazem dentro deles
```

## 1. Módulos por plano — quem define: superadmin

`Controle de Planos → editar plano → Módulos do painel`.
Colunas em `rv_pricing_plans`: `leads_enabled`, `financeiro_enabled`,
`whatsapp_enabled`, `equipe_enabled` e o `affiliates_enabled` que já existia.
Todas com default `true`, então os planos que já estão cadastrados continuam
com tudo liberado.

Vale para a loja inteira, garagista incluído. É um gate **comercial**, aplicado
no painel (`PainelLayout.tsx` e o guard `Permitido` em `App.tsx`) — não na RLS.
O admin da plataforma não é limitado por plano.

## 2. Permissões da equipe — quem define: garagista

`Configurações da Loja → aba Permissões da equipe`.
Colunas `vend_*` na linha da **própria loja** em `rv_sellers` — a regra vale
para todos os vendedores da loja, não é por pessoa.

| Coluna | Default | O que muda |
| --- | --- | --- |
| `vend_add_veiculo` | `true` | Cadastrar veículo |
| `vend_editar_veiculo` | `false` | Editar qualquer veículo da loja |
| `vend_excluir_veiculo` | `false` | Remover veículo das listagens |
| `vend_ver_todas_vendas` | `false` | Ver as vendas da loja (não só as próprias) |
| `vend_ver_financeiro` | `false` | Abrir o Financeiro da loja (leitura) |
| `vend_ver_leads` | `false` | Abrir a aba Leads |
| `vend_gerador_whatsapp` | `false` | Abrir o Gerador de WhatsApp |

**Os defaults reproduzem exatamente o comportamento anterior à 0050** — aplicar
a migration não muda o acesso de ninguém.

O vendedor sempre vê as próprias vendas e a própria comissão, independente das
permissões: isso vem das cláusulas `vendedor_id = current_person()` nas policies.

## Onde é aplicado

- **Banco (a que vale):** policies reescritas na `0050` para `rv_leads`,
  `rv_vehicles`, `rv_sales` e `rv_commissions`, via o helper
  `public.vendedor_pode(text)` (SECURITY DEFINER).
- **Painel:** `useAcesso()` (`src/features/auth/acesso.ts`) chama a RPC
  `public.meu_acesso()`, que devolve papel + permissões + módulos numa
  requisição só. Menu, guards de rota e botões consomem esse hook.

Antes da 0050 o menu escondia a aba mas a RLS deixava passar — um vendedor
conseguia ler os leads e as vendas da loja chamando a API direto. Isso foi
corrigido junto.

## Escalonamento de privilégio

- O vendedor não consegue atualizar a linha da loja (só a própria), então não
  alcança as colunas `vend_*`.
- O trigger `protect_seller_columns` recusa qualquer mudança nas `vend_*` que
  não venha do gestor da própria loja, mesmo se alguma policy afrouxar no futuro.
- `vendedor_pode()` devolve `false` para quem não é vendedor; garagista e admin
  passam pelas cláusulas `is_loja_manager()` / `is_admin()` das policies.

## O que testar depois de aplicar

Com uma conta de garagista e uma de vendedor da mesma loja:

1. Vendedor com tudo desmarcado: menu só com Dashboard, Veículos e Vendas;
   `/painel/leads` e `/painel/financeiro` digitados na URL redirecionam.
2. Marcar "Acessar Leads" → a aba aparece para o vendedor no próximo
   carregamento e a leitura de `rv_leads` passa a funcionar.
3. Desmarcar "Cadastrar veículo" → some o botão "+ Novo veículo" **e** um
   `insert` direto em `rv_vehicles` pelo cliente falha por RLS.
4. Desligar um módulo no plano da loja → a aba some para o garagista também, e
   o toggle correspondente aparece travado na aba de permissões.
