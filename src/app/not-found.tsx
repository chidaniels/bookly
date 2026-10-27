import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-page py-24 text-center">
      <p className="text-sm font-semibold text-brand-700">404</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">The link may be old, or the provider may have moved.</p>
      <Link href="/services" className="btn-primary mt-6">
        Browse services
      </Link>
    </div>
  );
}
