# Logos das marcas (`public/marcas/`)

Usadas no bloco "Explore por marca" da home (`HomeMarcas.tsx`). O catálogo em si
— nome, arquivo e termo de busca de cada marca — fica em
`src/features/public/components/home/marcas.ts`.

As imagens originais eram PNGs de 60–86 px de largura, exibidas em até 110 px —
ou seja, upscale de 2–4× em telas retina, daí o aspecto pixelado. Foram trocadas
por SVG vetorial, que fica nítido em qualquer densidade de tela.

## Inventário

| Pasta | Com logo | Wordmark (sem logo) |
| --- | --- | --- |
| `carros/` | 38 | 5 |
| `eletricos/` | 9 | 4 |
| `motos/` | 19 | 2 |

`eletricos/` cobre as marcas cuja linha no Brasil é predominantemente elétrica
(BYD, Zeekr, Leapmotor, Tesla…). Marcas que vendem elétrico ao lado de
combustão — GWM, Renault, Volvo — continuam em `carros/`, para não aparecerem
duas vezes.

## Origem

Todas do Wikimedia Commons, baixadas do arquivo original em SVG. Para cada
marca há uma lista de nomes de arquivo candidatos; vale o primeiro que existir
no Commons como SVG de até 200 kB. Nenhuma contém `<text>`/`<tspan>` (as letras
são contornos), então não dependem de fonte instalada, e nenhuma contém
`<image>` embutido — são vetor puro. Isso é verificado no download.

Alguns arquivos não seguem o padrão `<Marca> logo.svg` e vale registrar:

| Arquivo | Origem (Wikimedia Commons) |
| --- | --- |
| `carros/audi.svg` | `Audi-Logo_2016.svg` |
| `carros/chevrolet.svg` | `Chevrolet-logo.svg` |
| `carros/citroen.svg` | `Citroen_2022.svg` |
| `carros/hyundai.svg` | `Hyundai_Motor_Company_logo.svg` |
| `carros/iveco.svg` | `Iveco_Logo_2023.svg` |
| `carros/jaecoo.svg` | `Jaecoo_wordmark.svg` |
| `carros/kia.svg` | `KIA_logo3.svg` |
| `carros/lexus.svg` | `Lexus_division_emblem.svg` |
| `carros/maserati.svg` | `Maserati_logo_2.svg` |
| `carros/mercedes-benz.svg` | `Mercedes-Benz_Star_2022.svg` |
| `carros/omoda.svg` | `Omoda_wordmark.svg` |
| `carros/renault.svg` | `Renault_2021_Text.svg` |
| `carros/toyota.svg` | `Toyota_logo_(Red).svg` |
| `carros/volkswagem.svg` | `Volkswagen_logo_2019.svg` |
| `eletricos/aion.svg` | `AION_Auto_UK_simple_logo.svg` |
| `eletricos/dongfeng.svg` | `Dongfeng_Motor_logo.svg` |
| `eletricos/leapmotor.svg` | `Leapmotor_logo_zh.svg` |
| `eletricos/livan.svg` | `Livan_Automotive_logo.svg` |
| `eletricos/polestar.svg` | `Polestar_logo_2020.svg` |
| `eletricos/tesla.svg` | `Tesla_Motors.svg` |
| `motos/bmwmotor.svg` | `Logo_BMW_Motorrad_2021.svg` |
| `motos/haojue.svg` | `Haojue_Holdings_logo.svg` |
| `motos/triumph.svg` | `Triumph_Motorcycles_logo_and_claim_2015.svg` |
| `motos/voltz.svg` | `Webysther_20220120_-_Voltz_Motors_Logo.svg` |

## Marcas sem logo (wordmark)

O Commons não hospeda logo utilizável destas — são trademark protegida e o
projeto rejeita o upload. Ficam sem `arquivo` em `marcas.ts` e o `HomeMarcas`
tipografa o nome no lugar da imagem:

`Aston Martin`, `Bentley`, `Ferrari`, `JAC`, `Troller` (carros) ·
`Denza`, `Lotus`, `Neta`, `Seres` (elétricos) · `KTM`, `Shineray` (motos)

**Não preencha estas por busca automática.** A busca do Commons devolve
homônimos com muita facilidade — a primeira tentativa trouxe o logo do filme
*Trolls* para a Troller, o do parque *Ferrari World Abu Dhabi* para a Ferrari,
o da universidade *Bentley* (NCAA) para a Bentley e o da ferrovia malaia *KTM*
para a KTM. Logo errado é pior do que wordmark. Para resolver de verdade, peça
o arquivo vetorial (SVG/AI/EPS) ao contato da marca ou a um designer e adicione
o `arquivo` em `marcas.ts`.

O mesmo vale para a Dafra, que segue em PNG (`motos/dafra.png`) — é a única
logo do bloco que ainda pode aparecer levemente suave em tela retina.

## Processamento aplicado

1. `viewBox` adicionado onde faltava. Sem `viewBox`, um SVG dentro de `<img>`
   não escala: o conteúdo fica em 1:1 e é cortado em vez de acompanhar o
   `max-height` do CSS.
2. Otimização com `svgo --multipass`.

> **Cuidado ao rodar o `svgo` de novo:** o preset padrão tem
> `removeViewBox: true` e apaga o `viewBox` de todo arquivo em que ele seja
> redundante com `width`/`height` — quebrando exatamente o passo 1. Rode sempre
> com `removeViewBox` desligado. Se acontecer, dá para restaurar sem perda,
> porque o atributo removido era sempre `0 0 <width> <height>`.

## Uso das marcas

São marcas registradas de terceiros, exibidas aqui apenas para identificar o
fabricante nos filtros de busca (uso nominativo). Não devem ser alteradas em cor
ou proporção, nem usadas de forma que sugira patrocínio ou parceria.
