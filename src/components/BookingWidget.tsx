"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatMoney } from "@/lib/money";
import { formatDate, formatTime } from "@/lib/time";
import type { Service, Slot } from "@/lib/types";
import { apiErrorOf, useCreateHoldMutation } from "@/store/api";
import { useAppSelector } from "@/store/hooks";
import { SlotPicker } from "./SlotPicker";
import { Spinner } from "./ui";

interface Props {
  provider: { slug: string; name: string; timezone: string; services: Service[] };
  initialServiceId?: string;
}

export function BookingWidget({ provider, initialServiceId }: Props) {
  const router = useRouter();
  const user = useAppSelector((s) => s.session.user);
  const [serviceId, setServiceId] = useState(
    provider.services.some((s) => s.id === initialServiceId) ? initialServiceId! : provider.services[0].id,
  );
  const [slot, setSlot] = useState<Slot | null>(null);
  const [createHold, { isLoading, error, reset }] = useCreateHoldMutation();
  const service = provider.services.find((s) => s.id === serviceId)!;

  const hold = async () => {
    if (!slot) return;
    if (user?.role !== "customer") {
      const here = `/providers/${provider.slug}?service=${serviceId}`;
      router.push(`/login?next=${encodeURIComponent(here)}`);
      return;
    }
    const res = await createHold({
      providerSlug: provider.slug,
      serviceId,
      startUtc: slot.startUtc,
      customer: { name: user.name, email: user.email },
    });
    if ("data" in res && res.data) router.push(`/book/${res.data.id}`);
    else setSlot(null);
  };

  const err = apiErrorOf(error);

  return (
    <div className="card p-5 shadow-sm">
      <h2 className="text-lg font-semibold">Book an appointment</h2>

      <fieldset className="mt-4 space-y-2">
        <legend className="label">Service</legend>
        {provider.services.map((s) => (
          <label
            key={s.id}
            className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
              s.id === serviceId ? "border-brand-500 bg-brand-50" : "border-line"
            }`}
          >
            <span className="flex items-center gap-3">
              <input
                type="radio"
                name="service"
                className="accent-brand-600"
                checked={s.id === serviceId}
                onChange={() => {
                  setServiceId(s.id);
                  setSlot(null);
                  reset();
                }}
              />
              <span>
                <span className="block font-medium">{s.name}</span>
                <span className="text-xs text-muted">{s.durationMin} min</span>
              </span>
            </span>
            <span className="font-semibold">{formatMoney(s.price, { compact: true })}</span>
          </label>
        ))}
      </fieldset>

      <div className="mt-5">
        <p className="label">Date & time</p>
        <SlotPicker
          slug={provider.slug}
          timezone={provider.timezone}
          serviceId={serviceId}
          selected={slot}
          onSelect={(s) => {
            setSlot(s);
            reset();
          }}
        />
      </div>

      {err && (
        <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-danger">
          {err.message}
        </p>
      )}

      <div className="mt-5 border-t border-line pt-4">
        {slot ? (
          <p className="mb-3 text-sm">
            <span className="font-medium">{formatDate(slot.startUtc, provider.timezone)}</span> at{" "}
            <span className="font-medium">{formatTime(slot.startUtc, provider.timezone)}</span>
          </p>
        ) : (
          <p className="mb-3 text-sm text-muted">Pick a time to continue.</p>
        )}
        <button className="btn-primary w-full py-3" disabled={!slot || isLoading} onClick={hold}>
          {isLoading ? (
            <>
              <Spinner /> Holding your slot…
            </>
          ) : user?.role === "provider" ? (
            "Sign in as a customer to book"
          ) : (
            <>Continue · {formatMoney(service.price)}</>
          )}
        </button>
        <p className="mt-2 text-center text-xs text-muted">We hold your slot for 5 minutes while you pay.</p>
      </div>
    </div>
  );
}
