import { getPaymentByKey } from "@/server/db";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { key } = await params;
  return handle(() => getPaymentByKey(key));
}
