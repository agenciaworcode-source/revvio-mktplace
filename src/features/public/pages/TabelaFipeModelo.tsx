import { useParams } from "react-router-dom";
import { PublicShell } from "../PublicShell";
import { Seo } from "@/components/Seo";
import { Spinner } from "@/components/ui";
import { Breadcrumb, FipeAviso, FipeContainer, TileLink } from "../components/fipe";
import {
  acharPorSlug,
  fipeUrl,
  useAnos,
  useMarcas,
  useModelos,
} from "../fipeQueries";

/* ============================================================
   /tabela-fipe/:marca/:modelo — anos disponíveis do modelo
   ============================================================ */

export function TabelaFipeModelo() {
  const { marca: slugMarca, modelo: slugModelo } = useParams();
  const marcas = useMarcas();
  const marca = acharPorSlug(marcas.data, slugMarca);
  const modelos = useModelos(marca?.codigo);
  const modelo = acharPorSlug(modelos.data, slugModelo);
  const anos = useAnos(marca?.codigo, modelo?.codigo);

  const carregando =
    marcas.isLoading || (!!marca && modelos.isLoading) || (!!modelo && anos.isLoading);

  return (
    <PublicShell>
      <Seo
        title={`Tabela FIPE ${marca?.nome ?? ""} ${modelo?.nome ?? ""}`}
        description={`Preço FIPE do ${marca?.nome ?? ""} ${modelo?.nome ?? ""} por ano de fabricação. Escolha o ano para ver o valor atualizado.`}
        path={
          slugMarca && slugModelo ? fipeUrl.modelo(slugMarca, slugModelo) : undefined
        }
      />

      <FipeContainer>
        <Breadcrumb
          itens={[
            { label: "Início", to: "/" },
            { label: "Tabela FIPE", to: fipeUrl.raiz },
            { label: marca?.nome ?? "Marca", to: marca ? fipeUrl.marca(marca.slug) : undefined },
            { label: modelo?.nome ?? "Modelo" },
          ]}
        />

        {carregando ? (
          <div className="flex justify-center py-24 text-slate-400">
            <Spinner />
          </div>
        ) : !marca || !modelo ? (
          <FipeAviso
            titulo="Modelo não encontrado"
            descricao="O endereço aponta para um modelo que não está na tabela FIPE de carros."
            to={marca ? fipeUrl.marca(marca.slug) : fipeUrl.raiz}
            acao={marca ? `Ver modelos ${marca.nome}` : "Voltar para a Tabela FIPE"}
          />
        ) : anos.isError || (anos.data ?? []).length === 0 ? (
          <FipeAviso
            titulo="Nenhum ano disponível"
            descricao="A FIPE não retornou anos para este modelo agora. Tente novamente em alguns instantes ou escolha outro modelo."
            to={fipeUrl.marca(marca.slug)}
            acao={`Ver modelos ${marca.nome}`}
          />
        ) : (
          <>
            <header className="mb-10">
              <h1 className="font-display text-[clamp(28px,3.4vw,40px)] font-extrabold tracking-[-1.2px]">
                <span className="text-brand">{marca.nome}</span>{" "}
                <span className="text-slate-900">{modelo.nome}</span>
              </h1>
              <p className="mt-2 text-slate-500">Selecione o ano para ver o preço FIPE.</p>
            </header>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {(anos.data ?? []).map((a) => (
                <TileLink
                  key={a.codigo}
                  to={fipeUrl.valor(marca.slug, modelo.slug, a.slug)}
                  className="px-5 py-4"
                >
                  <span className="block text-lg font-bold text-slate-800 group-hover:text-brand">
                    {a.label}
                  </span>
                  {a.combustivel && (
                    <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wider text-slate-400">
                      {a.combustivel}
                    </span>
                  )}
                </TileLink>
              ))}
            </div>
          </>
        )}
      </FipeContainer>
    </PublicShell>
  );
}
