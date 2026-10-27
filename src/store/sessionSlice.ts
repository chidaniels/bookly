import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type Session =
  | { role: "customer"; name: string; email: string }
  | { role: "provider"; name: string; providerSlug: string };

interface SessionState {
  /** False until localStorage has been read, so guards don't redirect during hydration. */
  hydrated: boolean;
  user: Session | null;
}

const initialState: SessionState = { hydrated: false, user: null };

const sessionSlice = createSlice({
  name: "session",
  initialState,
  reducers: {
    hydrated(state, action: PayloadAction<Session | null>) {
      state.user = action.payload;
      state.hydrated = true;
    },
    signedIn(state, action: PayloadAction<Session>) {
      state.user = action.payload;
    },
    signedOut(state) {
      state.user = null;
    },
  },
});

export const { hydrated, signedIn, signedOut } = sessionSlice.actions;
export default sessionSlice.reducer;
