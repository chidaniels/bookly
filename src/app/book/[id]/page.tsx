"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { HoldTimer } from "@/components/HoldTimer";
import { Skeleton, Spinner } from "@/components/ui";
import { useRequireRole } from "@/components/useRequireRole";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime, tzAbbrev } from "@/lib/time";
import { apiErrorOf, useGetBookingQuery, useUpdateBookingMutation } from "@/store/api";
import {
  checkoutReset,
  checkoutStarted,
  invalidateAfterPayment,
  loadCheckout,
  payBooking,
  pollPayment,
  retryAfterFailure,
  type PayPhase,
} from "@/store/checkoutSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

const phoneRe = /^(?:\+?234|0)[789][01]\d{8}$|^(?:\+?233|0)[235]\d{8}$/;

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().email(),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => phoneRe.test(v), "Enter a Nigerian or Ghanaian mobile number, e.g. 0803 123 4567"),
  note: z.string().trim().max(300, "Keep notes under 300 characters").optional(),
  agree: z.boolean().refine((v) => v, "Please accept the cancellation policy"),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

const LOCKED: PayPhase[] = ["submitting", "processing", "unknown", "succeeded", "mismatch"];

export default function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { ready, user } = useRequireRole("customer");
  const { data: booking, error, isLoading, refetch } = useGetBookingQuery(id, { skip: !ready });
  const checkout = useAppSelector((s) => s.checkout);
  const [release, { isLoading: releasing }] = useUpdateBookingMutation();

  const active = checkout.bookingId === id;
  const phase: PayPhase = active ? checkout.phase : "idle";
  const locked = LOCKED.includes(phase);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    values: { name: user?.name ?? "", email: user?.email ?? "", phone: "", note: "", agree: false },
    resetOptions: { keepDirtyValues: true },
  });

  // Enter (or resume) checkout once we know the server's price for this booking.
  useEffect(() => {
    if (!booking || (booking.status !== "held" && booking.status !== "pending_payment")) return;
    const restored = loadCheckout();
    dispatch(checkoutStarted({ bookingId: booking.id, quoted: booking.price, restored }));
    // Refreshed mid-payment: don't offer the button again, find out what happened first.
    if (restored?.bookingId === booking.id && ["submitting", "processing", "unknown"].includes(restored.phase ?? "")) {
      dispatch(pollPayment());
    }
  }, [booking, dispatch]);

  useEffect(() => {
    if (booking?.status === "confirmed" && !active) router.replace(`/bookings/${id}`);
  }, [booking?.status, active, id, router]);

  useEffect(() => {
    if (phase !== "succeeded") return;
    dispatch(invalidateAfterPayment(id));
    router.replace(`/bookings/${id}?new=1`);
    return () => {
      dispatch(checkoutReset());
    };
  }, [phase, id, dispatch, router]);

  const onExpire = useCallback(() => {
    refetch();
  }, [refetch]);

  if (!ready || isLoading) {
    return (
      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-96" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="container-page py-16 text-center">
        <p className="font-semibold">{apiErrorOf(error)?.message ?? "Booking not found"}</p>
        <Link href="/services" className="btn-ghost mt-4">
          Browse services
        </Link>
      </div>
    );
  }

  const expired = booking.status === "expired" || booking.status === "cancelled" || phase === "expired";
  const tz = booking.providerTimezone;
  const total = formatMoney(booking.price);

  const changeTime = async () => {
    if (booking.status === "held") await release({ id, action: "release" });
    dispatch(checkoutReset());
    router.push(`/providers/${booking.providerSlug}?service=${booking.serviceId}`);
  };

  return (
    <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_24rem]">
      <section className="card p-6">
        <h1 className="text-2xl font-bold tracking-tight">Confirm and pay</h1>

        {expired ? (
          <div className="mt-6 rounded-xl bg-canvas p-6 text-center">
            <p className="font-semibold">Your hold on this slot has expired</p>
            <p className="mt-1 text-sm text-muted">
              {checkout.message ?? "You weren't charged. The time may still be free, so pick it again."}
            </p>
            <Link
              href={`/providers/${booking.providerSlug}?service=${booking.serviceId}`}
              className="btn-primary mt-4"
              onClick={() => dispatch(checkoutReset())}
            >
              Pick a new time
            </Link>
          </div>
        ) : (
          <form
            className="mt-6 space-y-4"
            noValidate
            onSubmit={handleSubmit((v) =>
              dispatch(payBooking({ customer: { name: v.name, email: v.email, phone: v.phone, note: v.note || undefined } })),
            )}
          >
            <fieldset disabled={locked} className="space-y-4 disabled:opacity-70">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="name" className="label">
                    Full name
                  </label>
                  <input id="name" className="input" aria-invalid={!!errors.name} {...register("name")} />
                  {errors.name && <p className="field-error">{errors.name.message}</p>}
                </div>
                <div>
                  <label htmlFor="email" className="label">
                    Email
                  </label>
                  <input id="email" className="input bg-canvas" readOnly {...register("email")} />
                </div>
              </div>
              <div>
                <label htmlFor="phone" className="label">
                  Mobile number
                </label>
                <input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0803 123 4567"
                  className="input"
                  aria-invalid={!!errors.phone}
                  {...register("phone")}
                />
                {errors.phone ? (
                  <p className="field-error">{errors.phone.message}</p>
                ) : (
                  <p className="mt-1.5 text-xs text-muted">The provider will only use this if they&apos;re running late.</p>
                )}
              </div>
              <div>
                <label htmlFor="note" className="label">
                  Note for the provider <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea id="note" rows={3} className="input" aria-invalid={!!errors.note} {...register("note")} />
                {errors.note && <p className="field-error">{errors.note.message}</p>}
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input type="checkbox" className="mt-0.5 accent-brand-600" {...register("agree")} />
                <span>
                  I understand I can cancel for a full refund up to 24 hours before, or a 50% refund after that.
                  {errors.agree && <span className="field-error block">{errors.agree.message}</span>}
                </span>
              </label>
            </fieldset>

            <PaymentStatus phase={phase} message={checkout.message} polling={checkout.polling} />

            {phase === "failed" ? (
              <button type="button" className="btn-primary w-full py-3.5" onClick={() => dispatch(retryAfterFailure())}>
                Try a new payment
              </button>
            ) : phase === "mismatch" || phase === "unknown" ? (
              <button
                type="button"
                className="btn-ghost w-full py-3.5"
                disabled={checkout.polling}
                onClick={() => dispatch(pollPayment())}
              >
                {checkout.polling ? (
                  <>
                    <Spinner /> Checking with the server…
                  </>
                ) : (
                  "Check payment status"
                )}
              </button>
            ) : (
              <button className="btn-primary w-full py-3.5 text-base" disabled={locked || !active}>
                {phase === "submitting" ? (
                  <>
                    <Spinner /> Sending payment…
                  </>
                ) : phase === "processing" ? (
                  <>
                    <Spinner /> Confirming…
                  </>
                ) : phase === "succeeded" ? (
                  "Paid ✓"
                ) : (
                  `Pay ${total}`
                )}
              </button>
            )}
            <p className="text-center text-xs text-muted">
              Demo payment: no card needed and no money moves. Use the Network lab to try failures.
            </p>
          </form>
        )}
      </section>

      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        {!expired && booking.holdExpiresAt && (
          <HoldTimer expiresAt={booking.holdExpiresAt} paused={locked} onExpire={onExpire} />
        )}
        <div className="card p-5">
          <p className="text-sm text-muted">{booking.providerName}</p>
          <p className="mt-1 font-semibold">{booking.serviceName}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Date</dt>
              <dd className="text-right">{formatDate(booking.startUtc, tz)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Time</dt>
              <dd className="text-right">
                {formatTime(booking.startUtc, tz)} – {formatTime(booking.endUtc, tz)} {tzAbbrev(tz)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">Where</dt>
              <dd className="text-right">{booking.providerCity}</dd>
            </div>
          </dl>
          <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-bold">{total}</span>
          </div>
          <p className="mt-1 text-right text-xs text-muted">Charged in {booking.price.currency}</p>
        </div>
        {!locked && !expired && (
          <button className="btn-ghost w-full" onClick={changeTime} disabled={releasing}>
            Change time
          </button>
        )}
      </aside>
    </div>
  );
}

function PaymentStatus({ phase, message, polling }: { phase: PayPhase; message: string | null; polling: boolean }) {
  if (phase === "processing") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-brand-50 p-4 text-sm text-brand-900" role="status">
        <Spinner className="h-5 w-5 text-brand-600" />
        <span>Payment sent. Waiting for your bank to confirm. Please keep this page open.</span>
      </div>
    );
  }
  if (phase === "unknown") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900" role="status">
        <p className="flex items-center gap-2 font-semibold">
          {polling && <Spinner />} We&apos;re not sure yet
        </p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }
  if (phase === "mismatch") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger" role="alert">
        <p className="font-semibold">We couldn&apos;t verify this payment</p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }
  if ((phase === "failed" || phase === "error") && message) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-danger" role="alert">
        <p className="font-semibold">{phase === "failed" ? "Payment failed" : "Payment not sent"}</p>
        <p className="mt-1">{message}</p>
      </div>
    );
  }
  return null;
}
