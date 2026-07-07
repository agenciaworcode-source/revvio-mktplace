import { Link } from "react-router-dom";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Vehicle } from "@/lib/database.types";
import type { PublicSeller } from "../queries";

/** Card de veículo da vitrine. O badge do vendedor é opcional (a mini-loja já
 * mostra o vendedor no topo, então lá passamos seller=undefined). */
export function VehicleCard({
  vehicle,
  seller,
}: {
  vehicle: Vehicle;
  seller?: PublicSeller | null;
}) {
  return (
    <Link
      to={`/veiculo/${vehicle.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 transition-colors hover:border-brand"
    >
      <div className="aspect-video overflow-hidden bg-slate-800">
        {vehicle.images[0] ? (
          <img
            src={vehicle.images[0]}
            alt={`${vehicle.make} ${vehicle.model}`}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-600">
            Sem foto
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="font-semibold text-white">
          {vehicle.make} {vehicle.model}
        </p>
        <p className="text-xs text-slate-500">
          {vehicle.year ?? "—"}
          {vehicle.mileage != null && ` · ${formatNumber(vehicle.mileage)} km`}
          {vehicle.color && ` · ${vehicle.color}`}
        </p>
        <p className="mt-1 text-lg font-bold text-brand">
          {formatCurrency(vehicle.price)}
        </p>

        {seller && (
          <div className="mt-3 flex items-center gap-2 border-t border-slate-800 pt-3">
            <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-slate-700">
              {seller.avatar_url ? (
                <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] font-bold text-slate-300">
                  {seller.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <span className="truncate text-xs text-slate-400">{seller.name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
