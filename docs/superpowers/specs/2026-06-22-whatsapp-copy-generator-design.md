# Gerador de Copy WhatsApp (painel do garagista)

**Data:** 2026-06-22
**Acesso:** somente garagista (`isGaragista || isAdmin`).

## Problema

O garagista precisa montar anúncios de WhatsApp padronizados a partir dos
veículos cadastrados. Hoje faz na mão. A funcionalidade gera um texto dinâmico,
editável, a partir dos dados do veículo selecionado.

## Decisões (brainstorming)

- Campos do modelo que não existem no cadastro (Pneus, Chave, Parte Mecânica,
  Ar-condicionado, Gastos) são **omitidos** — o garagista digita à mão se quiser.
- Botão visível **só para garagista** (manager).

## Arquivos

- `src/lib/whatsappCopy.ts` — função pura `buildWhatsappCopy(vehicle, sellerName)`
  que retorna o texto. Testável isoladamente.
- `src/features/seller/pages/WhatsappGenerator.tsx` — página (dropdown + textarea
  editável + botão copiar). Redireciona para `/painel` se não for manager.
- `src/features/seller/PainelLayout.tsx` — novo item de menu (bloco `manager`):
  `{ to: "/painel/gerador-whatsapp", label: "Gerador WhatsApp", icon: "whatsapp" }`.
- `src/App.tsx` — rota aninhada `gerador-whatsapp` sob `/painel`.

## Dados

Dropdown alimentado por `useVehicles(lojaId)` (mesma fonte da tela Veículos — o
estoque da garagem). Label de cada opção: `{make} {model} - {year}`.

## Fluxo

Selecionar veículo → `buildWhatsappCopy` gera o texto → vai para um `<textarea>`
controlado (totalmente editável). Botão "Copiar texto" usa `navigator.clipboard`
com feedback "Copiado!".

## Template (cada linha só aparece se o campo existir)

```
🚀 {NOME DA GARAGEM} 🚀

🚗 {marca} {modelo}
- - - - - - - - - - - - - - - - - - -
📅 ANO/MOD: {ano}
🕧 KM: {km formatado}
⛽ COMBUSTÍVEL: {fuelLabels}
🕹️ CÂMBIO: {transmissionLabels}
🎨 COR: {cor}
🚘 CARROCERIA: {bodyLabels}
🛡️ BLINDADO: Sim            (só se armored)
🧾 DOCUMENTAÇÃO: {documentacao}
✅ IPVA: {ipva}
🌎 ORIGEM: {origem}
👤 PRIMEIRO DONO: Sim/Não    (só se primeiro_dono != null)
🔨 LEILÃO: Sim/Não           (só se leilao != null)
🛡️ GARANTIA: {garantia}
- - - - - - - - - - - - - - - - - - -
✅ OPCIONAIS: {options.join(", ")}    (só se houver)
📝 OBSERVAÇÕES: {description}          (só se houver)
▃▃▃▃▃▃▃▃▃▃▃▃▃▃
📈 FIPE: {R$ fipe_price}              (só se houver)
📉 POR: {R$ price}
🔥🔥🔥🔥🔥🔥🔥🔥🔥
🚨 CHAMA NA PROPOSTA 🚨
▃▃▃▃▃▃▃▃▃▃▃▃▃▃
```

Labels de combustível/câmbio/carroceria via `vehicleLabels.ts`. Moeda via
`formatCurrency`, KM via `formatNumber`.

## UI

Tema claro do painel, componentes existentes (`Select`/`Textarea`/`Button` do
ui-light). Sem dependência nova.

## Não-objetivos

Persistência de templates customizados, envio direto pelo WhatsApp, campos
manuais salvos (pneus/mecânica). YAGNI.
