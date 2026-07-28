"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Bell, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { formatDateTime, cn } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export function NotificationsList({ notifications }: { notifications: Notification[] }) {
  const hasUnread = notifications.some((n) => !n.read_at);
  const marked = useRef(false);

  // Mark everything read once, the first time the page is opened with unread items.
  useEffect(() => {
    if (hasUnread && !marked.current) {
      marked.current = true;
      void markAllNotificationsRead();
    }
  }, [hasUnread]);

  if (!notifications.length) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <Bell className="h-6 w-6 text-wood-600" />
          <p className="text-sm text-wood-700">Ingen varsler ennå.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {notifications.map((n) => {
        const body = (
          <div
            className={cn(
              "flex items-center gap-3 rounded-sm border-2 border-ink p-3 shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-gold-200",
              n.read_at ? "bg-parchment" : "bg-gold-100"
            )}
          >
            <span
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border-2 border-ink",
                n.read_at ? "bg-wood-200 text-wood-700" : "bg-gold-400 text-ink"
              )}
            >
              <Bell className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">{n.message}</p>
              <p className="mt-0.5 font-mono text-xs text-wood-600">
                {formatDateTime(n.created_at)}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-wood-600" />
          </div>
        );

        // A notification tied to one lead opens it; summary notifications
        // ("N nye leads") send the seller to their day's leads.
        const href = n.lead_id ? `/leads/${n.lead_id}` : "/today";

        return (
          <Link key={n.id} href={href} className="block">
            {body}
          </Link>
        );
      })}
    </div>
  );
}
