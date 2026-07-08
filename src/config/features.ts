/**
 * Feature flags globais do sistema.
 *
 * AFFILIATES_ENABLED: quando `false`, todo o módulo de afiliados fica
 * desativado em toda a aplicação — rotas (/afiliado, /painel/afiliados,
 * /dashboard/afiliados), itens de menu, seletor de afiliado na venda,
 * sugestão por link (?ref=) e o toggle de plano. Nenhum arquivo do módulo
 * foi removido: para reativar, basta voltar este valor para `true`.
 */
export const AFFILIATES_ENABLED = false;
