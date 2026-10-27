import Link from "next/link";
import { ProviderCard } from "@/components/ui";
import { categories, listProviders } from "@/server/db";

export const dynamic = "force-dynamic";

export default function Home() {
  const featured = [...listProviders()].sort((a, b) => b.rating - a.rating).slice(0, 3);

  return (
    <>
      <section className="border-b border-line bg-white">
        <div className="container-page grid gap-10 py-14 sm:py-20 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="mb-4 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              Lagos · Accra · Remote
            </p>
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
              Book trusted local pros and pay in one go.
            </h1>
            <p className="mt-4 max-w-xl text-lg text-muted">
              Stylists, trainers, photographers and coaches with live availability. Your slot is held while you pay, and
              you&apos;re never charged twice.
            </p>
            <form action="/services" className="mt-8 flex max-w-xl flex-col gap-2 sm:flex-row">
              <label htmlFor="q" className="sr-only">
                Search services
              </label>
              <input id="q" name="q" className="input py-3" placeholder="Try “braids”, “massage” or “React”" />
              <button className="btn-primary py-3">Search</button>
            </form>
            <div className="mt-5 flex flex-wrap gap-2">
              {categories().map((c) => (
                <Link
                  key={c}
                  href={`/services?category=${encodeURIComponent(c)}`}
                  className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-brand-500 hover:text-brand-700"
                >
                  {c}
                </Link>
              ))}
            </div>
          </div>

          <div className="card hidden bg-canvas p-6 lg:block" aria-hidden>
            <p className="text-sm font-semibold">Thursday, 10:30</p>
            <p className="text-sm text-muted">Cornrows · Adaeze&apos;s Braids Studio</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"].map((t, i) => (
                <span
                  key={t}
                  className={`rounded-lg border px-2 py-2 text-center text-sm ${
                    i === 3
                      ? "border-brand-600 bg-brand-600 text-white"
                      : i === 1
                        ? "border-line text-muted line-through"
                        : "border-line bg-white"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="mt-5 rounded-xl bg-white p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Held for you</span>
                <span className="font-mono font-semibold">04:52</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-muted">Total</span>
                <span className="font-semibold">₦15,000.00</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold tracking-tight">Top rated this week</h2>
          <Link href="/services" className="text-sm font-semibold text-brand-700 hover:underline">
            See all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featured.map((p) => (
            <ProviderCard key={p.slug} provider={p} />
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-white">
        <div className="container-page grid gap-8 py-14 sm:grid-cols-3">
          {[
            ["1", "Pick a time", "See live slots in the provider's local time, and in yours if you're elsewhere."],
            ["2", "We hold it", "Your slot is reserved for 5 minutes so nobody books it while you pay."],
            ["3", "Pay once", "Every payment has a unique key. Double taps and retries can't charge you twice."],
          ].map(([n, title, body]) => (
            <div key={n}>
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{n}</span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
