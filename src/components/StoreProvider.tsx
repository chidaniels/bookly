"use client";

import { useEffect, useRef } from "react";
import { Provider } from "react-redux";
import { makeStore, type AppStore } from "@/store";
import { saveCheckout } from "@/store/checkoutSlice";
import { hydrated, type Session } from "@/store/sessionSlice";

const SESSION_KEY = "bookly.session";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storeRef = useRef<AppStore | null>(null);
  if (!storeRef.current) storeRef.current = makeStore();

  useEffect(() => {
    const store = storeRef.current!;
    let saved: Session | null = null;
    try {
      saved = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null");
    } catch {}
    store.dispatch(hydrated(saved));

    let prev = store.getState();
    return store.subscribe(() => {
      const next = store.getState();
      if (next.session.user !== prev.session.user) {
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(next.session.user));
        } catch {}
      }
      if (next.checkout !== prev.checkout) saveCheckout(next.checkout);
      prev = next;
    });
  }, []);

  return <Provider store={storeRef.current}>{children}</Provider>;
}
