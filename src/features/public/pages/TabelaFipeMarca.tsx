import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PublicShell } from "../PublicShell";
import { Seo } from "@/components/Seo";
import { Spinner } from "@/components/ui";
import { Icon } from "../components/icons";
import {
  ancoraId,
  Breadcrumb,
  FipeAviso,
  FipeContainer,
  GrupoHeader,
  JumpLinks,
} from "../components/fipe";
import {
  acharPorSlug,
  agruparPorFamilia,
  fipeUrl,
  useMarcas,
  useModelos,
} from "../fipeQueries";

/* ============================================================
   /tabela-fipe/:marca — modelos da marca, agrupados por família
   ============================================================ */

export function TabelaFipeMarca() {
  const { marca: slugMarca } = useParams();
  const marcas = useMarcas();
  const marca = acharPorSlug(marcas.data, slugMarca);
  const modelos = useModelos(marca?.codigo);
  const [busca, setBusca] = useState("");

  const grupos = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = termo
      ? (modelos.data ?? []).filter((m) => m.nome.toLowerCase().includes(termo))
      : (modelos.data ?? []);
    return agruparPorFamilia(lista);
  }, [modelos.data, busca]);

  const carregando = marcas.isLoading || (!!marca && modelos.isLoading);

  return (
    <PublicShell>
      <Seo
        title={`Tabela FIPE ${marca?.nome ?? ""} — preços por modelo`}
        description={`Consulte o preço FIPE dos modelos ${marca?.nome ?? ""}. Escolha o modelo e o ano para ver o valor atualizado da tabela.`}
        path={slugMarca ? fipeUrl.marca(slugMarca) : undefined}
      />

      <FipeContainer>
        <Breadcrumb
          itens={[
            { label: "Início", to: "/" },
            { label: "Tabela FIPE", to: fipeUrl.raiz },
            { label: marca?.nome ?? "Marca" },
          ]}
        />

        {carregando ? (
          <div className="flex justify-center py-24 text-slate-400">
            <Spinner />
          </div>
        ) : !marca ? (
          <FipeAviso
            titulo="Marca não encontrada"
            descricao="O endereço aponta para uma marca que não está na tabela FIPE de carros."
          />
        ) : modelos.isError ? (
          <FipeAviso
            titulo="A consulta à FIPE está indisponível"
            descricao="Não foi possível carregar os modelos desta marca agora. Tente novamente em alguns instantes."
          />
        ) : (
          <>
            <header className="mb-6">
              <h1 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-1.2px] text-brand">
                {marca.nome}
              </h1>
              <p className="mt-2 text-slate-500">
                Modelos disponíveis para consulta de preço FIPE.
              </p>
            </header>

            <div className="relative mb-8 max-w-md">
              <Icon
                name="search"
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar modelo…"
                className="w-full rounded-xl border border-stroke bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 shadow-card outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand"
              />
            </div>

            {grupos.length === 0 ? (
              <p className="rounded-2xl border border-hair bg-white px-6 py-12 text-center text-sm text-slate-500">
                Nenhum modelo encontrado para “{busca}”.
              </p>
            ) : (
              <>
                <JumpLinks itens={grupos.map((g) => g.grupo)} />
                <div className="space-y-8">
                  {grupos.map((g) => (
                    <div
                      key={g.grupo}
                      id={ancoraId(g.grupo)}
                      className="scroll-mt-28"
                    >
                      <GrupoHeader
                        titulo={g.grupo}
                        estilo="texto"
                        contador={g.itens.length}
                      />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {g.itens.map((m) => (
                          <Link
                            key={m.codigo}
                            to={fipeUrl.modelo(marca.slug, m.slug)}
                            className="group flex items-center justify-between gap-3 rounded-xl border border-hair bg-white px-4 py-3 shadow-card transition-all hover:border-brand/40 hover:shadow-md"
                          >
                            <span className="text-sm text-slate-700 group-hover:text-brand">
                              {m.nome}
                            </span>
                            <Icon
                              name="chevronRight"
                              size={14}
                              className="shrink-0 text-slate-300 group-hover:text-brand"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </FipeContainer>
    </PublicShell>
  );
}
