import Link from "next/link";
import { formatMoney } from "@/lib/money";
import type { BookingStatus, Provider } from "@/lib/types";

export function Avatar({ provider, size = "md" }: { provider: Pick<Provider, "initials" | "accent">; size?: "md" | "lg" }) {
  const dims = size === "lg" ? "h-20 w-20 text-2xl" : "h-12 w-12 text-base";
  return (
    <span
      className={`${dims} grid shrink-0 place-items-center rounded-2xl font-bold text-white`}
      style={{ background: provider.accent }}
      aria-hidden
    >
      {provider.initials}
    </span>
  );
}

export function Rating({ value, count }: { value: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <span className="text-amber-500" aria-hidden>
        ★
      </span>
      <span className="font-semibold">{value.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}

const STATUS_STYLE: Record<BookingStatus, { label: string; cls: string }> = {
  confirmed: { label: "Confirmed", cls: "bg-brand-50 text-brand-700" },
  pending_payment: { label: "Payment pending", cls: "bg-amber-50 text-amber-800" },
  held: { label: "Held", cls: "bg-amber-50 text-amber-800" },
  cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600" },
  expired: { label: "Expired", cls: "bg-gray-100 text-gray-600" },
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  const s = STATUS_STYLE[status];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>{s.label}</span>;
}

export function ProviderCard({ provider }: { provider: Provider }) {
  const from = provider.services.reduce((min, s) => (s.price.amountMinor < min.amountMinor ? s.price : min), provider.services[0].price);
  return (
    <Link
      href={`/providers/${provider.slug}`}
      className="card group flex flex-col gap-4 p-5 transition hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <Avatar provider={provider} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-brand-700">{provider.name}</h3>
          <p className="truncate text-sm text-muted">{provider.headline}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <Rating value={provider.rating} count={provider.reviewCount} />
        <span>·</span>
        <span>{provider.city}</span>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium">{provider.category}</span>
        <span>
          from <strong>{formatMoney(from, { compact: true })}</strong>
        </span>
      </div>
    </Link>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      className={`${className} inline-block animate-spin rounded-full border-2 border-current border-r-transparent`}
      role="status"
      aria-label="Loading"
    />
  );
}

export function Skeleton({ className }: { className: string }) {
  return <span className={`block animate-pulse rounded-xl bg-line ${className}`} />;
}
