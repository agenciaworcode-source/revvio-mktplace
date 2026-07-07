# Filtros na lista de veículos da plataforma (admin)

**Data:** 2026-06-22
**Escopo:** Somente o painel admin (`/dashboard/veiculos`, `Vehicles.tsx`).

## Problema

A tela "Veículos na Plataforma" lista o inventário consolidado de todas as
garagens sem nenhum filtro. Com muitos veículos fica difícil localizar. O
marketplace público já tem filtros; o painel admin não.

## Abordagem

Filtragem **client-side** sobre o array já carregado por `useAdminVehicles`
(dataset pequeno, uma query só). Nenhuma mudança no back-end.

## Filtros

- **Status** — select: Todos / Disponível / Reservado / Vendido (`vehicle_status`).
- **Marca** — select: Todas + marcas únicas presentes nos dados (ordenadas).
- **Garagista** — select: Todos + nomes de garagens únicos (ordenados).
- **Faixa de preço** — dois inputs numéricos (mín. e máx.).
- Botão **Limpar** — visível só quando há algum filtro ativo; reseta tudo.

## Comportamento

- Estado local `useState` por filtro; opções de marca/garagista e lista
  filtrada derivadas via `useMemo`.
- Contador do cabeçalho reflete o resultado: "Inventário consolidado · N
  veículos"; quando há filtro ativo mostra "N de TOTAL".
- **Exportação** passa a exportar as linhas filtradas.
- Empty state com filtro sem resultado: "Nenhum veículo corresponde aos filtros."
- Comparações de preço usam `Number(input)`; campos vazios são ignorados.

## UI

Selects/inputs nativos estilizados com Tailwind no tema claro da tela. Barra de
filtros em `flex flex-wrap` acima da tabela, dentro do `SectionCard`. Sem
dependência nova.

## Não-objetivos

Filtros por ano/km/combustível, persistência em URL, paginação. Ficam de fora
(YAGNI) — podem ser adicionados depois.
