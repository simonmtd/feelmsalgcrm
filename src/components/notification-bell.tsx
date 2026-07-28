import Link from "next/link";
import { Bell } from "lucide-react";

/** Header bell linking to the notifications page, with an unread-count badge. */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      title={unread > 0 ? `${unread} uleste varsler` : "Varsler"}
      className="relative flex h-11 w-11 items-center justify-center rounded-sm border-2 border-ink bg-parchment text-wood-800 shadow-[3px_3px_0_0_var(--color-ink)] transition-colors hover:bg-gold-100"
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-ink bg-red-400 px-1 font-mono text-[10px] font-bold text-ink">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
