import "server-only";
import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import type { SimScenario } from "@/lib/types";
import { ApiFail } from "./db";

const SCENARIOS: SimScenario[] = ["normal", "slow", "timeout", "decline", "currency_mismatch"];

/** The Network Lab panel sends this header so reviewers can force each payment edge case. */
export function scenarioOf(req: Request): SimScenario {
  const v = req.headers.get("x-sim-scenario") as SimScenario | null;
  return v && SCENARIOS.includes(v) ? v : "normal";
}

/** Who is calling. A real app would read a session cookie; the demo sends the signed-in email. */
export function callerEmail(req: Request): string {
  const email = req.headers.get("x-user-email");
  if (!email) throw new ApiFail(401, "UNAUTHENTICATED", "Please sign in first.");
  return email.toLowerCase();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handle(fn: () => unknown | Promise<unknown>) {
  try {
    const result = await fn();
    return result instanceof Response ? result : NextResponse.json(result);
  } catch (e) {
    if (e instanceof ApiFail) {
      return NextResponse.json({ code: e.code, message: e.message, ...e.extra }, { status: e.status });
    }
    if (e instanceof ZodError) {
      return NextResponse.json(
        { code: "VALIDATION", message: e.issues[0]?.message ?? "Invalid request", issues: e.issues },
        { status: 400 },
      );
    }
    console.error(e);
    return NextResponse.json({ code: "INTERNAL", message: "Something went wrong on our side." }, { status: 500 });
  }
}

export const moneySchema = z.object({
  amountMinor: z.number().int().nonnegative(),
  currency: z.enum(["NGN", "USD", "GHS"]),
});

export const customerSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().optional(),
  note: z.string().trim().max(500).optional(),
});
