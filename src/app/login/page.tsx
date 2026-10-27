import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
import { SEED_PROVIDERS } from "@/server/seed";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  const providers = SEED_PROVIDERS.map((p) => ({ slug: p.slug, name: p.name, category: p.category, city: p.city }));
  return (
    <div className="container-page flex justify-center py-12">
      <Suspense>
        <LoginForm providers={providers} />
      </Suspense>
    </div>
  );
}
