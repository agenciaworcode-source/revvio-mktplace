import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  TileLink,
} from "../components/fipe";
import {
  agruparPorLetra,
  fipeUrl,
  useAnos,
  useMarcas,
  useModelos,
  type AnoFipe,
  type MarcaFipe,
  type ModeloFipe,
} from "../fipeQueries";

/* ============================================================
   /tabela-fipe — busca por marca/modelo/ano + índice de marcas
   ============================================================ */

type Opcao = { chave: string; rotulo: string };

/**
 * Campo com sugestões. `somenteLista` é o comportamento do campo de ano, que
 * não se digita: clicar abre a lista inteira.
 */
function CampoBusca({
  label,
  placeholder,
  disabled = false,
  valor,
  aoDigitar,
  opcoes,
  aoEscolher,
  somenteLista = false,
  carregando = false,
}: {
  label: string;
  placeholder: string;
  disabled?: boolean;
  valor: string;
  aoDigitar?: (v: string) => void;
  opcoes: Opcao[];
  aoEscolher: (chave: string) => void;
  somenteLista?: boolean;
  carregando?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const visiveis = opcoes.slice(0, 60);

  return (
    <div className="relative" ref={box}>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <input
        type="text"
        value={valor}
        disabled={disabled}
        readOnly={somenteLista}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          aoDigitar?.(e.target.value);
          setAberto(true);
        }}
        // O campo de ano é readonly: o foco vem junto com o clique e abrir
        // aqui faria o toggle de baixo fechar a lista no primeiro clique.
        onFocus={() => !somenteLista && setAberto(true)}
        onClick={() => somenteLista && setAberto((a) => !a)}
        className={`w-full rounded-xl border border-stroke bg-raised px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-muted focus:border-brand focus:ring-1 focus:ring-brand disabled:cursor-not-allowed disabled:opacity-60 ${
          somenteLista ? "cursor-pointer" : ""
        }`}
      />
      {carregando && (
        <span className="absolute right-3 top-[38px] text-slate-400">
          <Spinner className="h-4 w-4" />
        </span>
      )}
      {aberto && !disabled && visiveis.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-hair bg-white shadow-lg">
          {visiveis.map((o) => (
            <button
              key={o.chave}
              type="button"
              onClick={() => {
                aoEscolher(o.chave);
                setAberto(false);
              }}
              className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-cloud hover:text-brand"
            >
              {o.rotulo}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const contem = (texto: string, termo: string) =>
  texto.toLowerCase().includes(termo.trim().toLowerCase());

export function TabelaFipe() {
  const navigate = useNavigate();
  const marcas = useMarcas();

  const [marca, setMarca] = useState<MarcaFipe | null>(null);
  const [modelo, setModelo] = useState<ModeloFipe | null>(null);
  const [textoMarca, setTextoMarca] = useState("");
  const [textoModelo, setTextoModelo] = useState("");

  const modelos = useModelos(marca?.codigo);
  const anos = useAnos(marca?.codigo, modelo?.codigo);

  const opcoesMarca = useMemo(
    () =>
      (marcas.data ?? [])
        .filter((m) => !textoMarca || contem(m.nome, textoMarca))
        .map((m) => ({ chave: m.codigo, rotulo: m.nome })),
    [marcas.data, textoMarca]
  );
  const opcoesModelo = useMemo(
    () =>
      (modelos.data ?? [])
        .filter((m) => !textoModelo || contem(m.nome, textoModelo))
        .map((m) => ({ chave: m.codigo, rotulo: m.nome })),
    [modelos.data, textoModelo]
  );
  const opcoesAno = useMemo(
    () =>
      (anos.data ?? []).map((a: AnoFipe) => ({
        chave: a.codigo,
        rotulo: a.combustivel ? `${a.label} · ${a.combustivel}` : a.label,
      })),
    [anos.data]
  );

  function escolherMarca(codigo: string) {
    const m = (marcas.data ?? []).find((i) => i.codigo === codigo) ?? null;
    setMarca(m);
    setTextoMarca(m?.nome ?? "");
    setModelo(null);
    setTextoModelo("");
  }
  function escolherModelo(codigo: string) {
    const m = (modelos.data ?? []).find((i) => i.codigo === codigo) ?? null;
    setModelo(m);
    setTextoModelo(m?.nome ?? "");
  }
  function escolherAno(codigo: string) {
    const a = (anos.data ?? []).find((i) => i.codigo === codigo);
    if (a && marca && modelo) navigate(fipeUrl.valor(marca.slug, modelo.slug, a.slug));
  }
  function limpar() {
    setMarca(null);
    setModelo(null);
    setTextoMarca("");
    setTextoModelo("");
  }

  const grupos = useMemo(() => agruparPorLetra(marcas.data ?? []), [marcas.data]);

  return (
    <PublicShell>
      <Seo
        title="Tabela FIPE 2026 — consulte o preço do seu veículo"
        description="Consulte o valor médio de carros pela tabela FIPE. Selecione marca, modelo e ano e veja o preço atualizado, o código FIPE e as demais versões."
        path="/tabela-fipe"
      />

      <FipeContainer>
        <Breadcrumb itens={[{ label: "Início", to: "/" }, { label: "Tabela FIPE" }]} />

        <header className="mb-10">
          <h1 className="font-display text-[clamp(32px,4vw,48px)] font-extrabold tracking-[-1.5px] text-slate-950">
            <span className="text-brand">Tabela</span> FIPE
          </h1>
          <p className="mt-3 max-w-2xl text-lg leading-relaxed text-slate-500">
            Consulte o valor médio de veículos com base na tabela FIPE. Selecione a marca,
            modelo e ano para ver o preço atualizado.
          </p>
        </header>

        {/* Filtros */}
        <div className="mb-8 rounded-2xl border border-hair bg-white p-6 shadow-card sm:p-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <CampoBusca
              label="Marca"
              placeholder={marcas.isLoading ? "Carregando marcas…" : "Digite a marca…"}
              valor={textoMarca}
              aoDigitar={(v) => {
                setTextoMarca(v);
                if (!v) limpar();
              }}
              opcoes={opcoesMarca}
              aoEscolher={escolherMarca}
              carregando={marcas.isLoading}
            />
            <CampoBusca
              label="Modelo"
              placeholder={
                !marca
                  ? "Selecione a marca…"
                  : modelos.isLoading
                    ? "Carregando modelos…"
                    : "Digite o modelo…"
              }
              disabled={!marca}
              valor={textoModelo}
              aoDigitar={(v) => {
                setTextoModelo(v);
                if (!v) setModelo(null);
              }}
              opcoes={opcoesModelo}
              aoEscolher={escolherModelo}
              carregando={!!marca && modelos.isLoading}
            />
            <CampoBusca
              label="Ano"
              placeholder={
                !modelo
                  ? "Selecione o modelo…"
                  : anos.isLoading
                    ? "Carregando anos…"
                    : "Selecione o ano…"
              }
              disabled={!modelo || anos.isLoading}
              valor=""
              opcoes={opcoesAno}
              aoEscolher={escolherAno}
              somenteLista
              carregando={!!modelo && anos.isLoading}
            />
            <div className="flex items-end">
              {(marca || modelo) && (
                <button
                  type="button"
                  onClick={limpar}
                  className="w-full rounded-xl bg-line px-4 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-hair"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Índice de marcas */}
        <section className="mt-12">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900">Marcas com preço FIPE</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Clique em uma marca para ver os modelos disponíveis.
            </p>
          </div>

          {marcas.isLoading ? (
            <div className="flex justify-center py-16 text-slate-400">
              <Spinner />
            </div>
          ) : marcas.isError ? (
            <FipeAviso
              titulo="A consulta à FIPE está indisponível"
              descricao="Não foi possível carregar a lista de marcas agora. Tente novamente em alguns instantes."
              acao="Ver veículos à venda"
              to="/comprar"
            />
          ) : (
            <>
              <JumpLinks itens={grupos.map((g) => g.letra)} />
              <div className="space-y-8">
                {grupos.map((g) => (
                  <div key={g.letra} id={ancoraId(g.letra)} className="scroll-mt-28">
                    <GrupoHeader titulo={g.letra} />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                      {g.itens.map((m) => (
                        <TileLink key={m.codigo} to={fipeUrl.marca(m.slug)}>
                          <span className="text-sm font-semibold text-slate-800 group-hover:text-brand">
                            {m.nome}
                          </span>
                        </TileLink>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        <p className="mt-12 flex items-start gap-2 text-xs leading-relaxed text-slate-400">
          <Icon name="shield" size={14} className="mt-0.5 shrink-0" />
          Os valores exibidos são meramente referenciais e têm finalidade exclusivamente
          informativa. Os dados não possuem validade oficial e não devem ser considerados
          como uma avaliação de veículos usados.
        </p>
      </FipeContainer>
    </PublicShell>
  );
}
