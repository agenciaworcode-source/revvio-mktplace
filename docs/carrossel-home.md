# Carrossel da home

Antes era uma imagem só (`rv_site_settings.home_banner_url`), sem texto nem
link. Agora são N slides, geridos pelo superadmin em **Aparência**.

## Modelo

`rv_home_slides` — um registro por slide:

| Coluna | Uso |
| --- | --- |
| `image_url` | Imagem de computador (1920 × 658, ~2,9:1) |
| `image_mobile_url` | Imagem de celular (1080 × 1350, 4:5) |
| `title`, `subtitle` | Texto sobre a imagem. Vazios = banner só de imagem |
| `cta_label` / `cta_url` | Botão 1 |
| `cta2_label` / `cta2_url` | Botão 2 |
| `sort_order` | Ordem no carrossel |
| `active` | `false` mantém o slide guardado sem publicar |

Comportamento em `rv_site_settings`: `carousel_autoplay`,
`carousel_interval_ms` (2s–30s, com CHECK), `carousel_show_arrows`,
`carousel_show_dots`.

## Regras de exibição

- Um botão só aparece quando **texto e link** estão preenchidos.
- Link começando com `http:`, `https:`, `mailto:` ou `tel:` abre em nova aba;
  qualquer outra coisa vira rota interna do app (`/comprar`, `/vender`…).
- Sem imagem de celular, a de computador vale para os dois tamanhos — no
  celular ela fica bem cortada nas laterais, porque a faixa é quase quadrada.
- O véu escuro sobre a imagem só entra quando há texto, para um banner
  puramente visual sair com a cor original.
- Setas e pontinhos somem com um slide só.
- O autoplay pausa no hover/foco e não roda para quem tem
  `prefers-reduced-motion: reduce` ligado no sistema.

## Fallback

Sem nenhum slide ativo, a home volta a exibir `home_banner_url` e, se ela
também estiver vazia, uma foto de banco de imagens. A migration `0051` cria o
primeiro slide a partir do banner que já estava publicado, então nada se perde
ao aplicar.

`useHomeBanner` / `useUpdateHomeBanner` (admin/queries.ts) ficaram sem uso —
eram a tela antiga de banner único. Dá para remover junto com a coluna
`home_banner_url` quando não fizer mais sentido manter o fallback.

## Onde está o código

- Público: `features/public/components/home/HomeCarousel.tsx`, montado por
  `HomeHero.tsx`; dados em `features/public/queries.ts` (`useHomeSlides`,
  `useSiteSettings`).
- Admin: `features/admin/pages/Aparencia.tsx`; CRUD em
  `features/admin/queries.ts`.
- Imagens vão para a pasta `home/` do bucket `banners` (policy criada na 0020).
  Trocar ou excluir uma imagem apaga a anterior do bucket.
