/**
 * Dispara a impressão da folha de contrato.
 *
 * Precisa ser chamado DENTRO do handler do clique, de forma síncrona: o Safari
 * do iPhone só executa `window.print()` enquanto a ativação do usuário está
 * viva. Adiar para um `requestAnimationFrame`/`setTimeout` faz o iOS ignorar a
 * chamada em silêncio — no Chrome (desktop e Android) funciona mesmo adiado,
 * que era por isso que o bug só aparecia no iPhone.
 */
const BODY_CLASS = "printing-contract";

export function printContractSheet(): void {
  const body = document.body;
  body.classList.add(BODY_CLASS);

  let limpo = false;
  const limpar = () => {
    if (limpo) return;
    limpo = true;
    body.classList.remove(BODY_CLASS);
    window.removeEventListener("afterprint", limpar);
  };

  // O iOS não dispara `afterprint` de forma confiável, então há um timeout de
  // segurança para a classe não ficar presa no <body> (o que deixaria o painel
  // escondido numa impressão seguinte).
  window.addEventListener("afterprint", limpar);
  window.setTimeout(limpar, 60_000);

  window.print();
}
