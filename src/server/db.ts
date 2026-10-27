import "server-only";
import { addMoney, sameMoney, zero } from "@/lib/money";
import { addDays, weekdayOf, zonedDate, zonedToUtc } from "@/lib/time";
import type {
  Booking,
  BookingView,
  Customer,
  DashboardData,
  Money,
  Payment,
  Provider,
  SimScenario,
  Slot,
  WeeklyHours,
} from "@/lib/types";
import { DEMO_CUSTOMERS, DEMO_EMAIL, SEED_PROVIDERS } from "./seed";

/**
 * In-memory data store standing in for a real backend. It lives on globalThis so it
 * survives Next.js hot reloads in dev, and it is reseeded on every server start.
 * Every mutation runs synchronously between awaits, so check-then-write is atomic in Node.
 */

export const HOLD_MS = 5 * 60_000;
const MIN_LEAD_MS = 60 * 60_000;
const SETTLE_MS = 2_500;

export class ApiFail extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

interface Db {
  providers: Map<string, Provider>;
  bookings: Map<string, Booking>;
  payments: Map<string, Payment>;
  paymentsByKey: Map<string, string>;
  outcomes: Map<string, { status: "succeeded" | "failed"; reason: string | null }>;
  pendingCustomer: Map<string, Customer>;
}

const g = globalThis as unknown as { __booklyDb?: Db };

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let idCounter = 0;
export function newId(prefix: string) {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function seed(): Db {
  const db: Db = {
    providers: new Map(SEED_PROVIDERS.map((p) => [p.slug, structuredClone(p)])),
    bookings: new Map(),
    payments: new Map(),
    paymentsByKey: new Map(),
    outcomes: new Map(),
    pendingCustomer: new Map(),
  };
  const rand = rng(42);
  const now = Date.now();

  const place = (p: Provider, date: string, serviceIdx: number, startMin: number, customer: Customer, cancelled = false) => {
    const service = p.services[serviceIdx];
    const start = zonedToUtc(date, startMin, p.timezone);
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    const clash = [...db.bookings.values()].some(
      (b) => b.providerSlug === p.slug && b.status === "confirmed" && overlaps(b, start, end),
    );
    if (clash) return;
    const id = newId("bk");
    db.bookings.set(id, {
      id,
      providerSlug: p.slug,
      serviceId: service.id,
      customer,
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      status: cancelled ? "cancelled" : "confirmed",
      holdExpiresAt: null,
      price: service.price,
      paymentId: newId("pay"),
      refund: cancelled ? service.price : null,
      createdAt: new Date(start.getTime() - 3 * 86_400_000).toISOString(),
    });
  };

  // The demo customer's bookings go in first so random seed data can never crowd them out.
  const demo = { name: "Demo Customer", email: DEMO_EMAIL, phone: "08030000000" };
  const adaeze = db.providers.get("adaeze-braids-studio")!;
  const amaka = db.providers.get("dr-amaka-obi")!;
  const kojo = db.providers.get("kojo-mensah-photography")!;
  const nextWeekday = (p: Provider, from: number) => {
    let d = addDays(zonedDate(now, p.timezone), from);
    while (!p.hours[weekdayOf(d)]) d = addDays(d, 1);
    return d;
  };
  place(adaeze, nextWeekday(adaeze, 3), 1, 11 * 60, demo);
  place(amaka, nextWeekday(amaka, 5), 0, 14 * 60, demo);
  place(kojo, nextWeekday(kojo, -20), 0, 10 * 60, demo);

  for (const p of db.providers.values()) {
    const today = zonedDate(now, p.timezone);
    for (let offset = -63; offset <= 12; offset++) {
      const date = addDays(today, offset);
      const hours = p.hours[weekdayOf(date)];
      if (!hours) continue;
      const perDay = offset < 0 ? Math.floor(rand() * 4) : Math.floor(rand() * 3);
      for (let i = 0; i < perDay; i++) {
        const serviceIdx = Math.floor(rand() * p.services.length);
        const latest = hours.end - p.services[serviceIdx].durationMin;
        if (latest < hours.start) continue;
        const steps = Math.floor((latest - hours.start) / p.slotStepMin);
        const startMin = hours.start + Math.floor(rand() * (steps + 1)) * p.slotStepMin;
        const start = zonedToUtc(date, startMin, p.timezone).getTime();
        if (offset >= 0 && start < now + MIN_LEAD_MS) continue;
        const customer = DEMO_CUSTOMERS[Math.floor(rand() * DEMO_CUSTOMERS.length)];
        place(p, date, serviceIdx, startMin, customer, offset < 0 && rand() < 0.08);
      }
    }
  }

  return db;
}

export function db(): Db {
  if (!g.__booklyDb) g.__booklyDb = seed();
  return g.__booklyDb;
}

function overlaps(b: Pick<Booking, "startUtc" | "endUtc">, start: Date, end: Date) {
  return new Date(b.startUtc) < end && start < new Date(b.endUtc);
}

/** Lazily applies time-based transitions: expired holds and payments that are due to settle. */
function sweep() {
  const d = db();
  const now = Date.now();
  for (const p of d.payments.values()) {
    if (p.status === "processing" && new Date(p.settlesAt).getTime() <= now) settle(p);
  }
  for (const b of d.bookings.values()) {
    if (b.status === "held" && b.holdExpiresAt && new Date(b.holdExpiresAt).getTime() <= now) {
      b.status = "expired";
    }
  }
}

function settle(p: Payment) {
  const d = db();
  const outcome = d.outcomes.get(p.id) ?? { status: "succeeded", reason: null };
  const booking = d.bookings.get(p.bookingId)!;
  p.status = outcome.status;
  p.failureReason = outcome.reason;
  if (outcome.status === "succeeded") {
    booking.status = "confirmed";
    booking.paymentId = p.id;
    booking.holdExpiresAt = null;
    const customer = d.pendingCustomer.get(p.id);
    if (customer) booking.customer = customer;
  } else {
    // Give the customer a little time to retry rather than losing the slot immediately.
    booking.status = "held";
    const retryUntil = Date.now() + 3 * 60_000;
    booking.holdExpiresAt = new Date(Math.max(retryUntil, new Date(booking.holdExpiresAt ?? 0).getTime())).toISOString();
  }
}

function isBlocking(b: Booking) {
  return b.status === "confirmed" || b.status === "pending_payment" || b.status === "held";
}

function requireProvider(slug: string) {
  const p = db().providers.get(slug);
  if (!p) throw new ApiFail(404, "PROVIDER_NOT_FOUND", "We couldn't find that provider.");
  return p;
}

function requireService(p: Provider, serviceId: string) {
  const s = p.services.find((x) => x.id === serviceId);
  if (!s) throw new ApiFail(404, "SERVICE_NOT_FOUND", "That service isn't offered by this provider.");
  return s;
}

function requireBooking(id: string) {
  const b = db().bookings.get(id);
  if (!b) throw new ApiFail(404, "BOOKING_NOT_FOUND", "We couldn't find that booking.");
  return b;
}

export function toView(b: Booking): BookingView {
  const p = requireProvider(b.providerSlug);
  const s = p.services.find((x) => x.id === b.serviceId)!;
  return {
    ...b,
    providerName: p.name,
    providerTimezone: p.timezone,
    providerCity: p.city,
    serviceName: s.name,
    durationMin: s.durationMin,
  };
}

// ---------- Providers ----------

export function listProviders(filter: { q?: string; category?: string } = {}) {
  const q = filter.q?.trim().toLowerCase();
  return [...db().providers.values()].filter((p) => {
    if (filter.category && p.category !== filter.category) return false;
    if (!q) return true;
    return [p.name, p.headline, p.city, p.category, ...p.services.map((s) => s.name)].some((t) =>
      t.toLowerCase().includes(q),
    );
  });
}

export function categories() {
  return [...new Set(SEED_PROVIDERS.map((p) => p.category))];
}

export function getProvider(slug: string) {
  return requireProvider(slug);
}

export function updateAvailability(slug: string, hours: WeeklyHours, slotStepMin: number) {
  const p = requireProvider(slug);
  p.hours = hours;
  p.slotStepMin = slotStepMin;
  return p;
}

// ---------- Slots & holds ----------

export function getSlots(slug: string, serviceId: string, date: string, ignoreBookingId?: string): Slot[] {
  sweep();
  const p = requireProvider(slug);
  const service = requireService(p, serviceId);
  const hours = p.hours[weekdayOf(date)];
  if (!hours) return [];
  const now = Date.now();
  const taken = [...db().bookings.values()].filter(
    (b) => b.providerSlug === slug && b.id !== ignoreBookingId && isBlocking(b),
  );
  const slots: Slot[] = [];
  for (let m = hours.start; m + service.durationMin <= hours.end; m += p.slotStepMin) {
    const start = zonedToUtc(date, m, p.timezone);
    if (start.getTime() < now + MIN_LEAD_MS) continue;
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    slots.push({
      startUtc: start.toISOString(),
      endUtc: end.toISOString(),
      available: !taken.some((b) => overlaps(b, start, end)),
    });
  }
  return slots;
}

function assertSlotFree(p: Provider, serviceId: string, startUtc: string, ignoreBookingId?: string) {
  const date = zonedDate(startUtc, p.timezone);
  const slot = getSlots(p.slug, serviceId, date, ignoreBookingId).find((s) => s.startUtc === startUtc);
  if (!slot) throw new ApiFail(422, "SLOT_INVALID", "That time isn't bookable for this service.");
  if (!slot.available) {
    throw new ApiFail(409, "SLOT_TAKEN", "Someone just booked that time. Please pick another slot.");
  }
  return slot;
}

export function createHold(input: { slug: string; serviceId: string; startUtc: string; customer: Customer }) {
  sweep();
  const p = requireProvider(input.slug);
  const service = requireService(p, input.serviceId);
  const d = db();

  // One active hold per customer: picking a new slot releases the previous one.
  for (const b of d.bookings.values()) {
    if (b.status === "held" && b.customer.email === input.customer.email) b.status = "expired";
  }

  const slot = assertSlotFree(p, input.serviceId, input.startUtc);
  const id = newId("bk");
  const booking: Booking = {
    id,
    providerSlug: p.slug,
    serviceId: service.id,
    customer: input.customer,
    startUtc: slot.startUtc,
    endUtc: slot.endUtc,
    status: "held",
    holdExpiresAt: new Date(Date.now() + HOLD_MS).toISOString(),
    price: service.price,
    paymentId: null,
    refund: null,
    createdAt: new Date().toISOString(),
  };
  d.bookings.set(id, booking);
  return toView(booking);
}

export function releaseHold(id: string, email: string) {
  const b = requireBooking(id);
  if (b.customer.email !== email) throw new ApiFail(403, "FORBIDDEN", "That booking isn't yours.");
  if (b.status === "held") b.status = "expired";
  return toView(b);
}

// ---------- Bookings ----------

export function getBooking(id: string) {
  sweep();
  return toView(requireBooking(id));
}

export function listBookings(email: string) {
  sweep();
  return [...db().bookings.values()]
    .filter((b) => b.customer.email === email && b.status !== "expired" && b.status !== "held")
    .map(toView)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
}

export function cancelBooking(id: string, email: string) {
  sweep();
  const b = requireBooking(id);
  if (b.customer.email !== email) throw new ApiFail(403, "FORBIDDEN", "That booking isn't yours.");
  if (b.status !== "confirmed") throw new ApiFail(409, "NOT_CANCELLABLE", "Only confirmed bookings can be cancelled.");
  const msToStart = new Date(b.startUtc).getTime() - Date.now();
  if (msToStart <= 0) throw new ApiFail(409, "ALREADY_STARTED", "This booking has already started.");
  b.status = "cancelled";
  // Full refund more than 24 hours out, half inside 24 hours.
  b.refund = msToStart > 86_400_000 ? b.price : { ...b.price, amountMinor: Math.round(b.price.amountMinor / 2) };
  return toView(b);
}

export function rescheduleBooking(id: string, email: string, startUtc: string) {
  sweep();
  const b = requireBooking(id);
  if (b.customer.email !== email) throw new ApiFail(403, "FORBIDDEN", "That booking isn't yours.");
  if (b.status !== "confirmed") throw new ApiFail(409, "NOT_RESCHEDULABLE", "Only confirmed bookings can be moved.");
  if (new Date(b.startUtc).getTime() - Date.now() < 2 * 3_600_000) {
    throw new ApiFail(409, "TOO_LATE", "Bookings can't be moved within 2 hours of the start time.");
  }
  const p = requireProvider(b.providerSlug);
  const slot = assertSlotFree(p, b.serviceId, startUtc, b.id);
  b.startUtc = slot.startUtc;
  b.endUtc = slot.endUtc;
  return toView(b);
}

// ---------- Payments ----------

export function createPayment(input: {
  bookingId: string;
  idempotencyKey: string;
  amount: Money;
  customer: Customer;
  scenario: SimScenario;
}): { payment: Payment; replayed: boolean } {
  sweep();
  const d = db();

  const existingId = d.paymentsByKey.get(input.idempotencyKey);
  if (existingId) {
    const existing = d.payments.get(existingId)!;
    if (existing.bookingId !== input.bookingId || !sameMoney(existing.amount, input.amount)) {
      throw new ApiFail(422, "IDEMPOTENCY_KEY_REUSED", "This payment key was already used for a different payment.");
    }
    return { payment: existing, replayed: true };
  }

  const booking = requireBooking(input.bookingId);
  if (booking.customer.email !== input.customer.email) {
    throw new ApiFail(403, "FORBIDDEN", "That booking isn't yours.");
  }
  if (booking.status === "confirmed") {
    throw new ApiFail(409, "ALREADY_PAID", "This booking is already paid for.", { paymentId: booking.paymentId });
  }
  if (booking.status === "pending_payment") {
    throw new ApiFail(409, "PAYMENT_IN_PROGRESS", "A payment for this booking is already being processed.");
  }
  if (booking.status !== "held") {
    throw new ApiFail(410, "HOLD_EXPIRED", "Your hold on this slot expired before payment. Please pick a time again.");
  }
  if (!sameMoney(booking.price, input.amount)) {
    throw new ApiFail(422, "AMOUNT_MISMATCH", "The price changed since you started. Please review the new total.", {
      expected: booking.price,
    });
  }

  const now = Date.now();
  const payment: Payment = {
    id: newId("pay"),
    bookingId: booking.id,
    idempotencyKey: input.idempotencyKey,
    status: "processing",
    amount: booking.price,
    failureReason: null,
    createdAt: new Date(now).toISOString(),
    // In the timeout scenario the bank is slow too, so the client's "checking" state is visible.
    settlesAt: new Date(
      now + (input.scenario === "slow" ? SETTLE_MS * 2 : input.scenario === "timeout" ? 12_000 : SETTLE_MS),
    ).toISOString(),
  };
  d.payments.set(payment.id, payment);
  d.paymentsByKey.set(payment.idempotencyKey, payment.id);
  d.pendingCustomer.set(payment.id, input.customer);
  d.outcomes.set(
    payment.id,
    input.scenario === "decline"
      ? { status: "failed", reason: "Your bank declined this payment. You have not been charged." }
      : { status: "succeeded", reason: null },
  );
  booking.status = "pending_payment";
  return { payment, replayed: false };
}

export function getPaymentByKey(key: string) {
  sweep();
  const d = db();
  const id = d.paymentsByKey.get(key);
  if (!id) throw new ApiFail(404, "PAYMENT_NOT_FOUND", "No payment has been recorded with this key.");
  const payment = d.payments.get(id)!;
  return { payment, bookingStatus: d.bookings.get(payment.bookingId)!.status };
}

// ---------- Provider dashboard ----------

export function dashboard(slug: string): DashboardData {
  sweep();
  const p = requireProvider(slug);
  const now = Date.now();
  const today = zonedDate(now, p.timezone);
  const all = [...db().bookings.values()].filter((b) => b.providerSlug === slug);
  const live = all.filter((b) => b.status === "confirmed" || b.status === "pending_payment");

  const mondayOf = (date: string) => addDays(date, -((weekdayOf(date) + 6) % 7));
  const weekStart = mondayOf(today);
  const weekEnd = addDays(weekStart, 7);
  const dateOf = (b: Booking) => zonedDate(b.startUtc, p.timezone);

  const monthKey = today.slice(0, 7);
  const lastMonthKey = addDays(`${monthKey}-01`, -1).slice(0, 7);
  const earnings = (pred: (b: Booking) => boolean) =>
    all.filter((b) => b.status === "confirmed" && pred(b)).reduce((sum, b) => addMoney(sum, b.price), zero(p.currency));

  const recent = all.filter((b) => {
    const t = new Date(b.startUtc).getTime();
    return t > now - 30 * 86_400_000 && t <= now && (b.status === "confirmed" || b.status === "cancelled");
  });

  const weeklyEarnings = Array.from({ length: 8 }, (_, i) => {
    const ws = addDays(weekStart, (i - 7) * 7);
    const we = addDays(ws, 7);
    return { weekStart: ws, amount: earnings((b) => dateOf(b) >= ws && dateOf(b) < we) };
  });

  return {
    provider: p,
    upcoming: live
      .filter((b) => new Date(b.endUtc).getTime() > now)
      .sort((a, b) => a.startUtc.localeCompare(b.startUtc))
      .slice(0, 8)
      .map(toView),
    week: live.filter((b) => dateOf(b) >= weekStart && dateOf(b) < weekEnd).map(toView),
    stats: {
      todayCount: live.filter((b) => dateOf(b) === today).length,
      upcoming7d: live.filter((b) => {
        const t = new Date(b.startUtc).getTime();
        return t > now && t < now + 7 * 86_400_000;
      }).length,
      earningsThisMonth: earnings((b) => dateOf(b).startsWith(monthKey)),
      earningsLastMonth: earnings((b) => dateOf(b).startsWith(lastMonthKey)),
      cancellationRate: recent.length ? recent.filter((b) => b.status === "cancelled").length / recent.length : 0,
    },
    weeklyEarnings,
  };
}
