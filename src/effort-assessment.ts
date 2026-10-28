import { DEFAULT_EFFORT_THRESHOLDS } from "./effort-policy.ts";
import { loadJevConfig, type JevConfig } from "./jev-config.ts";
import { effectiveTunables, type TunableConfig } from "./tuning.ts";

export interface EffortAssessment {
  readonly config: JevConfig;
  readonly tuning: Readonly<TunableConfig>;
}

/** Capture file base and learned overlay before asynchronous assessment work. */
export function captureEffortAssessment(workerTimeoutMs?: number): EffortAssessment {
  const config = loadJevConfig();
  const tuning = effectiveTunables({
    ...DEFAULT_EFFORT_THRESHOLDS,
    timeoutMs: config.classifier.timeoutMs,
  });
  return Object.freeze({
    config,
    tuning: Object.freeze({ ...tuning, timeoutMs: workerTimeoutMs ?? tuning.timeoutMs }),
  });
}
