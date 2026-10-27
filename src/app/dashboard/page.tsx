"use client";

import Link from "next/link";
import { Skeleton, StatusBadge } from "@/components/ui";
import { useRequireRole } from "@/components/useRequireRole";
import { formatMoney } from "@/lib/money";
import {
  addDays,
  formatDate,
  formatDay,
  formatTime,
  minutesToHHMM,
  tzAbbrev,
  WEEKDAYS,
  weekdayOf,
  zonedDate,
  zonedMinutes,
} from "@/lib/time";
import type { BookingView, DashboardData } from "@/lib/types";
import { apiErrorOf, useGetDashboardQuery } from "@/store/api";

export default function DashboardPage() {
  const { ready, user } = useRequireRole("provider");
  const { data, isLoading, error, refetch, fulfilledTimeStamp } = useGetDashboardQuery(user?.providerSlug ?? "", {
    skip: !ready,
    pollingInterval: 60_000,
  });

  if (!ready || isLoading) {
    return (
      <div className="container-page space-y-4 py-10">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="container-page py-16 text-center">
        <p className="font-semibold">{apiErrorOf(error)?.message ?? "Couldn't load your dashboard"}</p>
        <button className="btn-ghost mt-4" onClick={() => refetch()}>
          Try again
        </button>
      </div>
    );
  }

  const { provider: p, stats } = data;
  const delta = stats.earningsLastMonth.amountMinor
    ? (stats.earningsThisMonth.amountMinor - stats.earningsLastMonth.amountMinor) / stats.earningsLastMonth.amountMinor
    : null;

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">
            {formatDate(new Date(), p.timezone)} · {tzAbbrev(p.timezone)}
          </p>
          <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
        </div>
        <div className="flex gap-2">
          <Link href={`/providers/${p.slug}`} className="btn-ghost">
            View public page
          </Link>
          <Link href="/dashboard/availability" className="btn-primary">
            Edit availability
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi label="Today" value={String(stats.todayCount)} hint={stats.todayCount === 1 ? "appointment" : "appointments"} />
        <Kpi label="Next 7 days" value={String(stats.upcoming7d)} hint="confirmed bookings" />
        <Kpi
          label="Earned so far this month"
          value={formatMoney(stats.earningsThisMonth, { compact: true })}
          hint={
            delta === null
              ? "no bookings last month"
              : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(delta * 100))}% vs ${formatMoney(stats.earningsLastMonth, { compact: true })} last month`
          }
          tone={delta === null ? undefined : delta >= 0 ? "up" : "down"}
        />
        <Kpi label="Cancellation rate" value={`${Math.round(stats.cancellationRate * 100)}%`} hint="last 30 days" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <WeekCalendar data={data} />
        <div className="space-y-6">
          <EarningsChart data={data} />
          <section className="card p-5">
            <h2 className="font-semibold">Up next</h2>
            {data.upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No upcoming bookings.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {data.upcoming.slice(0, 5).map((b) => (
                  <li key={b.id} className="flex items-start justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{b.customer.name}</p>
                      <p className="truncate text-muted">{b.serviceName}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-medium">{formatTime(b.startUtc, p.timezone)}</p>
                      <p className="text-xs text-muted">{formatDate(b.startUtc, p.timezone, "short")}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
      {fulfilledTimeStamp && (
        <p className="mt-4 text-xs text-muted">
          Updated {new Date(fulfilledTimeStamp).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}.
          Refreshes every minute.
        </p>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "up" | "down" }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
      <p className={`mt-1 text-xs ${tone === "up" ? "text-brand-700" : tone === "down" ? "text-danger" : "text-muted"}`}>
        {hint}
      </p>
    </div>
  );
}

const HOUR_PX = 44;

function WeekCalendar({ data }: { data: DashboardData }) {
  const p = data.provider;
  const today = zonedDate(Date.now(), p.timezone);
  const monday = addDays(today, -((weekdayOf(today) + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));

  const open = Object.values(p.hours).filter(Boolean) as { start: number; end: number }[];
  const startH = Math.floor(Math.min(...open.map((h) => h.start), 9 * 60) / 60);
  const endH = Math.ceil(Math.max(...open.map((h) => h.end), 17 * 60) / 60);
  const hours = Array.from({ length: endH - startH }, (_, i) => startH + i);

  const byDay = new Map<string, BookingView[]>();
  for (const b of data.week) {
    const d = zonedDate(b.startUtc, p.timezone);
    byDay.set(d, [...(byDay.get(d) ?? []), b]);
  }

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-line p-5">
        <h2 className="font-semibold">This week</h2>
        <span className="text-sm text-muted">
          {formatDay(days[0])} – {formatDay(days[6])}
        </span>
      </div>

      {/* Phones get an agenda list; a 7-column grid is unreadable at 360px. */}
      <ul className="divide-y divide-line md:hidden">
        {days.map((d) => {
          const items = (byDay.get(d) ?? []).sort((a, b) => a.startUtc.localeCompare(b.startUtc));
          return (
            <li key={d} className="p-4">
              <p className={`text-sm font-semibold ${d === today ? "text-brand-700" : ""}`}>
                {formatDay(d, "long")} {d === today && "· Today"}
              </p>
              {items.length === 0 ? (
                <p className="mt-1 text-sm text-muted">{p.hours[weekdayOf(d)] ? "No bookings" : "Closed"}</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {items.map((b) => (
                    <li key={b.id} className="flex justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">
                      <span className="truncate">
                        {b.customer.name} · {b.serviceName}
                      </span>
                      <span className="shrink-0 font-medium">{formatTime(b.startUtc, p.timezone)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto md:block">
        <div className="grid min-w-[44rem] grid-cols-[3rem_repeat(7,1fr)]">
          <div />
          {days.map((d) => (
            <div
              key={d}
              className={`border-b border-l border-line py-2 text-center text-xs ${d === today ? "bg-brand-50 font-semibold text-brand-700" : "text-muted"}`}
            >
              {WEEKDAYS[weekdayOf(d)].slice(0, 3)} {Number(d.slice(8))}
            </div>
          ))}

          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted" style={{ top: i * HOUR_PX }}>
                {i > 0 && minutesToHHMM(h * 60)}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayHours = p.hours[weekdayOf(d)];
            return (
              <div key={d} className="relative border-l border-line" style={{ height: hours.length * HOUR_PX }}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: i * HOUR_PX }} />
                ))}
                {!dayHours && <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,#f6f7f4,#f6f7f4_6px,#fff_6px,#fff_12px)]" />}
                {(byDay.get(d) ?? []).map((b) => {
                  const top = ((zonedMinutes(b.startUtc, p.timezone) - startH * 60) / 60) * HOUR_PX;
                  const height = Math.max((b.durationMin / 60) * HOUR_PX - 2, 18);
                  return (
                    <div
                      key={b.id}
                      className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-[11px] leading-tight"
                      style={{ top, height, borderColor: p.accent, background: `${p.accent}18` }}
                      title={`${b.customer.name} · ${b.serviceName} · ${formatTime(b.startUtc, p.timezone)}`}
                    >
                      <p className="truncate font-semibold">{b.customer.name.split(" ")[0]}</p>
                      {height > 30 && <p className="truncate text-muted">{formatTime(b.startUtc, p.timezone)}</p>}
                      {b.status !== "confirmed" && <StatusBadge status={b.status} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function EarningsChart({ data }: { data: DashboardData }) {
  const max = Math.max(...data.weeklyEarnings.map((w) => w.amount.amountMinor), 1);
  const total = data.weeklyEarnings.reduce((s, w) => s + w.amount.amountMinor, 0);
  return (
    <section className="card p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Earnings</h2>
        <span className="text-xs text-muted">last 8 weeks</span>
      </div>
      <p className="mt-1 text-xl font-bold">
        {formatMoney({ amountMinor: total, currency: data.provider.currency }, { compact: true })}
      </p>
      <div className="mt-4 flex h-32 items-end gap-1.5" role="img" aria-label="Weekly earnings bar chart">
        {data.weeklyEarnings.map((w, i) => {
          const pct = (w.amount.amountMinor / max) * 100;
          const current = i === data.weeklyEarnings.length - 1;
          return (
            <div key={w.weekStart} className="group relative flex h-full flex-1 flex-col justify-end">
              <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
                {formatMoney(w.amount, { compact: true })}
              </span>
              <div
                className={`rounded-t-md ${current ? "bg-brand-600" : "bg-brand-100 group-hover:bg-brand-500"}`}
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted">
        <span>{formatDay(data.weeklyEarnings[0].weekStart)}</span>
        <span>This week</span>
      </div>
    </section>
  );
}
