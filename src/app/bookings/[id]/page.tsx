"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Skeleton, StatusBadge } from "@/components/ui";
import { useRequireRole } from "@/components/useRequireRole";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime, tzAbbrev } from "@/lib/time";
import type { BookingView } from "@/lib/types";
import { apiErrorOf, useGetBookingQuery } from "@/store/api";

function icsFor(b: BookingView) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bookly//EN",
    "BEGIN:VEVENT",
    `UID:${b.id}@bookly`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.startUtc)}`,
    `DTEND:${stamp(b.endUtc)}`,
    `SUMMARY:${b.serviceName} with ${b.providerName}`,
    `LOCATION:${b.providerCity}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

function Confirmation() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().get("new") === "1";
  const { ready } = useRequireRole("customer");
  const { data: b, error, isLoading } = useGetBookingQuery(id, { skip: !ready });

  if (!ready || isLoading) {
    return (
      <div className="container-page max-w-2xl py-10">
        <Skeleton className="h-96" />
      </div>
    );
  }
  if (error || !b) {
    return (
      <div className="container-page py-16 text-center">
        <p className="font-semibold">{apiErrorOf(error)?.message ?? "Booking not found"}</p>
        <Link href="/bookings" className="btn-ghost mt-4">
          My bookings
        </Link>
      </div>
    );
  }

  const tz = b.providerTimezone;
  const confirmed = b.status === "confirmed";

  return (
    <div className="container-page max-w-2xl py-10">
      {isNew && confirmed && (
        <div className="mb-6 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-600 text-2xl text-white">✓</span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">You&apos;re booked!</h1>
          <p className="mt-1 text-muted">
            We&apos;ve sent the details to {b.customer.email}. {b.providerName} will see you then.
          </p>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b border-line p-5">
          <div>
            <p className="text-sm text-muted">{b.providerName}</p>
            <h2 className="text-lg font-semibold">{b.serviceName}</h2>
          </div>
          <StatusBadge status={b.status} />
        </div>
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Date</dt>
            <dd className="font-medium">{formatDate(b.startUtc, tz)}</dd>
          </div>
          <div>
            <dt className="text-muted">Time</dt>
            <dd className="font-medium">
              {formatTime(b.startUtc, tz)} – {formatTime(b.endUtc, tz)} {tzAbbrev(tz)}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Where</dt>
            <dd className="font-medium">{b.providerCity}</dd>
          </div>
          <div>
            <dt className="text-muted">Booking reference</dt>
            <dd className="font-mono text-xs font-medium">{b.id.toUpperCase()}</dd>
          </div>
        </dl>
        <div className="space-y-2 border-t border-line bg-canvas p-5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Paid</span>
            <span className="font-semibold">{confirmed || b.status === "cancelled" ? formatMoney(b.price) : "Not paid"}</span>
          </div>
          {b.refund && (
            <div className="flex justify-between">
              <span className="text-muted">Refund issued</span>
              <span className="font-semibold text-brand-700">{formatMoney(b.refund)}</span>
            </div>
          )}
          {b.paymentId && confirmed && (
            <div className="flex justify-between">
              <span className="text-muted">Payment reference</span>
              <span className="font-mono text-xs">{b.paymentId.toUpperCase()}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        {confirmed && (
          <a href={icsFor(b)} download={`bookly-${b.id}.ics`} className="btn-ghost flex-1">
            Add to calendar
          </a>
        )}
        <Link href="/bookings" className="btn-primary flex-1">
          Manage my bookings
        </Link>
      </div>
    </div>
  );
}

export default function BookingPage() {
  return (
    <Suspense>
      <Confirmation />
    </Suspense>
  );
}
