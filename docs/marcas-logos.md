# Logos das marcas (`public/marcas/`)

Usadas no bloco "Marcas Mais Buscadas" da home (`HomeMarcas.tsx`).

As imagens originais eram PNGs de 60–86 px de largura, exibidas em até 110 px —
ou seja, upscale de 2–4× em telas retina, daí o aspecto pixelado. Foram trocadas
por SVG vetorial, que fica nítido em qualquer densidade de tela.

## Origem

Todas do Wikimedia Commons, baixadas do arquivo original em SVG. Nenhuma contém
`<text>` (as letras são contornos), então não dependem de fonte instalada, e
nenhuma contém `<image>` embutido — são vetor puro.

| Arquivo | Origem (Wikimedia Commons) |
| --- | --- |
| `carros/chevrolet.svg` | `Chevrolet-logo.svg` |
| `carros/fiat.svg` | `Fiat_logo.svg` |
| `carros/volkswagem.svg` | `Volkswagen_logo_2019.svg` |
| `carros/toyota.svg` | `Toyota_logo_(Red).svg` |
| `carros/honda.svg` | `Honda.svg` |
| `carros/hyundai.svg` | `Hyundai_Motor_Company_logo.svg` |
| `motos/honda.svg` | `Honda_Logo.svg` (asa) |
| `motos/yamaha.svg` | `Yamaha_Motor_logo.svg` |
| `motos/suzuki.svg` | `Suzuki_Motor_Corporation_logo.svg` |
| `motos/kawasaki.svg` | `Kawasaki-logo.svg` |
| `motos/bmwmotor.svg` | `Logo_BMW_Motorrad_2021.svg` |
| `motos/dafra.png` | **sem versão vetorial** — segue em PNG |

## Dafra

Não há SVG da Dafra em fonte livre (não está no Wikimedia Commons nem no Simple
Icons, e o site oficial não respondeu). Continua como PNG e é a única logo do
bloco que ainda pode aparecer levemente suave em tela retina. Para resolver,
peça o arquivo vetorial (SVG/AI/EPS) ao contato da marca ou a um designer e
troque a entrada em `HomeMarcas.tsx` para `dafra.svg`.

## Processamento aplicado

1. `viewBox` adicionado onde faltava (`chevrolet`, `suzuki`, `yamaha`). Sem
   `viewBox`, um SVG dentro de `<img>` não escala: o conteúdo fica em 1:1 e é
   cortado em vez de acompanhar o `max-height` do CSS.
2. Otimização com `svgo` (preset padrão, `removeViewBox` desligado). O conjunto
   saiu de ~66 KB para ~46 KB.

## Uso das marcas

São marcas registradas de terceiros, exibidas aqui apenas para identificar o
fabricante nos filtros de busca (uso nominativo). Não devem ser alteradas em cor
ou proporção, nem usadas de forma que sugira patrocínio ou parceria.
