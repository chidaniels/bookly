"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { api } from "@/store/api";
import { checkoutReset } from "@/store/checkoutSlice";
import { signedOut } from "@/store/sessionSlice";

export function Header() {
  const { user, hydrated } = useAppSelector((s) => s.session);
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const links =
    user?.role === "provider"
      ? [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/dashboard/availability", label: "Availability" },
        ]
      : [
          { href: "/services", label: "Browse" },
          ...(user?.role === "customer" ? [{ href: "/bookings", label: "My bookings" }] : []),
        ];

  const signOut = () => {
    dispatch(signedOut());
    dispatch(checkoutReset());
    dispatch(api.util.resetApiState());
    setOpen(false);
    router.push("/");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm text-white">B</span>
          Bookly
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                pathname === l.href ? "bg-brand-50 text-brand-700" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {!hydrated ? (
            <span className="h-9 w-24 animate-pulse rounded-xl bg-line" />
          ) : user ? (
            <div className="relative">
              <button className="btn-ghost py-2" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
                <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                  {user.name.charAt(0)}
                </span>
                <span className="max-w-32 truncate">{user.name.split(" ")[0]}</span>
              </button>
              {open && (
                <div className="card absolute right-0 mt-2 w-56 p-2 shadow-lg">
                  <p className="px-3 py-2 text-xs text-muted">
                    Signed in as {user.role === "provider" ? "provider" : "customer"}
                  </p>
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setOpen(false)}
                      className="block rounded-lg px-3 py-2 text-sm hover:bg-brand-50 sm:hidden"
                    >
                      {l.label}
                    </Link>
                  ))}
                  <button onClick={signOut} className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-50">
                    Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/services" className="px-2 text-sm font-medium text-muted sm:hidden">
                Browse
              </Link>
              <Link href={`/login?next=${encodeURIComponent(pathname)}`} className="btn-primary py-2">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
