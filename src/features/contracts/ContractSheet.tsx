// ============================================================
// Folha do contrato: timbre (preto e branco) + corpo do documento.
// Usada tanto na prévia em tela quanto na folha de impressão — assim o que
// aparece no editor é exatamente o que sai no papel/PDF.
//
// O timbre vem do escopo: contrato do superadmin sai com a marca Revvender,
// contrato do garagista sai com a logo da própria loja.
// ============================================================

import { type ContractType } from "./templates";
import type { Letterhead as LetterheadData } from "./scope";

/** A procuração precisa caber em 1 folha A4 — tipografia mais enxuta. */
export function isSinglePage(type: ContractType | undefined): boolean {
  return type === "procuracao";
}

/** Timbre: marca + wordmark + linha com os dados de quem emite. */
function Letterhead({
  mode,
  compact,
  data,
}: {
  mode: Mode;
  compact: boolean;
  data: LetterheadData;
}) {
  const print = mode === "print";
  const markHeight = print ? (compact ? "9mm" : "11mm") : compact ? 30 : 36;
  // Altura da imagem do wordmark. Era font-size do texto antigo; como imagem
  // precisa ser menor, senão a caixa inteira das letras fica maior que a marca.
  const wordHeight = print ? (compact ? "10pt" : "12pt") : compact ? 15 : 18;
  // A logo da loja é livre (quadrada, larga, alta), então limitamos a largura
  // para um logo comprido não empurrar o cabeçalho inteiro.
  const markMaxWidth = print ? (compact ? "45mm" : "55mm") : compact ? 150 : 180;

  return (
    <header
      className={print ? "border-b border-slate-300" : "border-b border-hair"}
      style={
        print
          ? { paddingBottom: "3mm", marginBottom: compact ? "5mm" : "8mm" }
          : { paddingBottom: 16, marginBottom: compact ? 20 : 24 }
      }
    >
      {/* Timbre em preto e branco: o contrato costuma sair em impressora
          monocromática, e a versão colorida vira cinza chapado no papel. */}
      <div className="flex items-center gap-2.5">
        <img
          src={data.markUrl}
          alt=""
          style={{ height: markHeight, maxWidth: markMaxWidth }}
          className="w-auto object-contain"
        />
        {data.wordmarkUrl && (
          <img
            src={data.wordmarkUrl}
            alt={data.name}
            style={{ height: wordHeight }}
            className="w-auto"
          />
        )}
      </div>
      <p
        className="mt-1.5 font-sans text-slate-500"
        style={{ fontSize: print ? (compact ? "7.5pt" : "8pt") : 10.5, lineHeight: 1.45 }}
      >
        {data.name}
        {data.cnpj && ` · CNPJ ${data.cnpj}`}
        {data.address && (
          <>
            <br />
            {data.address}
          </>
        )}
      </p>
    </header>
  );
}

type Mode = "screen" | "print";

/**
 * `text` já vem interpolado (tags [campo] substituídas).
 * `compact` reduz corpo e entrelinha para o documento fechar em 1 folha.
 */
export function ContractSheet({
  text,
  mode,
  letterhead,
  compact = false,
}: {
  text: string;
  mode: Mode;
  letterhead: LetterheadData;
  compact?: boolean;
}) {
  const print = mode === "print";
  return (
    <>
      <Letterhead mode={mode} compact={compact} data={letterhead} />
      <div
        className="whitespace-pre-wrap font-serif"
        style={{
          fontSize: print
            ? compact
              ? "11pt"
              : "13pt"
            : compact
              ? "12.5px"
              : "13.5px",
          lineHeight: compact ? 1.5 : 1.7,
          color: print ? "#000" : undefined,
          textAlign: "justify",
        }}
      >
        {text}
      </div>
    </>
  );
}
