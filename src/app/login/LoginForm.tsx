"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAppDispatch } from "@/store/hooks";
import { api } from "@/store/api";
import { signedIn } from "@/store/sessionSlice";

const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
type CustomerForm = z.infer<typeof customerSchema>;

interface Props {
  providers: { slug: string; name: string; category: string; city: string }[];
}

/** Only allow same-site relative redirects, so ?next= can't bounce users to another domain. */
function safeNext(next: string | null, fallback: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

export function LoginForm({ providers }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<"customer" | "provider">(params.get("role") === "provider" ? "provider" : "customer");
  const [providerSlug, setProviderSlug] = useState(providers[0].slug);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomerForm>({ resolver: zodResolver(customerSchema), defaultValues: { name: "", email: "" } });

  const finish = (fallback: string) => {
    dispatch(api.util.resetApiState());
    router.replace(safeNext(params.get("next"), fallback));
  };

  const onCustomer = (v: CustomerForm) => {
    dispatch(signedIn({ role: "customer", name: v.name, email: v.email }));
    finish("/services");
  };

  const onProvider = () => {
    const p = providers.find((x) => x.slug === providerSlug)!;
    dispatch(signedIn({ role: "provider", name: p.name, providerSlug: p.slug }));
    finish("/dashboard");
  };

  return (
    <div className="card w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Sign in to Bookly</h1>
      <p className="mt-1 text-sm text-muted">
        This is a demo, so there are no passwords. Pick a role to explore.
      </p>

      <div className="mt-6 grid grid-cols-2 rounded-xl bg-canvas p-1 text-sm font-semibold" role="tablist">
        {(["customer", "provider"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 capitalize ${tab === t ? "bg-white shadow-sm" : "text-muted"}`}
          >
            {t === "customer" ? "I'm booking" : "I'm a provider"}
          </button>
        ))}
      </div>

      {tab === "customer" ? (
        <form onSubmit={handleSubmit(onCustomer)} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="label">
              Full name
            </label>
            <input id="name" className="input" autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <p className="field-error">{errors.name.message}</p>}
          </div>
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>
          <button className="btn-primary w-full py-3" disabled={isSubmitting}>
            Continue
          </button>
          <button
            type="button"
            className="btn-ghost w-full"
            onClick={() => {
              setValue("name", "Demo Customer", { shouldValidate: true });
              setValue("email", "demo@bookly.app", { shouldValidate: true });
            }}
          >
            Fill in the demo customer (has bookings)
          </button>
        </form>
      ) : (
        <div className="mt-6 space-y-2">
          <p className="label">Sign in as</p>
          {providers.map((p) => (
            <label
              key={p.slug}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm ${
                providerSlug === p.slug ? "border-brand-500 bg-brand-50" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="provider"
                className="accent-brand-600"
                checked={providerSlug === p.slug}
                onChange={() => setProviderSlug(p.slug)}
              />
              <span>
                <span className="block font-medium">{p.name}</span>
                <span className="text-xs text-muted">
                  {p.category} · {p.city}
                </span>
              </span>
            </label>
          ))}
          <button className="btn-primary mt-4 w-full py-3" onClick={onProvider}>
            Open dashboard
          </button>
        </div>
      )}
    </div>
  );
}
