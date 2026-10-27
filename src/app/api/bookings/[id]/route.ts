import { z } from "zod";
import { cancelBooking, getBooking, releaseHold, rescheduleBooking } from "@/server/db";
import { callerEmail, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("release") }),
  z.object({ action: z.literal("reschedule"), startUtc: z.string().datetime() }),
]);

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getBooking(id));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const email = callerEmail(req);
    const b = body.parse(await req.json());
    switch (b.action) {
      case "cancel":
        return cancelBooking(id, email);
      case "release":
        return releaseHold(id, email);
      case "reschedule":
        return rescheduleBooking(id, email, b.startUtc);
    }
  });
}
