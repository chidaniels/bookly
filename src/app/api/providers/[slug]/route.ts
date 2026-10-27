import { getProvider } from "@/server/db";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;
  return handle(() => getProvider(slug));
}
