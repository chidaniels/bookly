export type Currency = "NGN" | "USD" | "GHS";

/** Money is always integer minor units (kobo, cents, pesewas) plus its currency. Never a float, never currency-less. */
export interface Money {
  amountMinor: number;
  currency: Currency;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  price: Money;
}

/** Minutes from midnight in the provider's timezone. Key is weekday, 0 = Sunday. */
export type DayHours = { start: number; end: number } | null;
export type WeeklyHours = Record<number, DayHours>;

export interface Provider {
  id: string;
  slug: string;
  name: string;
  headline: string;
  category: string;
  city: string;
  country: string;
  timezone: string;
  currency: Currency;
  rating: number;
  reviewCount: number;
  bio: string;
  initials: string;
  accent: string;
  services: Service[];
  hours: WeeklyHours;
  slotStepMin: number;
}

export type BookingStatus = "held" | "pending_payment" | "confirmed" | "cancelled" | "expired";

export interface Customer {
  name: string;
  email: string;
  phone?: string;
  note?: string;
}

export interface Booking {
  id: string;
  providerSlug: string;
  serviceId: string;
  customer: Customer;
  startUtc: string;
  endUtc: string;
  status: BookingStatus;
  holdExpiresAt: string | null;
  price: Money;
  paymentId: string | null;
  refund: Money | null;
  createdAt: string;
}

/** A booking joined with the display data the UI needs, so pages don't stitch it together. */
export interface BookingView extends Booking {
  providerName: string;
  providerTimezone: string;
  providerCity: string;
  serviceName: string;
  durationMin: number;
}

export type PaymentStatus = "processing" | "succeeded" | "failed";

export interface Payment {
  id: string;
  bookingId: string;
  idempotencyKey: string;
  status: PaymentStatus;
  amount: Money;
  failureReason: string | null;
  createdAt: string;
  settlesAt: string;
}

export interface Slot {
  startUtc: string;
  endUtc: string;
  available: boolean;
}

export type SimScenario = "normal" | "slow" | "timeout" | "decline" | "currency_mismatch";

export interface ApiError {
  code: string;
  message: string;
}

export interface DashboardData {
  provider: Provider;
  upcoming: BookingView[];
  week: BookingView[];
  stats: {
    todayCount: number;
    upcoming7d: number;
    earningsThisMonth: Money;
    earningsLastMonth: Money;
    cancellationRate: number;
  };
  weeklyEarnings: { weekStart: string; amount: Money }[];
}
