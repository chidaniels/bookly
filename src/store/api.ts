import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import type { BookingView, DashboardData, Provider, Slot, WeeklyHours } from "@/lib/types";
import type { RootState } from "./index";

export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: "/api",
    prepareHeaders(headers, { getState }) {
      const user = (getState() as RootState).session.user;
      if (user?.role === "customer") headers.set("x-user-email", user.email);
      return headers;
    },
  }),
  tagTypes: ["Slots", "Booking", "Bookings", "Dashboard", "Provider"],
  endpoints: (b) => ({
    getProvider: b.query<Provider, string>({
      query: (slug) => `/providers/${slug}`,
      providesTags: (_r, _e, slug) => [{ type: "Provider", id: slug }],
    }),
    getSlots: b.query<Slot[], { slug: string; serviceId: string; date: string; ignore?: string }>({
      query: ({ slug, ...params }) => ({ url: `/providers/${slug}/slots`, params }),
      providesTags: (_r, _e, a) => [{ type: "Slots", id: a.slug }],
    }),
    createHold: b.mutation<
      BookingView,
      { providerSlug: string; serviceId: string; startUtc: string; customer: { name: string; email: string } }
    >({
      query: (body) => ({ url: "/holds", method: "POST", body }),
      invalidatesTags: (_r, _e, a) => [{ type: "Slots", id: a.providerSlug }],
    }),
    getBooking: b.query<BookingView, string>({
      query: (id) => `/bookings/${id}`,
      providesTags: (_r, _e, id) => [{ type: "Booking", id }],
    }),
    getMyBookings: b.query<BookingView[], void>({
      query: () => "/bookings",
      providesTags: ["Bookings"],
    }),
    updateBooking: b.mutation<
      BookingView,
      { id: string; action: "cancel" | "release" } | { id: string; action: "reschedule"; startUtc: string }
    >({
      query: ({ id, ...body }) => ({ url: `/bookings/${id}`, method: "PATCH", body }),
      invalidatesTags: (r, _e, a) => [
        { type: "Booking", id: a.id },
        "Bookings",
        ...(r ? [{ type: "Slots" as const, id: r.providerSlug }, { type: "Dashboard" as const, id: r.providerSlug }] : []),
      ],
    }),
    getDashboard: b.query<DashboardData, string>({
      query: (slug) => `/providers/${slug}/dashboard`,
      providesTags: (_r, _e, slug) => [{ type: "Dashboard", id: slug }],
    }),
    updateAvailability: b.mutation<Provider, { slug: string; hours: WeeklyHours; slotStepMin: number }>({
      query: ({ slug, ...body }) => ({ url: `/providers/${slug}/availability`, method: "PUT", body }),
      invalidatesTags: (_r, _e, a) => [
        { type: "Provider", id: a.slug },
        { type: "Slots", id: a.slug },
        { type: "Dashboard", id: a.slug },
      ],
    }),
  }),
});

export const {
  useGetProviderQuery,
  useGetSlotsQuery,
  useCreateHoldMutation,
  useGetBookingQuery,
  useGetMyBookingsQuery,
  useUpdateBookingMutation,
  useGetDashboardQuery,
  useUpdateAvailabilityMutation,
} = api;

/** Pulls the server's `{ code, message }` out of an RTK Query error. */
export function apiErrorOf(error: unknown): { code: string; message: string } | null {
  if (!error || typeof error !== "object") return null;
  const e = error as { status?: unknown; data?: { code?: string; message?: string } };
  if (e.data?.message) return { code: e.data.code ?? "UNKNOWN", message: e.data.message };
  if (e.status === "FETCH_ERROR") return { code: "NETWORK", message: "You appear to be offline. Check your connection." };
  return { code: "UNKNOWN", message: "Something went wrong. Please try again." };
}
