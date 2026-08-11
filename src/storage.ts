import { defaultImpact, phaseForKind } from "./planner";
import type { AppState, StudySession, StudyTask, TaskKind } from "./types";

export const STORAGE_VERSION = 2;
export const STORAGE_KEY = "stitchflow.app-state.v2";
const LEGACY_STORAGE_KEY = "stitchflow.app-state.v1";

function isTaskKind(value: unknown): value is TaskKind {
  return value === "learn" || value === "recall" || value === "practice" || value === "error-review" || value === "milestone";
}

function normalizeTask(raw: Partial<StudyTask>): StudyTask | null {
  if (!raw.id || !raw.subjectCode || !raw.title || !raw.dueDate || !isTaskKind(raw.kind)) return null;
  const kind = raw.kind;
  return {
    id: raw.id,
    subjectCode: raw.subjectCode,
    kind,
    title: raw.title,
    detail: raw.detail,
    dueDate: raw.dueDate,
    estimatedMinutes: Number.isFinite(raw.estimatedMinutes) ? Number(raw.estimatedMinutes) : 25,
    status: raw.status === "done" || raw.status === "snoozed" ? raw.status : "todo",
    priority: Number.isFinite(raw.priority) ? Number(raw.priority) : 1,
    phase: raw.phase ?? phaseForKind(kind),
    impact: raw.impact ?? defaultImpact(kind),
    coverageUnits: raw.coverageUnits ?? 0,
    paperName: raw.paperName,
    archived: raw.archived ?? false,
    sourceEventId: raw.sourceEventId,
    fixed: raw.fixed ?? false,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    lastCompletedAt: raw.lastCompletedAt,
    revisitDate: raw.revisitDate,
    confidence: raw.confidence,
  };
}

function normalizeSession(raw: Partial<StudySession>): StudySession | null {
  if (!raw.id || !raw.date || !raw.subjectCode || !Number.isFinite(raw.durationMinutes)) return null;
  return {
    id: raw.id,
    date: raw.date,
    subjectCode: raw.subjectCode,
    durationMinutes: Number(raw.durationMinutes),
    kind: raw.kind === "past-paper" ? "past-paper" : "focus",
    taskId: raw.taskId,
    note: raw.note,
    paperName: raw.paperName,
    paperDate: raw.paperDate,
    score: raw.score,
    attemptedMinutes: raw.attemptedMinutes,
    errorCount: raw.errorCount,
    nextAction: raw.nextAction,
    confidence: raw.confidence,
  };
}

export function migrateState(value: unknown, seed: AppState): AppState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AppState>;
  if (raw.version !== 1 && raw.version !== STORAGE_VERSION) return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.events) || !Array.isArray(raw.tasks)) return null;
  const tasks = raw.tasks.map((task) => normalizeTask(task)).filter((task): task is StudyTask => Boolean(task));
  if (tasks.length !== raw.tasks.length) return null;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((session) => normalizeSession(session)).filter((session): session is StudySession => Boolean(session))
    : [];
  return {
    ...seed,
    ...raw,
    version: STORAGE_VERSION,
    subjects: raw.subjects,
    events: raw.events,
    tasks,
    sessions,
    checkpoints: Array.isArray(raw.checkpoints) ? raw.checkpoints : [],
    settings: { ...seed.settings, ...(raw.settings ?? {}) },
    updatedAt: raw.updatedAt ?? seed.updatedAt,
  };
}

export function loadState(seed: AppState): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!saved) return seed;
    return migrateState(JSON.parse(saved), seed) ?? seed;
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
    return migrateState(JSON.parse(value), seed);
  } catch {
    return null;
  }
}
