import type { SpringConfig } from "../types";

export type SpringPresetKeys = "default" | "gentle" | "wobbly" | "stiff" | "slow" | "molasses";

export const SPRING_PRESETS: Record<SpringPresetKeys, SpringConfig> = {
  default: {
    stiffness: 170,
    damping: 26,
  },
  gentle: {
    stiffness: 120,
    damping: 14,
  },
  wobbly: {
    stiffness: 180,
    damping: 12,
  },
  stiff: {
    stiffness: 210,
    damping: 20,
  },
  slow: {
    stiffness: 280,
    damping: 60,
  },
  molasses: {
    stiffness: 280,
    damping: 120,
  },
};
