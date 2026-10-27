"use client";

import { useEffect, useState } from "react";

export function HoldTimer({ expiresAt, paused, onExpire }: { expiresAt: string; paused: boolean; onExpire: () => void }) {
  const deadline = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paused]);

  const left = Math.max(0, deadline - now);
  useEffect(() => {
    if (!paused && left === 0) onExpire();
  }, [left, paused, onExpire]);

  const mm = String(Math.floor(left / 60_000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60_000) / 1000)).padStart(2, "0");
  const urgent = left < 60_000;

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm ${
        urgent ? "bg-red-50 text-danger" : "bg-amber-50 text-amber-900"
      }`}
      role="timer"
      aria-live={urgent ? "polite" : "off"}
    >
      <span>{paused ? "Slot held while we confirm your payment" : "Slot held for you"}</span>
      {!paused && <span className="font-mono text-base font-semibold">{mm}:{ss}</span>}
    </div>
  );
}
