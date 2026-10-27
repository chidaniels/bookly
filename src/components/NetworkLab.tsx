"use client";

import type { SimScenario } from "@/lib/types";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { labToggled, SCENARIO_INFO, scenarioChanged } from "@/store/labSlice";

/** Lets reviewers force each payment edge case without touching code. */
export function NetworkLab() {
  const { scenario, open } = useAppSelector((s) => s.lab);
  const dispatch = useAppDispatch();

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {open && (
        <div className="card w-[min(20rem,calc(100vw-2rem))] p-4 shadow-xl" role="dialog" aria-label="Network lab">
          <p className="text-sm font-semibold">Network lab</p>
          <p className="mb-3 text-xs text-muted">Choose what the payment API does on your next payment.</p>
          <fieldset className="space-y-1.5">
            {(Object.keys(SCENARIO_INFO) as SimScenario[]).map((key) => (
              <label
                key={key}
                className={`flex cursor-pointer gap-3 rounded-xl border p-2.5 text-sm ${
                  scenario === key ? "border-brand-500 bg-brand-50" : "border-line"
                }`}
              >
                <input
                  type="radio"
                  name="scenario"
                  className="mt-0.5 accent-brand-600"
                  checked={scenario === key}
                  onChange={() => dispatch(scenarioChanged(key))}
                />
                <span>
                  <span className="block font-medium">{SCENARIO_INFO[key].label}</span>
                  <span className="block text-xs text-muted">{SCENARIO_INFO[key].detail}</span>
                </span>
              </label>
            ))}
          </fieldset>
        </div>
      )}
      <button
        onClick={() => dispatch(labToggled())}
        className={`btn shadow-lg ${scenario === "normal" ? "bg-ink text-white" : "bg-amber-400 text-ink"}`}
        aria-expanded={open}
      >
        <span aria-hidden>⚙</span> Network lab{scenario !== "normal" && `: ${SCENARIO_INFO[scenario].label}`}
      </button>
    </div>
  );
}
