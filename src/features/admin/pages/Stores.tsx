import { useState } from "react";
import { useAdminOverview, useDeleteStore } from "../queries";
import { AdminActions } from "../components";
import { PanelHeader, StatusPill } from "@/components/panel";
import { Icon } from "@/features/public/components/icons";
import { Spinner } from "@/components/ui";
import { Alert, Button, Field, Input, Modal } from "@/components/ui-light";
import type { Seller } from "@/lib/database.types";

function errorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    const parts = [e.message, e.details, e.hint].filter(Boolean);
    if (parts.length) return parts.join(" · ") + (e.code ? ` [${e.code}]` : "");
  }
  if (err instanceof Error) return err.message;
  return "Erro ao excluir a loja.";
}

function DeleteStoreModal({ store, onClose }: { store: Seller; onClose: () => void }) {
  const del = useDeleteStore();
  const [confirm, setConfirm] = useState("");
  const matches = confirm.trim() === store.name.trim();

  async function handleDelete() {
    if (!matches) return;
    try {
      await del.mutateAsync(store.id);
      onClose();
    } catch {
      /* erro exibido no Alert via del.error */
    }
  }

  return (
    <Modal open onClose={onClose} title="Excluir mini-loja" closeOnBackdrop={false}>
      <p className="text-sm text-slate-600">
        Esta ação é <strong>irreversível</strong>. Serão apagados permanentemente
        os veículos, vendas, comissões, vendedores, planos e cobranças de{" "}
        <strong className="text-slate-900">{store.name}</strong>.
      </p>

      {del.isError && (
        <div className="mt-4">
          <Alert variant="error">{errorMessage(del.error)}</Alert>
        </div>
      )}

      <div className="mt-4">
        <Field label={`Digite o nome da loja para confirmar: ${store.name}`}>
          <Input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder={store.name}
            autoFocus
          />
        </Field>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={del.isPending}>
          Cancelar
        </Button>
        <Button
          variant="danger"
          disabled={!matches}
          loading={del.isPending}
          onClick={handleDelete}
        >
          Excluir definitivamente
        </Button>
      </div>
    </Modal>
  );
}

export function Stores() {
  const o = useAdminOverview();
  const stores = o.sellers.filter((s) => s.status !== "pending");
  const [target, setTarget] = useState<Seller | null>(null);

  return (
    <div>
      <PanelHeader
        title="Gestão de Mini-Lojas"
        subtitle="Vitrines públicas dos vendedores"
        actions={<AdminActions rows={o.sellers} filename="assinantes" />}
      />

      {o.loading ? (
        <div className="flex justify-center py-24 text-slate-400">
          <Spinner />
        </div>
      ) : stores.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hair bg-white py-20 text-center text-slate-400">
          Nenhuma mini-loja ativa ainda.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => (
            <div
              key={s.id}
              className="overflow-hidden rounded-2xl border border-hair bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]"
            >
              <div
                className="relative h-[78px]"
                style={{ background: "linear-gradient(120deg,#0c1322,#1b2a44)" }}
              >
                {s.banner_url && (
                  <img
                    src={s.banner_url}
                    alt=""
                    className="h-full w-full object-cover opacity-60"
                  />
                )}
                {s.avatar_url ? (
                  <img
                    src={s.avatar_url}
                    alt=""
                    className="absolute -bottom-[22px] left-[18px] h-[50px] w-[50px] rounded-xl border-[3px] border-white object-cover"
                  />
                ) : (
                  <span className="absolute -bottom-[22px] left-[18px] grid h-[50px] w-[50px] place-items-center rounded-xl border-[3px] border-white bg-slate-100 font-bold text-slate-400">
                    {s.name?.[0]?.toUpperCase() ?? "?"}
                  </span>
                )}
              </div>
              <div className="px-[18px] pb-[18px] pt-[30px]">
                <div className="flex items-center justify-between">
                  <div className="text-[15px] font-bold text-slate-950">{s.name}</div>
                  <StatusPill status={s.status} />
                </div>
                <div className="my-1 mb-3.5 text-[12.5px] text-slate-400">
                  /loja/{s.slug} · {o.vehicleCounts.get(s.id) ?? 0} veículos
                </div>
                <a
                  href={`/loja/${s.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-[#e6e8ec] bg-white py-2.5 text-[13px] font-bold text-slate-950 hover:bg-slate-50"
                >
                  <Icon name="eye" size={15} /> Visitar mini-loja
                </a>
                <button
                  type="button"
                  onClick={() => setTarget(s)}
                  className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-red-200 bg-white py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50"
                >
                  <Icon name="logout" size={15} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {target && (
        <DeleteStoreModal store={target} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}
