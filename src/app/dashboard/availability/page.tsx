"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Skeleton, Spinner } from "@/components/ui";
import { useRequireRole } from "@/components/useRequireRole";
import { hhmmToMinutes, minutesToHHMM, WEEKDAYS } from "@/lib/time";
import type { Provider, WeeklyHours } from "@/lib/types";
import { apiErrorOf, useGetProviderQuery, useUpdateAvailabilityMutation } from "@/store/api";

const time = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

const schema = z.object({
  slotStepMin: z.coerce.number().refine((v) => [15, 30, 60].includes(v)),
  days: z
    .array(
      z
        .object({ weekday: z.number(), open: z.boolean(), start: time, end: time })
        .refine((d) => !d.open || hhmmToMinutes(d.end) > hhmmToMinutes(d.start), {
          message: "Closing must be after opening",
          path: ["end"],
        }),
    )
    .length(7)
    .refine((days) => days.some((d) => d.open), { message: "Open at least one day a week" }),
});
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

// Monday-first, which is how providers in Lagos and Accra think about their week.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

function toForm(p: Provider): FormIn {
  return {
    slotStepMin: p.slotStepMin,
    days: ORDER.map((weekday) => {
      const h = p.hours[weekday];
      return { weekday, open: !!h, start: minutesToHHMM(h?.start ?? 540), end: minutesToHHMM(h?.end ?? 1020) };
    }),
  };
}

export default function AvailabilityPage() {
  const { ready, user } = useRequireRole("provider");
  const { data: provider, isLoading } = useGetProviderQuery(user?.providerSlug ?? "", { skip: !ready });

  if (!ready || isLoading || !provider) {
    return (
      <div className="container-page max-w-3xl space-y-4 py-10">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[28rem]" />
      </div>
    );
  }
  return <AvailabilityForm provider={provider} />;
}

function AvailabilityForm({ provider }: { provider: Provider }) {
  const [save, { isLoading, error }] = useUpdateAvailabilityMutation();
  const [saved, setSaved] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormIn, unknown, FormOut>({ resolver: zodResolver(schema), defaultValues: toForm(provider) });
  const { fields } = useFieldArray({ control, name: "days" });
  const days = useWatch({ control, name: "days" });

  const weeklyHours = days.reduce(
    (sum, d) => sum + (d.open ? Math.max(0, hhmmToMinutes(d.end) - hhmmToMinutes(d.start)) : 0),
    0,
  );

  const onSubmit = async (v: FormOut) => {
    const hours: WeeklyHours = Object.fromEntries(
      v.days.map((d) => [d.weekday, d.open ? { start: hhmmToMinutes(d.start), end: hhmmToMinutes(d.end) } : null]),
    );
    const res = await save({ slug: provider.slug, hours, slotStepMin: v.slotStepMin });
    if ("data" in res && res.data) {
      reset(toForm(res.data));
      setSaved(true);
    }
  };

  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="text-sm text-muted hover:text-ink">
        ← Dashboard
      </Link>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Availability</h1>
      <p className="mt-1 text-muted">
        Set when customers can book you. Times are in your local time ({provider.timezone.replace("Africa/", "")}).
        Existing bookings are not affected.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} onChange={() => setSaved(false)} className="card mt-6 divide-y divide-line" noValidate>
        {fields.map((field, i) => {
          const open = days[i]?.open;
          const err = errors.days?.[i];
          return (
            <div key={field.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <label className="flex w-40 items-center gap-3 font-medium">
                <input type="checkbox" className="h-4 w-4 accent-brand-600" {...register(`days.${i}.open`)} />
                {WEEKDAYS[field.weekday]}
              </label>
              {open ? (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    type="time"
                    step={900}
                    aria-label={`${WEEKDAYS[field.weekday]} opening time`}
                    className="input w-32"
                    {...register(`days.${i}.start`)}
                  />
                  <span className="text-muted">to</span>
                  <input
                    type="time"
                    step={900}
                    aria-label={`${WEEKDAYS[field.weekday]} closing time`}
                    className="input w-32"
                    aria-invalid={!!err?.end}
                    {...register(`days.${i}.end`)}
                  />
                  {err?.end && <p className="field-error w-full sm:w-auto">{err.end.message}</p>}
                </div>
              ) : (
                <span className="text-sm text-muted">Closed</span>
              )}
            </div>
          );
        })}

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label htmlFor="step" className="w-40 font-medium">
            Start times every
          </label>
          <select id="step" className="input w-40" {...register("slotStepMin")}>
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>60 minutes</option>
          </select>
        </div>

        <div className="flex flex-col gap-3 bg-canvas p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p>
              <strong>{Math.round((weeklyHours / 60) * 10) / 10} hours</strong> bookable per week
            </p>
            {errors.days?.root && <p className="field-error">{errors.days.root.message}</p>}
            {error && <p className="field-error">{apiErrorOf(error)?.message}</p>}
            {saved && !isDirty && <p className="text-brand-700">Saved. New slots are live.</p>}
            {isDirty && <p className="text-amber-700">You have unsaved changes</p>}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" disabled={!isDirty || isLoading} onClick={() => reset()}>
              Discard
            </button>
            <button className="btn-primary" disabled={!isDirty || isLoading}>
              {isLoading ? <Spinner /> : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
