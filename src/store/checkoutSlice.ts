import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { formatMoney, isMoney, sameMoney } from "@/lib/money";
import type { BookingStatus, Customer, Money, Payment } from "@/lib/types";
import { api } from "./api";
import type { AppDispatch, RootState } from "./index";

/**
 * Payment state machine for the checkout screen.
 *
 *   idle ──pay──▶ submitting ──201──▶ processing ──poll──▶ succeeded
 *                     │                    │                  ▲
 *                     │ 8s timeout         └──poll──▶ failed  │ verify
 *                     ▼                                       │
 *                  unknown ──poll──▶ (found? resume : idle)   mismatch
 *
 * Rules the UI depends on:
 *  - One idempotency key per attempt. Double taps, retries after a timeout and a page refresh
 *    all reuse it, so the server can never create two charges. A new key is only minted after
 *    the server has definitively said "failed".
 *  - "succeeded" is only ever set from a server response whose amount AND currency equal the
 *    quote shown on the button. Anything else is "mismatch" until re-verified.
 *  - "unknown" is a first-class state: we tell the user we're checking, never "failed".
 */

export type PayPhase =
  | "idle"
  | "submitting"
  | "processing"
  | "unknown"
  | "succeeded"
  | "failed"
  | "mismatch"
  | "expired"
  | "error";

interface CheckoutState {
  bookingId: string | null;
  idempotencyKey: string | null;
  quoted: Money | null;
  phase: PayPhase;
  message: string | null;
  received: Money | null;
  polling: boolean;
}

const initialState: CheckoutState = {
  bookingId: null,
  idempotencyKey: null,
  quoted: null,
  phase: "idle",
  message: null,
  received: null,
  polling: false,
};

export const CLIENT_TIMEOUT_MS = 8_000;
const POLL_EVERY_MS = 1_500;
const POLL_MAX_TRIES = 16;
const STORAGE_KEY = "bookly.checkout";

const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

const IN_FLIGHT: PayPhase[] = ["submitting", "processing", "unknown"];

type ApiErr = { code: string; message: string; paymentId?: string };

type PayResult =
  | { kind: "accepted"; payment: Payment }
  | { kind: "mismatch"; received: Money | null }
  | { kind: "timeout" }
  | { kind: "rejected"; error: ApiErr };

type PollResult =
  | { kind: "settled"; payment: Payment; bookingStatus: BookingStatus }
  | { kind: "not_found" }
  | { kind: "still_processing" };

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });

function headersFor(state: RootState) {
  const user = state.session.user;
  return {
    "content-type": "application/json",
    ...(user?.role === "customer" ? { "x-user-email": user.email } : {}),
    "x-sim-scenario": state.lab.scenario,
  };
}

export const pollPayment = createAsyncThunk<
  PollResult,
  void,
  { state: RootState; dispatch: AppDispatch }
>(
  "checkout/poll",
  async (_, { getState, signal }) => {
    const key = getState().checkout.idempotencyKey!;
    let notFound = 0;
    for (let i = 0; i < POLL_MAX_TRIES; i++) {
      try {
        const res = await fetch(`/api/payments/${encodeURIComponent(key)}`, { signal, cache: "no-store" });
        if (res.status === 404) {
          // After a timeout the POST may still be in flight; only conclude "never arrived" after a few checks.
          if (++notFound >= 3) return { kind: "not_found" };
        } else if (res.ok) {
          const data = (await res.json()) as { payment: Payment; bookingStatus: BookingStatus };
          if (data.payment.status !== "processing") return { kind: "settled", ...data };
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        // Network blip while polling: keep trying, never guess an outcome.
      }
      await sleep(POLL_EVERY_MS, signal);
    }
    return { kind: "still_processing" };
  },
  { condition: (_, { getState }) => !getState().checkout.polling && !!getState().checkout.idempotencyKey },
);

export const payBooking = createAsyncThunk<
  PayResult,
  { customer: Customer },
  { state: RootState; dispatch: AppDispatch }
>(
  "checkout/pay",
  async ({ customer }, { getState, dispatch }) => {
    const state = getState();
    const { bookingId, idempotencyKey, quoted } = state.checkout;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), CLIENT_TIMEOUT_MS);

    let res: Response;
    try {
      res = await fetch("/api/payments", {
        method: "POST",
        headers: { ...headersFor(state), "idempotency-key": idempotencyKey! },
        body: JSON.stringify({ bookingId, amount: quoted, customer }),
        signal: ctrl.signal,
      });
    } catch {
      // Timed out or the network dropped. The charge may or may not exist: ask the server.
      dispatch(pollPayment());
      return { kind: "timeout" };
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const error = (await res.json().catch(() => null)) as ApiErr | null;
      return {
        kind: "rejected",
        error: error ?? { code: "HTTP_" + res.status, message: "We couldn't reach the payment service." },
      };
    }

    const payment = (await res.json()) as Payment;
    if (!isMoney(payment.amount) || !sameMoney(payment.amount, quoted!)) {
      return { kind: "mismatch", received: isMoney(payment.amount) ? payment.amount : null };
    }
    if (payment.status === "processing") dispatch(pollPayment());
    return { kind: "accepted", payment };
  },
  // The guard that makes a double tap harmless even if the button somehow stays enabled.
  { condition: (_, { getState }) => !IN_FLIGHT.includes(getState().checkout.phase) && getState().checkout.phase !== "succeeded" },
);

function applySettled(state: CheckoutState, payment: Payment, bookingStatus?: BookingStatus) {
  if (payment.status === "succeeded" && state.quoted && sameMoney(payment.amount, state.quoted)) {
    state.phase = "succeeded";
    state.message = null;
  } else if (payment.status === "succeeded") {
    state.phase = "mismatch";
    state.received = payment.amount;
    state.message = "The amount recorded doesn't match your total. We've flagged it for review.";
  } else if (payment.status === "failed") {
    state.phase = bookingStatus === "expired" ? "expired" : "failed";
    state.message = payment.failureReason ?? "The payment didn't go through. You have not been charged.";
  }
}

const checkoutSlice = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    /** Enter checkout for a booking. Re-entering the same booking keeps the key (resume after refresh). */
    checkoutStarted(
      state,
      action: PayloadAction<{ bookingId: string; quoted: Money; restored?: Partial<CheckoutState> | null }>,
    ) {
      const { bookingId, quoted, restored } = action.payload;
      if (state.bookingId === bookingId) return;
      if (restored?.bookingId === bookingId && restored.idempotencyKey) {
        Object.assign(state, initialState, restored, { polling: false });
        state.quoted = quoted;
        return;
      }
      Object.assign(state, initialState, { bookingId, quoted, idempotencyKey: newKey() });
    },
    /** Only after a definitive failure: mint a new key for a genuinely new attempt. */
    retryAfterFailure(state) {
      if (state.phase !== "failed" && state.phase !== "error") return;
      if (state.phase === "failed") state.idempotencyKey = newKey();
      state.phase = "idle";
      state.message = null;
    },
    checkoutReset() {
      return initialState;
    },
  },
  extraReducers: (b) => {
    b.addCase(payBooking.pending, (state) => {
      state.phase = "submitting";
      state.message = null;
      state.received = null;
    });
    b.addCase(payBooking.fulfilled, (state, { payload }) => {
      switch (payload.kind) {
        case "accepted":
          if (payload.payment.status === "processing") state.phase = "processing";
          else applySettled(state, payload.payment);
          break;
        case "timeout":
          state.phase = "unknown";
          state.message = "This is taking longer than usual. We're checking with the payment service. Please don't pay again.";
          break;
        case "mismatch":
          state.phase = "mismatch";
          state.received = payload.received;
          state.message = `The payment service replied with ${
            payload.received ? formatMoney(payload.received) : "an unreadable amount"
          }, but your total is ${formatMoney(state.quoted!)}. We won't show this as paid until it's verified.`;
          break;
        case "rejected": {
          const { code, message } = payload.error;
          if (code === "ALREADY_PAID") {
            state.phase = "succeeded";
          } else if (code === "HOLD_EXPIRED") {
            state.phase = "expired";
            state.message = message;
          } else if (code === "PAYMENT_IN_PROGRESS") {
            state.phase = "error";
            state.message = "A payment for this booking is already running, maybe in another tab. Wait a moment and refresh.";
          } else {
            // Rejected before any charge was created, so retrying with the same key is safe.
            state.phase = "error";
            state.message = message;
          }
        }
      }
    });
    b.addCase(payBooking.rejected, (state) => {
      state.phase = "error";
      state.message = "Something went wrong before we could send your payment. You have not been charged.";
    });

    b.addCase(pollPayment.pending, (state) => {
      state.polling = true;
    });
    b.addCase(pollPayment.fulfilled, (state, { payload }) => {
      state.polling = false;
      if (payload.kind === "settled") applySettled(state, payload.payment, payload.bookingStatus);
      else if (payload.kind === "not_found") {
        state.phase = "error";
        state.message = "Your payment never reached us, so you have not been charged. It's safe to try again.";
      } else {
        state.phase = "unknown";
        state.message = "Your bank is still confirming. Don't pay again. Check back in a minute; this page will update.";
      }
    });
    b.addCase(pollPayment.rejected, (state) => {
      state.polling = false;
    });
  },
});

export const { checkoutStarted, retryAfterFailure, checkoutReset } = checkoutSlice.actions;
export default checkoutSlice.reducer;

// ----- persistence: survive a refresh mid-payment without minting a second key -----

export function loadCheckout(): Partial<CheckoutState> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<CheckoutState>) : null;
  } catch {
    return null;
  }
}

export function saveCheckout(state: CheckoutState) {
  try {
    if (!state.bookingId) sessionStorage.removeItem(STORAGE_KEY);
    else {
      const { bookingId, idempotencyKey, phase, message } = state;
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ bookingId, idempotencyKey, phase, message }));
    }
  } catch {
    // Private mode or storage full: checkout still works, it just can't resume after a refresh.
  }
}

/** Refresh booking data everywhere once money has moved. */
export const invalidateAfterPayment = (bookingId: string) =>
  api.util.invalidateTags([{ type: "Booking", id: bookingId }, "Bookings"]);
