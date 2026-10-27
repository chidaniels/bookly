import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiFail, createPayment } from "@/server/db";
import { callerEmail, customerSchema, handle, moneySchema, scenarioOf, sleep } from "@/server/http";

const body = z.object({
  bookingId: z.string().min(1),
  amount: moneySchema,
  customer: customerSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const key = req.headers.get("idempotency-key");
    if (!key || key.length < 16) {
      throw new ApiFail(400, "IDEMPOTENCY_KEY_REQUIRED", "Payments need an Idempotency-Key header.");
    }
    const email = callerEmail(req);
    const b = body.parse(await req.json());
    if (b.customer.email !== email) throw new ApiFail(403, "FORBIDDEN", "You can only pay for your own booking.");

    const scenario = scenarioOf(req);
    // The payment is recorded before any simulated delay, exactly like a real gateway:
    // the client may give up waiting, but the charge still exists and can be looked up by key.
    const { payment, replayed } = createPayment({
      bookingId: b.bookingId,
      idempotencyKey: key,
      amount: b.amount,
      customer: b.customer,
      scenario,
    });

    if (scenario === "slow") await sleep(3_000);
    if (scenario === "timeout") await sleep(15_000);

    let echoed = payment;
    if (scenario === "currency_mismatch") {
      // Simulates a buggy upstream that echoes the right number in the wrong currency.
      echoed = { ...payment, amount: { ...payment.amount, currency: payment.amount.currency === "NGN" ? "USD" : "NGN" } };
    }
    return NextResponse.json(echoed, {
      status: replayed ? 200 : 201,
      headers: replayed ? { "Idempotent-Replayed": "true" } : {},
    });
  });
}
