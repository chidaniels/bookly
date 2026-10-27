const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(tz, f);
  }
  return f;
}

function zonedParts(utcMs: number, tz: string) {
  const p = Object.fromEntries(partsFormatter(tz).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  return { year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute, second: +p.second };
}

/** Offset of `tz` from UTC at the given instant, in ms (Lagos = +3_600_000). */
export function tzOffsetMs(tz: string, utcMs: number): number {
  const p = zonedParts(utcMs, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` (date "YYYY-MM-DD" + minutes from midnight) to a UTC Date. */
export function zonedToUtc(date: string, minutes: number, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const first = guess - tzOffsetMs(tz, guess);
  // Second pass corrects the rare case where the guess straddles a DST change.
  return new Date(guess - tzOffsetMs(tz, first));
}

/** "YYYY-MM-DD" of the instant as seen in `tz`. */
export function zonedDate(utc: Date | string | number, tz: string): string {
  const p = zonedParts(new Date(utc).getTime(), tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function zonedMinutes(utc: Date | string | number, tz: string): number {
  const p = zonedParts(new Date(utc).getTime(), tz);
  return p.hour * 60 + p.minute;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOf(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

export function formatTime(utc: string | Date, tz: string): string {
  return new Date(utc).toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
}

export function formatDate(utc: string | Date, tz: string, style: "short" | "long" = "long"): string {
  return new Date(utc).toLocaleDateString("en-GB", {
    timeZone: tz,
    weekday: style === "long" ? "long" : "short",
    day: "numeric",
    month: style === "long" ? "long" : "short",
  });
}

/** Label a plain "YYYY-MM-DD" without timezone drift. */
export function formatDay(date: string, style: "short" | "long" = "short"): string {
  return formatDate(`${date}T12:00:00Z`, "UTC", style);
}

// Intl only gives "GMT+1" for West Africa; people here say WAT.
const KNOWN_ABBREV: Record<string, string> = { "Africa/Lagos": "WAT", "Africa/Accra": "GMT" };

export function tzAbbrev(tz: string, at: Date = new Date()): string {
  if (KNOWN_ABBREV[tz]) return KNOWN_ABBREV[tz];
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  return name ?? tz;
}

export function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
