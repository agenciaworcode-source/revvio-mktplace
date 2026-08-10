import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicShell } from "../PublicShell";
import { Seo } from "@/components/Seo";
import { Spinner } from "@/components/ui";
import { Icon } from "../components/icons";
import {
  Breadcrumb,
  FipeAviso,
  FipeContainer,
  HistoricoChart,
} from "../components/fipe";
import {
  acharPorSlug,
  fipeUrl,
  historicoDisponivel,
  useAnos,
  useHistorico,
  useMarcas,
  useModelos,
  useValor,
  useVersoesDoAno,
} from "../fipeQueries";

/* ============================================================
   /tabela-fipe/:marca/:modelo/:ano — preço, versões e histórico
   ============================================================ */

const moeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

/** "junho de 2026" -> "Junho de 2026". */
const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function TabelaFipeValor() {
  const { marca: slugMarca, modelo: slugModelo, ano: slugAno } = useParams();

  const marcas = useMarcas();
  const marca = acharPorSlug(marcas.data, slugMarca);
  const modelos = useModelos(marca?.codigo);
  const modelo = acharPorSlug(modelos.data, slugModelo);
  const anos = useAnos(marca?.codigo, modelo?.codigo);
  const ano = acharPorSlug(anos.data, slugAno);

  const valor = useValor(marca?.codigo, modelo?.codigo, ano?.codigo);
  const versoes = useVersoesDoAno(
    marca?.codigo,
    modelos.data,
    modelo,
    ano?.ano,
    ano?.combustivel
  );
  const historico = useHistorico(marca?.codigo, modelo?.codigo, ano?.codigo);

  /** Variação mês a mês, do mais recente para o mais antigo (ordem da tabela). */
  const linhasHistorico = useMemo(() => {
    const pontos = historico.data ?? [];
    return pontos
      .map((p, i) => ({
        ...p,
        variacao: i === 0 ? null : (p.preco - pontos[i - 1].preco) / pontos[i - 1].preco,
      }))
      .reverse();
  }, [historico.data]);

  const resolvendo =
    marcas.isLoading || (!!marca && modelos.isLoading) || (!!modelo && anos.isLoading);

  const titulo = [marca?.nome, modelo?.nome, ano?.label].filter(Boolean).join(" ");

  return (
    <PublicShell>
      <Seo
        title={`Tabela FIPE ${titulo}`}
        description={`Valor do ${titulo} na tabela FIPE${
          valor.data ? `: ${valor.data.valorLabel} (${valor.data.mesReferencia})` : ""
        }. Veja o código FIPE, as demais versões do mesmo ano e ofertas na Revvio.`}
        path={
          slugMarca && slugModelo && slugAno
            ? fipeUrl.valor(slugMarca, slugModelo, slugAno)
            : undefined
        }
      />

      <FipeContainer>
        <Breadcrumb
          itens={[
            { label: "Início", to: "/" },
            { label: "Tabela FIPE", to: fipeUrl.raiz },
            {
              label: marca?.nome ?? "Marca",
              to: marca ? fipeUrl.marca(marca.slug) : undefined,
            },
            {
              label: modelo?.nome ?? "Modelo",
              to: marca && modelo ? fipeUrl.modelo(marca.slug, modelo.slug) : undefined,
            },
            { label: ano?.label ?? "Ano" },
          ]}
        />

        {resolvendo ? (
          <div className="flex justify-center py-24 text-slate-400">
            <Spinner />
          </div>
        ) : !marca || !modelo || !ano ? (
          <FipeAviso
            titulo="Consulta não encontrada"
            descricao="O endereço aponta para uma combinação de marca, modelo e ano que não existe na tabela FIPE de carros."
            to={marca && modelo ? fipeUrl.modelo(marca.slug, modelo.slug) : fipeUrl.raiz}
          />
        ) : (
          <>
            <header className="mb-10 mt-4 px-4 text-center">
              <span className="text-lg font-light text-slate-500">Tabela FIPE</span>
              <h1 className="mt-1 font-display text-[clamp(26px,3.6vw,44px)] font-bold leading-snug tracking-tight text-slate-900">
                {marca.nome} {modelo.nome} {ano.label}
              </h1>
            </header>

            {/* Cartão do preço */}
            <div className="mb-6 flex justify-center">
              {valor.isLoading ? (
                <div className="flex items-center gap-3 rounded-full border border-hair bg-cloud px-8 py-6 text-slate-400">
                  <Spinner className="h-5 w-5" /> Consultando a FIPE…
                </div>
              ) : valor.isError || !valor.data ? (
                <div className="rounded-2xl border border-hair bg-cloud px-8 py-6 text-center text-sm text-slate-500">
                  Não foi possível consultar o valor na FIPE agora. Tente novamente em
                  alguns instantes.
                </div>
              ) : (
                <div className="min-w-[240px] rounded-[9rem] border border-hair bg-cloud px-8 py-5 text-center shadow-card">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    Tabela FIPE
                  </p>
                  <p className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                    {valor.data.valorLabel}
                  </p>
                  <p className="mt-1.5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                    <Icon name="calendar" size={13} className="text-slate-400" />
                    {valor.data.mesReferencia}
                  </p>
                </div>
              )}
            </div>

            {valor.data && (
              <div className="mx-auto mb-8 flex max-w-lg flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="badge" size={13} className="text-brand" />
                  Código FIPE <strong className="text-slate-700">{valor.data.codigoFipe}</strong>
                </span>
                {valor.data.combustivel && (
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="fuel" size={13} className="text-brand" />
                    <strong className="text-slate-700">{valor.data.combustivel}</strong>
                  </span>
                )}
              </div>
            )}

            <p className="mx-auto mb-10 max-w-md text-center text-xs leading-relaxed text-slate-500">
              Os valores exibidos são meramente referenciais e têm finalidade
              exclusivamente informativa. Os dados não possuem validade oficial e não devem
              ser considerados como uma avaliação de veículos usados.
            </p>

            <div className="mb-10 flex flex-wrap justify-center gap-3">
              <Link
                to={fipeUrl.raiz}
                className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-dark"
              >
                <Icon name="search" size={15} /> Nova consulta
              </Link>
              <Link
                to={`/comprar?q=${encodeURIComponent(modelo.grupo)}`}
                className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-6 py-2.5 text-sm font-bold text-slate-900 shadow-card transition-colors hover:bg-cloud"
              >
                <Icon name="car" size={15} /> Ver ofertas na Revvio
              </Link>
            </div>

            {/* Outras versões do mesmo ano */}
            {(versoes.isLoading || (versoes.data ?? []).length > 1) && (
              <>
                <div className="my-10 h-px w-full bg-gradient-to-r from-white via-hair to-white" />
                <section className="mb-12">
                  <h2 className="mx-auto mb-8 max-w-2xl text-center text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
                    Compare preços de outras versões de
                    <br />
                    {marca.nome} {modelo.grupo} {ano.label} na tabela FIPE
                  </h2>

                  {versoes.isLoading ? (
                    <div className="flex justify-center py-10 text-slate-400">
                      <Spinner />
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-2xl border border-hair bg-white shadow-card">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-center text-sm">
                          <tbody>
                            <tr className="border-b border-line">
                              <th className="sticky left-0 z-10 w-40 bg-white px-6 py-4 text-left font-bold text-slate-700">
                                Versão
                              </th>
                              {(versoes.data ?? []).map((v) => (
                                <td
                                  key={v.modelo.codigo}
                                  className="min-w-[200px] border-l border-line px-6 py-4 font-semibold text-slate-800"
                                >
                                  {v.versao}
                                </td>
                              ))}
                            </tr>
                            <tr className="border-b border-line bg-raised">
                              <th className="sticky left-0 z-10 bg-raised px-6 py-4 text-left font-bold text-slate-700">
                                Código FIPE
                              </th>
                              {(versoes.data ?? []).map((v) => (
                                <td
                                  key={v.modelo.codigo}
                                  className="border-l border-line px-6 py-4 text-slate-500"
                                >
                                  {v.valor.codigoFipe}
                                </td>
                              ))}
                            </tr>
                            <tr>
                              <th className="sticky left-0 z-10 bg-white px-6 py-6 text-left align-top font-bold text-slate-700">
                                Preço
                              </th>
                              {(versoes.data ?? []).map((v) => (
                                <td
                                  key={v.modelo.codigo}
                                  className="border-l border-line px-6 py-6 align-top"
                                >
                                  <div className="mb-4 flex items-center justify-center gap-1.5">
                                    <span className="grid h-5 w-5 place-items-center rounded-full bg-brand text-white">
                                      <Icon name="dollar" size={11} stroke={2.6} />
                                    </span>
                                    <span className="font-bold text-brand-dark">
                                      {v.valor.valorLabel}
                                    </span>
                                  </div>
                                  {v.modelo.codigo === modelo.codigo ? (
                                    <span className="inline-block rounded-full bg-brand/10 px-5 py-2 text-sm font-bold text-brand-dark">
                                      Versão consultada
                                    </span>
                                  ) : (
                                    <Link
                                      to={fipeUrl.valor(marca.slug, v.modelo.slug, v.anoSlug)}
                                      className="mt-1 inline-block rounded-full border border-slate-800 px-5 py-2 text-sm font-bold text-slate-900 transition-colors hover:bg-cloud"
                                    >
                                      Mais detalhes
                                    </Link>
                                  )}
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              </>
            )}

            {/* Histórico mensal — depende do plano pago da API da FIPE */}
            {historicoDisponivel && linhasHistorico.length > 1 && (
              <>
                <div className="mb-8 overflow-hidden rounded-2xl border border-hair bg-white shadow-card">
                  <div className="flex items-center justify-between bg-ink px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-white/15 text-white">
                        <Icon name="trendUp" size={15} />
                      </span>
                      <h3 className="text-base font-bold text-white">
                        Histórico de valores
                      </h3>
                    </div>
                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/70">
                      {linhasHistorico.length} meses
                    </span>
                  </div>
                  <div className="p-6">
                    <HistoricoChart pontos={historico.data ?? []} />
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-hair bg-white shadow-card">
                  <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
                    <h4 className="text-sm font-bold text-slate-700">Detalhamento mensal</h4>
                    <span className="text-xs text-slate-400">Valores da tabela FIPE</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-raised text-left text-xs font-bold uppercase tracking-wider text-slate-500">
                          <th className="px-6 py-3">Mês / referência</th>
                          <th className="px-6 py-3 text-right">Valor</th>
                          <th className="px-6 py-3 text-right">Variação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {linhasHistorico.map((l) => (
                          <tr key={l.mes} className="hover:bg-row">
                            <td className="px-6 py-3 text-slate-700">
                              {capitalizar(l.mes)}
                            </td>
                            <td className="px-6 py-3 text-right font-semibold text-slate-900">
                              {moeda(l.preco)}
                            </td>
                            <td className="px-6 py-3 text-right">
                              {l.variacao == null ? (
                                <span className="text-slate-300">—</span>
                              ) : (
                                <span
                                  className={`font-medium ${
                                    l.variacao < 0 ? "text-red-500" : "text-brand-dark"
                                  }`}
                                >
                                  {l.variacao > 0 ? "+" : ""}
                                  {(l.variacao * 100).toFixed(2).replace(".", ",")}%
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </FipeContainer>
    </PublicShell>
  );
}
