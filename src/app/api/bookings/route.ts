import { listBookings } from "@/server/db";
import { callerEmail, handle } from "@/server/http";

export async function GET(req: Request) {
  return handle(() => listBookings(callerEmail(req)));
}
