import type { Metadata } from "next";
import Link from "next/link";
import { ProviderCard } from "@/components/ui";
import { categories, listProviders } from "@/server/db";

export const metadata: Metadata = { title: "Browse services" };
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ q?: string; category?: string }> };

export default async function ServicesPage({ searchParams }: Props) {
  const { q = "", category = "" } = await searchParams;
  const results = listProviders({ q, category: category || undefined });
  const href = (c: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (c) p.set("category", c);
    const s = p.toString();
    return s ? `/services?${s}` : "/services";
  };

  return (
    <div className="container-page py-10">
      <h1 className="text-3xl font-bold tracking-tight">Browse services</h1>

      {/* A plain GET form: search works before any JavaScript has loaded on a slow phone. */}
      <form className="mt-6 flex flex-col gap-2 sm:flex-row" action="/services">
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input id="q" name="q" defaultValue={q} className="input" placeholder="Search by service, provider or city" />
        {category && <input type="hidden" name="category" value={category} />}
        <button className="btn-primary">Search</button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2" role="list" aria-label="Categories">
        {["", ...categories()].map((c) => (
          <Link
            key={c || "all"}
            href={href(c)}
            role="listitem"
            aria-current={category === c ? "true" : undefined}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              category === c ? "border-brand-600 bg-brand-600 text-white" : "border-line bg-white hover:border-brand-500"
            }`}
          >
            {c || "All"}
          </Link>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted">
        {results.length} {results.length === 1 ? "provider" : "providers"}
        {q && (
          <>
            {" "}
            matching <strong className="text-ink">“{q}”</strong>
          </>
        )}
      </p>

      {results.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((p) => (
            <ProviderCard key={p.slug} provider={p} />
          ))}
        </div>
      ) : (
        <div className="card mt-4 p-10 text-center">
          <p className="font-semibold">No providers found</p>
          <p className="mt-1 text-sm text-muted">Try a different word or clear the category filter.</p>
          <Link href="/services" className="btn-ghost mt-4">
            Clear filters
          </Link>
        </div>
      )}
    </div>
  );
}
