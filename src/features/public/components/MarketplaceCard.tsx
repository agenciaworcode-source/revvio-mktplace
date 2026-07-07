import { Link } from "react-router-dom";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { PublicVehicle } from "../queries";
import { Icon } from "./icons";

/** Card de veículo do marketplace (tema claro, padrão do protótipo). */
export function MarketplaceCard({ vehicle }: { vehicle: PublicVehicle }) {
  const photoCount = vehicle.images?.length ?? 0;
  const fipe = vehicle.fipe_price ?? 0;
  const off = fipe > vehicle.price ? Math.round((1 - vehicle.price / fipe) * 100) : 0;

  return (
    <Link
      to={`/veiculo/${vehicle.id}`}
      className="rv-vcard group block overflow-hidden rounded-2xl border border-hair bg-white transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-[0_14px_32px_rgba(16,24,40,.1)]"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
        {vehicle.images?.[0] ? (
          <img
            src={vehicle.images[0]}
            alt={`${vehicle.make} ${vehicle.model}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Sem foto
          </div>
        )}
        {photoCount > 0 && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-md bg-ink/80 px-2 py-1 text-xs font-bold text-white backdrop-blur">
            <Icon name="camera" size={13} /> {photoCount}
          </span>
        )}
        {off > 0 ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-brand px-2 py-1 text-[11.5px] font-extrabold tracking-wide text-white">
            -{off}% FIPE
          </span>
        ) : vehicle.featured ? (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-amber-500 px-2 py-1 text-[11.5px] font-extrabold tracking-wide text-white">
            OFERTA
          </span>
        ) : null}
      </div>

      <div className="px-4 pb-4 pt-3.5">
        <p className="text-[12.5px] font-extrabold uppercase tracking-wide text-slate-900">
          {vehicle.make}
        </p>
        <p className="mt-0.5 line-clamp-2 min-h-[36px] text-sm font-bold uppercase leading-snug text-brand">
          {vehicle.model}
        </p>

        <div className="my-3 flex gap-4 text-[13px] text-slate-400">
          {vehicle.mileage != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="clock" size={15} /> {formatNumber(vehicle.mileage)} km
            </span>
          )}
          {vehicle.year != null && (
            <span className="inline-flex items-center gap-1.5">
              <Icon name="calendar" size={15} /> {vehicle.year}
            </span>
          )}
        </div>

        {off > 0 && (
          <p className="text-[12.5px] text-slate-400 line-through">
            DE {formatCurrency(fipe)} (FIPE)
          </p>
        )}
        <p className="text-[21px] font-extrabold tracking-tight text-brand">
          {off > 0 && (
            <span className="mr-1.5 text-[13px] font-semibold text-slate-600">POR</span>
          )}
          {formatCurrency(vehicle.price)}
        </p>
        {vehicle.seller && (
          <div className="mt-3 flex items-center gap-2 border-t border-hair pt-2.5">
            {vehicle.seller.avatar_url ? (
              <img
                src={vehicle.seller.avatar_url}
                alt=""
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-400">
                {vehicle.seller.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-[12px] text-slate-500">
              Vendido por <span className="font-semibold text-slate-700">{vehicle.seller.name}</span>
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
