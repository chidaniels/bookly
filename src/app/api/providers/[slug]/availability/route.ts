import { z } from "zod";
import { updateAvailability } from "@/server/db";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ slug: string }> };

const day = z
  .object({ start: z.number().int().min(0).max(1440), end: z.number().int().min(0).max(1440) })
  .refine((d) => d.end > d.start, "Closing time must be after opening time")
  .nullable();

const body = z.object({
  hours: z.record(z.string().regex(/^[0-6]$/), day),
  slotStepMin: z.union([z.literal(15), z.literal(30), z.literal(60)]),
});

export async function PUT(req: Request, { params }: Ctx) {
  const { slug } = await params;
  return handle(async () => {
    const b = body.parse(await req.json());
    const hours = Object.fromEntries(Object.entries(b.hours).map(([k, v]) => [Number(k), v]));
    return updateAvailability(slug, hours, b.slotStepMin);
  });
}
