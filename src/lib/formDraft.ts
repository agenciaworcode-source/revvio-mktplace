// ============================================================
// Rascunho de formulário em localStorage.
//
// Formulários longos (cadastro de veículo) eram perdidos por
// inteiro em qualquer desmontagem inesperada: recarregar a
// página, fechar a aba sem querer, queda de conexão, crash.
// O rascunho é gravado com debounce enquanto o usuário digita e
// oferecido de volta na próxima abertura do mesmo formulário.
//
// Só guarda o que dá para reconstruir sozinho (valores de campo
// e URLs de imagem já enviadas) — nada de File/Blob.
//
// A API é imperativa (`save(value)`) de propósito: um hook que
// recebesse o valor a cada render obrigaria o formulário a
// observar todos os campos (react-hook-form `watch()`), o que
// re-renderiza o form inteiro a cada tecla digitada.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "rv-draft:v1:";
/** Rascunho velho deixa de ser útil e vira ruído — expira em 24h. */
const TTL_MS = 24 * 60 * 60 * 1000;

interface Envelope<T> {
  savedAt: number;
  value: T;
}

function storageKey(key: string): string {
  return PREFIX + key;
}

export function readDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env.savedAt !== "number") return null;
    if (Date.now() - env.savedAt > TTL_MS) {
      window.localStorage.removeItem(storageKey(key));
      return null;
    }
    return env.value;
  } catch {
    return null; // JSON corrompido / storage bloqueado
  }
}

export function writeDraft<T>(key: string, value: T): void {
  try {
    const env: Envelope<T> = { savedAt: Date.now(), value };
    window.localStorage.setItem(storageKey(key), JSON.stringify(env));
  } catch {
    /* cota estourada ou modo privado: rascunho é best-effort */
  }
}

export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(storageKey(key));
  } catch {
    /* ignore */
  }
}

/** Remove rascunhos vencidos (roda uma vez por sessão, no primeiro uso). */
let purged = false;
function purgeExpired(): void {
  if (purged) return;
  purged = true;
  try {
    for (const k of Object.keys(window.localStorage)) {
      if (!k.startsWith(PREFIX)) continue;
      const raw = window.localStorage.getItem(k);
      if (!raw) continue;
      try {
        const env = JSON.parse(raw) as Envelope<unknown>;
        if (Date.now() - env.savedAt > TTL_MS) window.localStorage.removeItem(k);
      } catch {
        window.localStorage.removeItem(k);
      }
    }
  } catch {
    /* ignore */
  }
}

export interface FormDraft<T> {
  /** Um rascunho foi restaurado nesta montagem (para exibir o aviso). */
  restored: boolean;
  /** Agenda a gravação do rascunho (debounce). Referência estável. */
  save: (value: T) => void;
  /** Apaga o rascunho e cancela a gravação pendente — ao salvar ou descartar. */
  clear: () => void;
}

/**
 * Restaura o rascunho de `key` na montagem e devolve `save`/`clear`.
 *
 * - `key: null` desliga tudo (ex.: formulário sem loja definida ainda).
 * - `onRestore` roda no máximo uma vez por montagem.
 */
export function useFormDraft<T>({
  key,
  onRestore,
  debounceMs = 500,
}: {
  key: string | null;
  onRestore: (draft: T) => void;
  debounceMs?: number;
}): FormDraft<T> {
  const [restored, setRestored] = useState(false);
  /** Há conteúdo pendente de gravação/gravado nesta sessão do formulário. */
  const [pending, setPending] = useState(false);

  /** Chave já restaurada — cobre o duplo efeito do StrictMode e a troca de key. */
  const restoredFor = useRef<string | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<T | null>(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restauração: uma vez só por chave (o ref sobrevive ao duplo efeito do
  // StrictMode, que senão aplicaria o rascunho duas vezes).
  useEffect(() => {
    if (!key || restoredFor.current === key) return;
    restoredFor.current = key;
    purgeExpired();
    const draft = readDraft<T>(key);
    if (draft != null) {
      onRestoreRef.current(draft);
      setRestored(true);
    }
  }, [key]);

  const save = useCallback(
    (value: T) => {
      if (!key) return;
      latest.current = value;
      setPending(true);
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        timer.current = null;
        writeDraft(key, value);
      }, debounceMs);
    },
    [key, debounceMs]
  );

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    latest.current = null;
    setPending(false);
    setRestored(false);
    if (key) clearDraft(key);
  }, [key]);

  // Desmontar antes do debounce disparar (fechar o modal, trocar de rota)
  // perderia os últimos segundos digitados — grava na saída.
  useEffect(() => {
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        if (key && latest.current != null) writeDraft(key, latest.current);
      }
    };
  }, [key]);

  // Fechar/recarregar a aba com conteúdo não salvo pede confirmação. O
  // rascunho já está gravado, mas o aviso evita a perda percebida.
  useEffect(() => {
    if (!key || !pending) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [key, pending]);

  return { restored, save, clear };
}
