"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAppSelector } from "@/store/hooks";
import type { Session } from "@/store/sessionSlice";

/** Redirects to /login once the session is known and the user lacks the role. Returns the user when allowed. */
export function useRequireRole<R extends Session["role"]>(role: R) {
  const { user, hydrated } = useAppSelector((s) => s.session);
  const router = useRouter();
  const pathname = usePathname();
  const allowed = user?.role === role;

  useEffect(() => {
    if (hydrated && !allowed) router.replace(`/login?role=${role}&next=${encodeURIComponent(pathname)}`);
  }, [hydrated, allowed, role, pathname, router]);

  return { ready: hydrated && allowed, user: allowed ? (user as Extract<Session, { role: R }>) : null };
}
