import Link from "next/link";
import { Bell } from "lucide-react";

/** Header bell linking to the notifications page, with an unread-count badge. */
export function NotificationBell({ unread }: { unread: number }) {
  return (
    <Link
      href="/notifications"
      title={unread > 0 ? `${unread} uleste varsler` : "Varsler"}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-brand-fg ring-2 ring-bg">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
