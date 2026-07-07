# Lightbox da galeria de fotos do veículo

**Data:** 2026-06-22
**Escopo:** Essencial (sem zoom/slideshow/fullscreen-nativo/grid)

## Problema

Na página pública de detalhes do veículo (`/veiculo/:id`), o banner mostra uma
faixa de até 3 fotos (`VehicleGallery`) com setas e contador, mas as imagens não
são clicáveis. O usuário quer que clicar numa foto abra um lightbox em tela cheia
para ver as fotos em tamanho grande, navegando entre todas, no estilo do
print de referência (garagenscar).

## Componente

`ImageLightbox` — novo arquivo `src/features/public/components/ImageLightbox.tsx`.

Interface (componente controlado pelo pai):

```ts
ImageLightbox({ images, index, onClose, onIndex }: {
  images: string[];
  index: number;        // índice atual
  onClose: () => void;
  onIndex: (i: number) => void;
})
```

Renderiza o overlay apenas quando montado pelo pai (pai controla abertura via
estado). Não tem estado próprio de "aberto/fechado".

## Integração — `VehicleGallery`

- Novo estado `lightbox: number | null` (índice real da foto, `null` = fechado).
- Cada `<img>` do banner recebe `onClick` que abre o lightbox no índice **real**
  correspondente: `(start + i) % total`. Cursor `zoom-in`.
- Renderiza `<ImageLightbox>` quando `lightbox !== null`.

## Comportamento (Essencial)

- Overlay `fixed inset-0 bg-black/90 z-50`.
- Imagem grande centralizada, `object-contain`, limitada à viewport.
- Setas ‹ › (Icon `chevronLeft`/`chevronRight`) com navegação circular.
- Contador `index+1 / total` no topo esquerdo.
- Botão fechar ✕ no topo direito.
- Tira de miniaturas embaixo; ativa destacada (borda brand); clique troca a
  imagem; a miniatura ativa faz `scrollIntoView`.
- Teclado: ← → navega, Esc fecha (listener em `window`, removido no unmount).
- Clique no backdrop (fora da imagem e das miniaturas) fecha.
- Trava o scroll do `body` enquanto aberto (restaura no unmount).
- A11y: `role="dialog"`, `aria-modal="true"`, `aria-label` nos botões.

Casos de borda: 1 foto → sem setas, miniaturas opcionais; 0 fotos → lightbox
nunca abre (banner já mostra "Sem fotos").

## Não-objetivos (YAGNI)

Zoom/pan, slideshow automático, fullscreen API nativa e visão em grade ficam
fora — podem ser adicionados depois se necessário.

## Dependências

Nenhuma nova. React + Tailwind + `Icon` existente.
