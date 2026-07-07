import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Seller, Vehicle } from "@/lib/database.types";

export type AppNotification = {
  id: string;
  title: string;
  body?: string;
  ts: number;
  read: boolean;
};

/**
 * Notificações em tempo real por papel (Supabase Realtime / postgres_changes):
 *  • Admin: novo veículo cadastrado + novo vendedor cadastrado.
 *  • Vendedor: mudança de status da própria conta (aprovado / suspenso / reativado).
 * A entrega já é filtrada pelo RLS de cada assinante.
 */
export function useRealtimeNotifications() {
  const { isAdmin, seller } = useAuth();
  const qc = useQueryClient();
  const [items, setItems] = useState<AppNotification[]>([]);
  const seq = useRef(0);

  function push(n: Omit<AppNotification, "id" | "ts" | "read">) {
    const id = `${Date.now()}-${seq.current++}`;
    setItems((prev) => [{ ...n, id, ts: Date.now(), read: false }, ...prev].slice(0, 50));
  }

  // Admin: novos veículos e novos vendedores
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-notifs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rv_vehicles" },
        (payload) => {
          const v = payload.new as Vehicle;
          push({
            title: "Novo veículo cadastrado",
            body: `${v.make} ${v.model}${v.year ? ` · ${v.year}` : ""}`,
          });
          qc.invalidateQueries({ queryKey: ["admin-vehicles"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "rv_sellers" },
        (payload) => {
          const s = payload.new as Seller;
          push({
            title: "Novo vendedor cadastrado",
            body: `${s.name} aguarda aprovação`,
          });
          qc.invalidateQueries({ queryKey: ["admin-sellers"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, qc]);

  // Vendedor: mudança de status da própria conta
  useEffect(() => {
    if (isAdmin || !seller?.id) return;
    const sellerId = seller.id;
    const channel = supabase
      .channel(`seller-notifs-${sellerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rv_sellers",
          filter: `id=eq.${sellerId}`,
        },
        (payload) => {
          const next = payload.new as Seller;
          const prev = payload.old as Partial<Seller>;
          if (next.status === prev.status) return;
          if (next.status === "active") {
            push({
              title: "Conta aprovada 🎉",
              body: "Você já pode publicar veículos no seu painel.",
            });
          } else if (next.status === "suspended") {
            push({
              title: "Conta suspensa",
              body: "Entre em contato com a administração da plataforma.",
            });
          } else if (next.status === "pending") {
            push({ title: "Conta em revisão", body: "Seu acesso está pendente." });
          }
          qc.invalidateQueries({ queryKey: ["seller"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, seller?.id, qc]);

  const unread = items.filter((i) => !i.read).length;
  const markAllRead = () =>
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));

  return { items, unread, markAllRead };
}
