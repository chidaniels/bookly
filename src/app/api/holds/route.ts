import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiFail, createHold } from "@/server/db";
import { callerEmail, customerSchema, handle } from "@/server/http";

const body = z.object({
  providerSlug: z.string().min(1),
  serviceId: z.string().min(1),
  startUtc: z.string().datetime(),
  customer: customerSchema,
});

export async function POST(req: Request) {
  return handle(async () => {
    const email = callerEmail(req);
    const b = body.parse(await req.json());
    if (b.customer.email !== email) throw new ApiFail(403, "FORBIDDEN", "You can only book for yourself.");
    const booking = createHold({ slug: b.providerSlug, serviceId: b.serviceId, startUtc: b.startUtc, customer: b.customer });
    return NextResponse.json(booking, { status: 201 });
  });
}
