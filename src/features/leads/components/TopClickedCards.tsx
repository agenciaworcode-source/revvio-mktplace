import { Link } from "react-router-dom";
import { useTopClicked } from "../queries";

export function TopClickedCards({ sellerId }: { sellerId?: string }) {
  const { data } = useTopClicked(sellerId);
  const list = data ?? [];
  if (list.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
        Anúncios mais clicados
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {list.map((v) => (
          <Link
            key={v.id}
            to={`/veiculo/${v.id}`}
            target="_blank"
            className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 hover:border-brand"
          >
            {v.images?.[0] ? (
              <img src={v.images[0]} alt="" className="h-12 w-16 rounded-lg object-cover" />
            ) : (
              <span className="h-12 w-16 rounded-lg bg-slate-100" />
            )}
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-slate-900">
                {v.make} {v.model}
              </p>
              <p className="text-[12px] text-slate-500">
                {v.clicks} clique{v.clicks === 1 ? "" : "s"}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
