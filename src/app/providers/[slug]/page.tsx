import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingWidget } from "@/components/BookingWidget";
import { Avatar, Rating } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { minutesToHHMM, WEEKDAYS } from "@/lib/time";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = db().providers.get((await params).slug);
  return { title: p ? p.name : "Provider not found", description: p?.headline };
}

export default async function ProviderPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { service } = await searchParams;
  const p = db().providers.get(slug);
  if (!p) notFound();

  return (
    <div className="container-page grid gap-8 py-10 lg:grid-cols-[1fr_26rem]">
      <div className="space-y-8">
        <section className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <Avatar provider={p} size="lg" />
          <div>
            <p className="text-sm font-medium text-brand-700">{p.category}</p>
            <h1 className="text-3xl font-bold tracking-tight">{p.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              <Rating value={p.rating} count={p.reviewCount} />
              <span>·</span>
              <span>
                {p.city}, {p.country}
              </span>
            </div>
          </div>
        </section>

        <p className="max-w-2xl text-muted">{p.bio}</p>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Services</h2>
          <ul className="card divide-y divide-line">
            {p.services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-sm text-muted">
                    {s.durationMin >= 60
                      ? `${Math.floor(s.durationMin / 60)} hr${s.durationMin % 60 ? ` ${s.durationMin % 60} min` : ""}`
                      : `${s.durationMin} min`}
                  </p>
                </div>
                <p className="font-semibold">{formatMoney(s.price)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Prices are set by the provider in {p.currency}. You pay exactly the amount shown, with no conversion.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Opening hours</h2>
          <dl className="card grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 p-4 text-sm sm:max-w-sm">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = p.hours[d];
              return (
                <div key={d} className="contents">
                  <dt className="text-muted">{WEEKDAYS[d]}</dt>
                  <dd className="text-right font-medium">
                    {h ? `${minutesToHHMM(h.start)} – ${minutesToHHMM(h.end)}` : "Closed"}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <BookingWidget
          provider={{ slug: p.slug, name: p.name, timezone: p.timezone, services: p.services }}
          initialServiceId={service}
        />
      </aside>
    </div>
  );
}
