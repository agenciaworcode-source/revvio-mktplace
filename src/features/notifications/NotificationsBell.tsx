import { useEffect, useRef, useState } from "react";
import { Icon } from "@/features/public/components/icons";
import { useRealtimeNotifications } from "./useRealtimeNotifications";

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  if (s < 86400) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export function NotificationsBell() {
  const { items, unread, markAllRead } = useRealtimeNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (next && unread) markAllRead();
      return next;
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative grid h-[34px] w-[34px] place-items-center rounded-[9px] text-slate-300"
        style={{ background: "rgba(255,255,255,.06)" }}
        aria-label="Notificações"
        onClick={toggle}
      >
        <Icon name="bell" size={17} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-[42px] z-50 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            Notificações
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              Nada por aqui ainda.
            </p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                    <span className="whitespace-nowrap text-[11px] text-slate-400">
                      {timeAgo(n.ts)}
                    </span>
                  </div>
                  {n.body && <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
