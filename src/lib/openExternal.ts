/**
 * Abre um link externo (WhatsApp, Instagram) driblando o bloqueador de pop-ups.
 *
 * `window.open` só é liberado enquanto o gesto do usuário está "ativo". Quando
 * a abertura acontece depois de um `await` — o caso do comprador que acabou de
 * criar a conta e deveria seguir direto para o WhatsApp — o navegador bloqueia
 * em silêncio (o Safari do iPhone sempre; os demais, se a rede demorar). Para o
 * usuário parecia que o botão não fez nada, e ele repetia o fluxo.
 *
 * Fora do clique direto, navegamos a própria aba: no celular o app do WhatsApp
 * intercepta a URL e a página continua onde estava.
 */
export function openExternal(url: string, fromUserGesture: boolean): void {
  if (fromUserGesture && window.open(url, "_blank", "noopener")) return;
  window.location.href = url;
}
