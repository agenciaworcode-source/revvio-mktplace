import { useState } from "react";
import { useAdminOverview, useDeleteStore, useSetSellerStatus } from "../queries";
import { AdminActions } from "../components";
import { PanelHeader, StatusPill } from "@/components/panel";
import { Icon } from "@/features/public/components/icons";
import { Spinner } from "@/components/ui";
import { Alert, Button, Field, Input, Modal } from "@/components/ui-light";
import type { Seller } from "@/lib/database.types";
import { panel } from "@/theme/palette";

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

/**
 * Suspender tira a vitrine do ar (o RLS público só lê `status = 'active'`) e
 * bloqueia o login do lojista, mas não apaga nada — dá para reativar.
 */
function SuspendStoreModal({ store, onClose }: { store: Seller; onClose: () => void }) {
  const setStatus = useSetSellerStatus();
  const suspendendo = store.status === "active";

  async function confirmar() {
    try {
      await setStatus.mutateAsync({
        id: store.id,
        status: suspendendo ? "suspended" : "active",
      });
      onClose();
    } catch {
      /* erro exibido no Alert via setStatus.error */
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={suspendendo ? "Suspender mini-loja" : "Reativar mini-loja"}
      closeOnBackdrop={false}
    >
      <p className="text-sm text-slate-600">
        {suspendendo ? (
          <>
            A vitrine de <strong className="text-slate-900">{store.name}</strong> sai do
            ar e o lojista perde o acesso ao painel. Os veículos, vendas e comissões são
            mantidos — é reversível a qualquer momento.
          </>
        ) : (
          <>
            A vitrine de <strong className="text-slate-900">{store.name}</strong> volta ao
            ar e o lojista recupera o acesso ao painel.
          </>
        )}
      </p>

      {setStatus.isError && (
        <div className="mt-4">
          <Alert variant="error">{errorMessage(setStatus.error)}</Alert>
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={setStatus.isPending}>
          Cancelar
        </Button>
        <Button
          variant={suspendendo ? "danger" : "primary"}
          loading={setStatus.isPending}
          onClick={confirmar}
        >
          {suspendendo ? "Suspender" : "Reativar"}
        </Button>
      </div>
    </Modal>
  );
}

export function Stores() {
  const o = useAdminOverview();
  const stores = o.stores.filter((s) => s.status !== "pending");
  const [target, setTarget] = useState<Seller | null>(null);
  const [suspending, setSuspending] = useState<Seller | null>(null);

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
              className="overflow-hidden rounded-2xl border border-hair bg-white shadow-card"
            >
              <div
                className="relative h-[78px]"
                style={{ background: `linear-gradient(120deg,${panel.top},${panel.accent})` }}
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
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate text-[15px] font-bold text-slate-950">
                    {s.name}
                  </div>
                  <StatusPill status={s.status} />
                </div>
                <div className="my-1 mb-3.5 text-[12.5px] text-slate-400">
                  {s.slug ? `/loja/${s.slug}` : "sem endereço público"} ·{" "}
                  {o.vehicleCounts.get(s.id) ?? 0} veículos
                </div>
                {s.slug ? (
                  <a
                    href={`/loja/${s.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-stroke-soft bg-white py-2.5 text-[13px] font-bold text-slate-950 hover:bg-slate-50"
                  >
                    <Icon name="eye" size={15} /> Visitar mini-loja
                  </a>
                ) : (
                  <div className="flex w-full items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-stroke-soft bg-slate-50 py-2.5 text-[13px] font-semibold text-slate-400">
                    Sem endereço público
                  </div>
                )}
                {s.role !== "admin" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSuspending(s)}
                      className={`flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border bg-white py-2.5 text-[13px] font-bold ${
                        s.status === "active"
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                          : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      <Icon name={s.status === "active" ? "lock" : "check"} size={15} />
                      {s.status === "active" ? "Suspender" : "Reativar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTarget(s)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[9px] border border-red-200 bg-white py-2.5 text-[13px] font-bold text-red-600 hover:bg-red-50"
                    >
                      <Icon name="logout" size={15} /> Excluir
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {suspending && (
        <SuspendStoreModal store={suspending} onClose={() => setSuspending(null)} />
      )}

      {target && (
        <DeleteStoreModal store={target} onClose={() => setTarget(null)} />
      )}
    </div>
  );
}
