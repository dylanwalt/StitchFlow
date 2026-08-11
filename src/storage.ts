import { defaultImpact, phaseForKind } from "./planner";
import type { AppState, ChapterProgress, StudySession, StudyTask, TaskKind } from "./types";

export const STORAGE_VERSION = 3;
export const STORAGE_KEY = "stitchflow.app-state.v3";
const PREVIOUS_STORAGE_KEY = "stitchflow.app-state.v2";
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
    status: raw.status === "done" || raw.status === "in-progress" || raw.status === "snoozed" ? raw.status : "todo",
    completionPercent: raw.completionPercent === 50 || raw.completionPercent === 80 || raw.completionPercent === 100 ? raw.completionPercent : undefined,
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

function normalizeChapter(raw: Partial<ChapterProgress>): ChapterProgress | null {
  const chapterNumber = raw.chapterNumber;
  if (!raw.id || !raw.subjectCode || typeof chapterNumber !== "number" || !Number.isInteger(chapterNumber) || chapterNumber < 1) return null;
  return {
    id: raw.id,
    subjectCode: raw.subjectCode,
    chapterNumber,
    readThrough: Boolean(raw.readThrough),
    summarized: Boolean(raw.summarized),
    confident: Boolean(raw.confident),
    reviewed: Boolean(raw.reviewed),
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

function makeChapter(subjectCode: ChapterProgress["subjectCode"], chapterNumber: number, updatedAt: string): ChapterProgress {
  return {
    id: `${subjectCode}-chapter-${chapterNumber}`,
    subjectCode,
    chapterNumber,
    readThrough: false,
    summarized: false,
    confident: false,
    reviewed: false,
    updatedAt,
  };
}

function normalizeChapters(rawChapters: unknown, seed: AppState, subjects: AppState["subjects"], updatedAt: string): ChapterProgress[] {
  const parsed = Array.isArray(rawChapters)
    ? rawChapters.map((chapter) => normalizeChapter(chapter)).filter((chapter): chapter is ChapterProgress => Boolean(chapter))
    : [];
  const result = [...parsed];
  for (const subject of subjects) {
    const target = subject.targetChapter;
    if (target <= 0 || result.some((chapter) => chapter.subjectCode === subject.code)) continue;
    const seeded = seed.chapters.filter((chapter) => chapter.subjectCode === subject.code);
    result.push(...Array.from({ length: target }, (_, index) => {
      const chapterNumber = index + 1;
      const seedChapter = seeded.find((chapter) => chapter.chapterNumber === chapterNumber);
      return seedChapter
        ? { ...seedChapter, updatedAt }
        : { ...makeChapter(subject.code, chapterNumber, updatedAt), readThrough: chapterNumber <= Math.max(0, subject.currentChapter) };
    }));
  }
  return result;
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
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== STORAGE_VERSION) return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.events) || !Array.isArray(raw.tasks)) return null;
  const tasks = raw.tasks.map((task) => normalizeTask(task)).filter((task): task is StudyTask => Boolean(task));
  if (tasks.length !== raw.tasks.length) return null;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((session) => normalizeSession(session)).filter((session): session is StudySession => Boolean(session))
    : [];
  const updatedAt = raw.updatedAt ?? seed.updatedAt;
  return {
    ...seed,
    ...raw,
    version: STORAGE_VERSION,
    subjects: raw.subjects,
    events: raw.events,
    tasks,
    sessions,
    chapters: normalizeChapters(raw.chapters, seed, raw.subjects, updatedAt),
    checkpoints: Array.isArray(raw.checkpoints) ? raw.checkpoints : [],
    settings: { ...seed.settings, ...(raw.settings ?? {}) },
    updatedAt,
  };
}

export function loadState(seed: AppState): AppState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
