"use client";

import Link from "next/link";
import { useState } from "react";
import { Modal } from "@/components/Modal";
import { SlotPicker } from "@/components/SlotPicker";
import { Skeleton, Spinner, StatusBadge } from "@/components/ui";
import { useRequireRole } from "@/components/useRequireRole";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime, tzAbbrev } from "@/lib/time";
import type { BookingView, Slot } from "@/lib/types";
import { apiErrorOf, useGetMyBookingsQuery, useUpdateBookingMutation } from "@/store/api";

type Dialog = { kind: "cancel" | "reschedule"; booking: BookingView } | null;

export default function MyBookingsPage() {
  const { ready } = useRequireRole("customer");
  const { data, isLoading, error, refetch } = useGetMyBookingsQuery(undefined, { skip: !ready });
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const now = Date.now();
  const all = data ?? [];
  const upcoming = all.filter((b) => b.status === "confirmed" && new Date(b.endUtc).getTime() > now);
  const past = all.filter((b) => !upcoming.includes(b)).reverse();
  const list = tab === "upcoming" ? upcoming : past;

  return (
    <div className="container-page max-w-3xl py-10">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">My bookings</h1>
        <Link href="/services" className="btn-primary">
          Book again
        </Link>
      </div>

      {notice && (
        <div className="mt-6 flex items-start justify-between gap-4 rounded-xl bg-brand-50 p-4 text-sm text-brand-900" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss">
            ✕
          </button>
        </div>
      )}

      <div className="mt-6 inline-flex rounded-xl bg-white p-1 text-sm font-semibold shadow-sm" role="tablist">
        {(
          [
            ["upcoming", `Upcoming (${upcoming.length})`],
            ["past", `Past & cancelled (${past.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 ${tab === key ? "bg-brand-600 text-white" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {!ready || isLoading ? (
          Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-32" />)
        ) : error ? (
          <div className="card p-6 text-sm text-danger">
            {apiErrorOf(error)?.message}{" "}
            <button className="font-semibold underline" onClick={() => refetch()}>
              Try again
            </button>
          </div>
        ) : list.length === 0 ? (
          <div className="card p-10 text-center">
            <p className="font-semibold">{tab === "upcoming" ? "No upcoming bookings" : "Nothing here yet"}</p>
            <p className="mt-1 text-sm text-muted">When you book something, it will show up here.</p>
          </div>
        ) : (
          list.map((b) => (
            <BookingRow
              key={b.id}
              b={b}
              upcoming={tab === "upcoming"}
              onCancel={() => setDialog({ kind: "cancel", booking: b })}
              onReschedule={() => setDialog({ kind: "reschedule", booking: b })}
            />
          ))
        )}
      </div>

      {dialog?.kind === "cancel" && (
        <CancelDialog
          booking={dialog.booking}
          onClose={() => setDialog(null)}
          onDone={(msg) => {
            setDialog(null);
            setNotice(msg);
          }}
        />
      )}
      {dialog?.kind === "reschedule" && (
        <RescheduleDialog
          booking={dialog.booking}
          onClose={() => setDialog(null)}
          onDone={(msg) => {
            setDialog(null);
            setNotice(msg);
          }}
        />
      )}
    </div>
  );
}

function BookingRow({
  b,
  upcoming,
  onCancel,
  onReschedule,
}: {
  b: BookingView;
  upcoming: boolean;
  onCancel: () => void;
  onReschedule: () => void;
}) {
  const tz = b.providerTimezone;
  const tooLateToMove = new Date(b.startUtc).getTime() - Date.now() < 2 * 3_600_000;
  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/bookings/${b.id}`} className="font-semibold hover:text-brand-700">
            {b.serviceName}
          </Link>
          <p className="text-sm text-muted">{b.providerName}</p>
        </div>
        <StatusBadge status={b.status} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>{formatDate(b.startUtc, tz)}</span>
        <span>
          {formatTime(b.startUtc, tz)} {tzAbbrev(tz)}
        </span>
        <span className="font-semibold">{formatMoney(b.price)}</span>
        {b.refund && <span className="text-brand-700">Refunded {formatMoney(b.refund)}</span>}
      </div>
      {upcoming && (
        <div className="mt-4 flex gap-2 border-t border-line pt-4">
          <button
            className="btn-ghost py-2"
            onClick={onReschedule}
            disabled={tooLateToMove}
            title={tooLateToMove ? "Can't move within 2 hours of the start" : undefined}
          >
            Reschedule
          </button>
          <button className="btn-danger py-2" onClick={onCancel}>
            Cancel
          </button>
        </div>
      )}
    </article>
  );
}

function CancelDialog({ booking, onClose, onDone }: { booking: BookingView; onClose: () => void; onDone: (m: string) => void }) {
  const [update, { isLoading, error }] = useUpdateBookingMutation();
  const full = new Date(booking.startUtc).getTime() - Date.now() > 86_400_000;
  const refund = full ? booking.price : { ...booking.price, amountMinor: Math.round(booking.price.amountMinor / 2) };

  const confirm = async () => {
    const res = await update({ id: booking.id, action: "cancel" });
    // Show the refund the server actually issued, not the estimate.
    if ("data" in res && res.data) {
      onDone(`Booking cancelled. ${res.data.refund ? `${formatMoney(res.data.refund)} is on its way back to you.` : ""}`);
    }
  };

  return (
    <Modal title="Cancel this booking?" onClose={onClose}>
      <p className="text-sm text-muted">
        {booking.serviceName} with {booking.providerName} on {formatDate(booking.startUtc, booking.providerTimezone)}.
      </p>
      <div className="mt-4 rounded-xl bg-canvas p-4 text-sm">
        <div className="flex justify-between">
          <span>You paid</span>
          <span>{formatMoney(booking.price)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Estimated refund</span>
          <span>{formatMoney(refund)}</span>
        </div>
        {!full && <p className="mt-2 text-xs text-muted">Less than 24 hours to go, so 50% is refunded.</p>}
      </div>
      {error && <p className="field-error">{apiErrorOf(error)?.message}</p>}
      <div className="mt-5 flex gap-2">
        <button className="btn-ghost flex-1" onClick={onClose}>
          Keep booking
        </button>
        <button className="btn flex-1 bg-danger text-white hover:bg-red-800" onClick={confirm} disabled={isLoading}>
          {isLoading ? <Spinner /> : "Cancel booking"}
        </button>
      </div>
    </Modal>
  );
}

function RescheduleDialog({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingView;
  onClose: () => void;
  onDone: (m: string) => void;
}) {
  const [slot, setSlot] = useState<Slot | null>(null);
  const [update, { isLoading, error, reset }] = useUpdateBookingMutation();
  const tz = booking.providerTimezone;

  const confirm = async () => {
    if (!slot) return;
    const res = await update({ id: booking.id, action: "reschedule", startUtc: slot.startUtc });
    if ("data" in res && res.data) {
      onDone(`Moved to ${formatDate(res.data.startUtc, tz)} at ${formatTime(res.data.startUtc, tz)}. No extra charge.`);
    } else setSlot(null);
  };

  return (
    <Modal title="Pick a new time" onClose={onClose}>
      <p className="mb-4 text-sm text-muted">
        Currently {formatDate(booking.startUtc, tz, "short")} at {formatTime(booking.startUtc, tz)}. Moving is free.
      </p>
      <SlotPicker
        slug={booking.providerSlug}
        timezone={tz}
        serviceId={booking.serviceId}
        ignoreBookingId={booking.id}
        selected={slot}
        onSelect={(s) => {
          setSlot(s);
          reset();
        }}
      />
      {error && <p className="field-error">{apiErrorOf(error)?.message}</p>}
      <button className="btn-primary mt-5 w-full py-3" disabled={!slot || isLoading} onClick={confirm}>
        {isLoading ? <Spinner /> : slot ? `Move to ${formatTime(slot.startUtc, tz)}` : "Choose a time"}
      </button>
    </Modal>
  );
}
