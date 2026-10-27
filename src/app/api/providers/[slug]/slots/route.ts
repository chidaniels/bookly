import { z } from "zod";
import { getSlots } from "@/server/db";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ slug: string }> };

const query = z.object({
  serviceId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  ignore: z.string().optional(),
});

export async function GET(req: Request, { params }: Ctx) {
  const { slug } = await params;
  return handle(() => {
    const q = query.parse(Object.fromEntries(new URL(req.url).searchParams));
    return getSlots(slug, q.serviceId, q.date, q.ignore);
  });
}
