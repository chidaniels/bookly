import type { Currency, Money } from "./types";

export const CURRENCIES: Record<Currency, { symbol: string; name: string; minorUnit: number }> = {
  NGN: { symbol: "₦", name: "Naira", minorUnit: 100 },
  USD: { symbol: "$", name: "US Dollar", minorUnit: 100 },
  GHS: { symbol: "₵", name: "Cedi", minorUnit: 100 },
};

export function money(major: number, currency: Currency): Money {
  return { amountMinor: Math.round(major * CURRENCIES[currency].minorUnit), currency };
}

export function formatMoney(m: Money, opts: { compact?: boolean } = {}): string {
  const { symbol, minorUnit } = CURRENCIES[m.currency];
  const major = m.amountMinor / minorUnit;
  const digits = opts.compact && Number.isInteger(major) ? 0 : 2;
  const sign = major < 0 ? "-" : "";
  return `${sign}${symbol}${Math.abs(major).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function isMoney(x: unknown): x is Money {
  if (!x || typeof x !== "object") return false;
  const m = x as Record<string, unknown>;
  return Number.isInteger(m.amountMinor) && typeof m.currency === "string" && m.currency in CURRENCIES;
}

/** Strict equality: same currency AND same minor amount. ₦40 is not $40. */
export function sameMoney(a: Money, b: Money): boolean {
  return a.currency === b.currency && a.amountMinor === b.amountMinor;
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(`Refusing to add ${a.currency} to ${b.currency}`);
  }
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

export function zero(currency: Currency): Money {
  return { amountMinor: 0, currency };
}
