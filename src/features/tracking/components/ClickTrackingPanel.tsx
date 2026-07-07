import { useState, type ReactNode } from "react";
import { Spinner } from "@/components/ui";
import {
  useClicksByVehicle,
  useClickBuyers,
  useChannelClicks,
  type ClickBuyer,
} from "@/features/tracking/queries";

const cardCls =
  "rounded-2xl border border-hair bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)] p-6";

const CHANNEL_LABEL: Record<string, string> = {
  store_whatsapp: "WhatsApp da mini-loja",
  store_instagram: "Instagram da mini-loja",
};

function BuyersTable({ buyers, unit }: { buyers: ClickBuyer[]; unit: string }) {
  if (buyers.length === 0)
    return <p className="px-1 py-2 text-[13px] text-slate-400">Sem registros.</p>;
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-[.5px] text-slate-400">
        <tr>
          <th className="py-1">Nome</th>
          <th>Telefone</th>
          <th>E-mail</th>
          <th>Cidade</th>
          <th className="text-right">{unit}</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100 text-slate-700">
        {buyers.map((b, i) => (
          <tr key={(b.buyer_id ?? "anon") + i}>
            <td className="py-1.5">{b.name}</td>
            <td>{b.phone ?? "—"}</td>
            <td>{b.email ?? "—"}</td>
            <td>{b.city ?? "—"}</td>
            <td className="text-right font-semibold">{b.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ClicksByVehicleCard({
  sellerId,
  subtitle,
  headerExtra,
}: {
  sellerId?: string;
  subtitle?: string;
  headerExtra?: ReactNode;
}) {
  const [openVehicle, setOpenVehicle] = useState<number | null>(null);
  const cars = useClicksByVehicle(sellerId || undefined);
  const buyers = useClickBuyers(openVehicle ?? undefined);

  return (
    <section className={cardCls}>
      <h2 className="mb-1 text-base font-bold text-slate-950">Cliques por carro</h2>
      {subtitle && <p className="mb-4 text-[13px] text-slate-400">{subtitle}</p>}
      {headerExtra}

      {sellerId &&
        (cars.isLoading ? (
          <div className="py-6 text-center text-slate-400">
            <Spinner />
          </div>
        ) : (cars.data ?? []).length === 0 ? (
          <p className="mt-4 text-[13px] text-slate-400">Nenhum veículo cadastrado.</p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {(cars.data ?? []).map((c) => {
              const label = (
                <>
                  <span className="font-medium text-slate-800">
                    {c.make} {c.model} {c.year ? `(${c.year})` : ""}
                  </span>
                  <span
                    className={`text-[13px] font-semibold ${
                      c.clicks > 0 ? "text-brand-dark" : "text-slate-400"
                    }`}
                  >
                    {c.clicks} clique(s)
                  </span>
                </>
              );
              return (
                <li key={c.vehicle_id} className="py-2">
                  {c.clicks > 0 ? (
                    <button
                      onClick={() =>
                        setOpenVehicle(openVehicle === c.vehicle_id ? null : c.vehicle_id)
                      }
                      className="flex w-full items-center justify-between text-left"
                    >
                      {label}
                    </button>
                  ) : (
                    <div className="flex w-full items-center justify-between">{label}</div>
                  )}
                  {c.clicks > 0 && openVehicle === c.vehicle_id && (
                    <div className="mt-2 rounded-lg bg-[#fbfbfc] p-3">
                      {buyers.isLoading ? (
                        <Spinner />
                      ) : (
                        <BuyersTable buyers={buyers.data ?? []} unit="Cliques" />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}

function ChannelsCard({ sellerId }: { sellerId: string }) {
  const channels = useChannelClicks(sellerId || undefined);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className={cardCls}>
      <h2 className="mb-3 text-base font-bold text-slate-950">Acessos a canais externos</h2>
      {channels.isLoading ? (
        <div className="py-6 text-center text-slate-400">
          <Spinner />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {(channels.data ?? []).map((c) => (
            <li key={c.kind} className="py-2">
              <button
                onClick={() => setOpen(open === c.kind ? null : c.kind)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="font-medium text-slate-800">{CHANNEL_LABEL[c.kind]}</span>
                <span className="text-[13px] font-semibold text-brand-dark">
                  {c.total} acesso(s)
                </span>
              </button>
              {open === c.kind && (
                <div className="mt-2 rounded-lg bg-[#fbfbfc] p-3">
                  <BuyersTable buyers={c.buyers} unit="Acessos" />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Painel de rastreamento de cliques escopado por garagista (`sellerId`).
 * O admin passa um `headerExtra` (seletor de garagista) e deixa `sellerId`
 * variável; o garagista usa o próprio `lojaId` fixo, sem seletor.
 */
export function ClickTrackingPanel({
  sellerId,
  subtitle,
  headerExtra,
  className = "",
}: {
  sellerId?: string;
  subtitle?: string;
  headerExtra?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      <ClicksByVehicleCard sellerId={sellerId} subtitle={subtitle} headerExtra={headerExtra} />
      {sellerId && <ChannelsCard sellerId={sellerId} />}
    </div>
  );
}
