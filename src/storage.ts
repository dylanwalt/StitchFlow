import type { AppState } from "./types";

export const STORAGE_KEY = "stitchflow.app-state.v1";

export function loadState(seed: AppState): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return seed;
    const parsed = JSON.parse(saved) as AppState;
    if (parsed.version !== seed.version || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.subjects)) {
      return seed;
    }
    return parsed;
  } catch {
    return seed;
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function exportState(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

export function parseImportedState(value: string, seed: AppState): AppState | null {
  try {
    const parsed = JSON.parse(value) as AppState;
    if (parsed.version !== seed.version || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.subjects)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
