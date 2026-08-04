"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Monitor, MonitorOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const noopSubscribe = () => () => {};
const isWakeLockSupported = () =>
  typeof navigator !== "undefined" && "wakeLock" in navigator;

/**
 * "TV-modus": holds the screen awake via the Screen Wake Lock API so the
 * dashboard doesn't dim/sleep when left on a TV or wall display. It's a manual
 * toggle (not automatic) so a normal laptop viewer's screen can still sleep —
 * you flip it on once on the TV. The lock is dropped when the tab is hidden, so
 * we re-acquire it whenever the page becomes visible again.
 */
export function KeepAwake() {
  const [on, setOn] = useState(false);
  const lockRef = useRef<WakeLockSentinel | null>(null);
  // Server renders `false` (no navigator) → nothing shown; the client swaps in
  // the real value after hydration without a mismatch warning.
  const supported = useSyncExternalStore(noopSubscribe, isWakeLockSupported, () => false);

  const acquire = useCallback(async () => {
    try {
      lockRef.current = await navigator.wakeLock.request("screen");
    } catch {
      // Acquire can fail if the tab isn't visible or the device refuses; the
      // visibility listener retries when the page comes back to the foreground.
    }
  }, []);

  useEffect(() => {
    if (!on) return;

    void acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      lockRef.current?.release().catch(() => {});
      lockRef.current = null;
    };
  }, [on, acquire]);

  if (!supported) return null;

  return (
    <Button
      type="button"
      variant={on ? "default" : "outline"}
      size="sm"
      onClick={() => setOn((v) => !v)}
      title={
        on
          ? "Skjermen holdes våken (skru av for å la enheten sove som normalt)"
          : "Hold skjermen våken – for dashbord på TV/vegg-skjerm"
      }
      aria-pressed={on}
    >
      {on ? <Monitor className="h-4 w-4" /> : <MonitorOff className="h-4 w-4" />}
      {on ? "TV-modus på" : "TV-modus"}
    </Button>
  );
}
