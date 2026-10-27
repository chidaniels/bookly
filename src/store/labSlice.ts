import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { SimScenario } from "@/lib/types";

export const SCENARIO_INFO: Record<SimScenario, { label: string; detail: string }> = {
  normal: { label: "Normal", detail: "Payment settles in about 2.5s." },
  slow: { label: "Slow 3G", detail: "Response takes 3s, settlement takes 5s." },
  timeout: { label: "Timeout", detail: "Server records the charge but replies after 15s. The client gives up at 8s." },
  decline: { label: "Bank declines", detail: "Payment is accepted, then fails at settlement." },
  currency_mismatch: {
    label: "Wrong currency",
    detail: "API echoes the right number in the wrong currency (₦ ↔ $).",
  },
};

interface LabState {
  scenario: SimScenario;
  open: boolean;
}

const labSlice = createSlice({
  name: "lab",
  initialState: { scenario: "normal", open: false } as LabState,
  reducers: {
    scenarioChanged(state, action: PayloadAction<SimScenario>) {
      state.scenario = action.payload;
    },
    labToggled(state) {
      state.open = !state.open;
    },
  },
});

export const { scenarioChanged, labToggled } = labSlice.actions;
export default labSlice.reducer;
