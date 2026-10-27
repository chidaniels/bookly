"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, formatDay, formatTime, tzAbbrev, tzOffsetMs, WEEKDAYS, weekdayOf, zonedDate } from "@/lib/time";
import type { Slot } from "@/lib/types";
import { apiErrorOf, useGetSlotsQuery } from "@/store/api";
import { Skeleton } from "./ui";

interface Props {
  slug: string;
  timezone: string;
  serviceId: string;
  /** When rescheduling, the booking's own slot must not count as taken. */
  ignoreBookingId?: string;
  selected: Slot | null;
  onSelect: (slot: Slot | null) => void;
}

const DAYS_AHEAD = 14;

export function SlotPicker({ slug, timezone, serviceId, ignoreBookingId, selected, onSelect }: Props) {
  const today = useMemo(() => zonedDate(Date.now(), timezone), [timezone]);
  const days = useMemo(() => Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(today, i)), [today]);
  const [date, setDate] = useState(today);

  // The viewer's timezone is only known in the browser; read it after mount to keep SSR markup stable.
  const [viewerTz, setViewerTz] = useState<string | null>(null);
  useEffect(() => setViewerTz(Intl.DateTimeFormat().resolvedOptions().timeZone), []);
  const differentTz = viewerTz !== null && tzOffsetMs(viewerTz, Date.now()) !== tzOffsetMs(timezone, Date.now());

  const { data, isFetching, isLoading, error, refetch } = useGetSlotsQuery(
    { slug, serviceId, date, ignore: ignoreBookingId },
    // Refresh while the customer is deciding, so slots others take disappear.
    { pollingInterval: 30_000, skipPollingIfUnfocused: true },
  );
  const slots = data ?? [];
  const open = slots.filter((s) => s.available).length;

  const pickDate = (d: string) => {
    setDate(d);
    onSelect(null);
  };

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Choose a date">
        {days.map((d) => {
          const active = d === date;
          const weekday = WEEKDAYS[weekdayOf(d)].slice(0, 3);
          return (
            <button
              key={d}
              role="option"
              aria-selected={active}
              onClick={() => pickDate(d)}
              className={`flex w-14 shrink-0 flex-col items-center rounded-xl border py-2 text-xs ${
                active ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-500"
              }`}
            >
              <span className={active ? "text-white/80" : "text-muted"}>{d === today ? "Today" : weekday}</span>
              <span className="text-lg font-semibold">{Number(d.slice(8))}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-muted">
        <span>
          {formatDay(date, "long")} · times in {tzAbbrev(timezone)}
        </span>
        {isFetching && !isLoading && <span>Updating…</span>}
      </div>

      <div className="mt-3 min-h-28">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }, (_, i) => (
              <Skeleton key={i} className="h-11" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-danger">
            {apiErrorOf(error)?.message}{" "}
            <button onClick={() => refetch()} className="font-semibold underline">
              Try again
            </button>
          </div>
        ) : slots.length === 0 || open === 0 ? (
          <div className="rounded-xl bg-canvas p-4 text-center text-sm text-muted">
            {slots.length === 0 ? "No bookable times on this day." : "Fully booked on this day."}{" "}
            <button
              className="font-semibold text-brand-700 underline"
              onClick={() => {
                const i = days.indexOf(date);
                if (i < days.length - 1) pickDate(days[i + 1]);
              }}
            >
              Next day →
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((s) => {
              const isSel = selected?.startUtc === s.startUtc;
              return (
                <button
                  key={s.startUtc}
                  disabled={!s.available}
                  onClick={() => onSelect(isSel ? null : s)}
                  aria-pressed={isSel}
                  className={`rounded-xl border px-2 py-2.5 text-sm font-medium ${
                    isSel
                      ? "border-brand-600 bg-brand-600 text-white"
                      : s.available
                        ? "border-line bg-white hover:border-brand-500"
                        : "cursor-not-allowed border-line bg-canvas text-muted/60 line-through"
                  }`}
                >
                  {formatTime(s.startUtc, timezone)}
                  {differentTz && viewerTz && (
                    <span className={`block text-[10px] font-normal ${isSel ? "text-white/80" : "text-muted"}`}>
                      {formatTime(s.startUtc, viewerTz)} yours
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
