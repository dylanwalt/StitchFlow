import { createCalendarAlignedTasks, defaultImpact, phaseForKind } from "./planner";
import type { AppState, ChapterCheckpoint, ChapterProgress, Flashcard, PaperMode, StudySession, StudyTask, TaskKind } from "./types";

export const STORAGE_VERSION = 5;
export const STORAGE_KEY = "stitchflow.app-state.v5";
const PREVIOUS_STORAGE_KEY = "stitchflow.app-state.v4";
const LEGACY_STORAGE_KEY = "stitchflow.app-state.v3";
const OLDER_STORAGE_KEY = "stitchflow.app-state.v2";
const ORIGINAL_STORAGE_KEY = "stitchflow.app-state.v1";

function isSubjectCode(value: unknown): value is AppState["subjects"][number]["code"] {
  return value === "F102" || value === "F108";
}

function isTaskKind(value: unknown): value is TaskKind {
  return value === "learn" || value === "recall" || value === "practice" || value === "error-review" || value === "milestone";
}

function isPaperMode(value: unknown): value is PaperMode {
  return value === "question-drill" || value === "timed-sit-down";
}

function normalizeTask(raw: Partial<StudyTask>): StudyTask | null {
  if (!raw.id || !isSubjectCode(raw.subjectCode) || !raw.title || !raw.dueDate || !isTaskKind(raw.kind)) return null;
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
    chapterRange: raw.chapterRange,
    paperName: raw.paperName,
    archived: raw.archived ?? false,
    manuallyScheduled: raw.manuallyScheduled ?? false,
    sourceEventId: raw.sourceEventId,
    planningRole: raw.planningRole,
    fixed: raw.fixed ?? false,
    createdAt: raw.createdAt ?? new Date().toISOString(),
    lastCompletedAt: raw.lastCompletedAt,
    revisitDate: raw.revisitDate,
    confidence: raw.confidence,
    paperMode: isPaperMode(raw.paperMode) ? raw.paperMode : undefined,
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
    ? rawChapters.map((chapter) => normalizeChapter(chapter)).filter((chapter): chapter is ChapterProgress => chapter !== null && isSubjectCode(chapter.subjectCode))
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

function normalizeFlashcard(raw: Partial<Flashcard>, index: number): Flashcard | null {
  if (!raw || typeof raw.front !== "string" || typeof raw.back !== "string") return null;
  return {
    id: raw.id || `flashcard-${index + 1}`,
    front: raw.front,
    back: raw.back,
  };
}

function normalizeCheckpoint(raw: Partial<ChapterCheckpoint>): ChapterCheckpoint | null {
  if (!raw.id || !raw.subjectCode) return null;
  const labelChapter = raw.chapterLabel?.match(/\d+/)?.[0];
  const chapterNumber = Number.isInteger(raw.chapterNumber) && Number(raw.chapterNumber) > 0
    ? Number(raw.chapterNumber)
    : Number(labelChapter) > 0 ? Number(labelChapter) : 1;
  return {
    id: raw.id,
    subjectCode: raw.subjectCode,
    chapterNumber,
    chapterLabel: raw.chapterLabel ?? `Chapter ${chapterNumber}`,
    keyIdeas: raw.keyIdeas ?? "",
    formulas: raw.formulas ?? "",
    uncertainty: raw.uncertainty ?? "",
    examQuestion: raw.examQuestion ?? "",
    flashcards: Array.isArray(raw.flashcards)
      ? raw.flashcards.map((flashcard, index) => normalizeFlashcard(flashcard, index)).filter((flashcard): flashcard is Flashcard => Boolean(flashcard))
      : [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

export function migrateState(value: unknown, seed: AppState): AppState | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<AppState>;
  if (raw.version !== 1 && raw.version !== 2 && raw.version !== 3 && raw.version !== 4 && raw.version !== STORAGE_VERSION) return null;
  if (!Array.isArray(raw.subjects) || !Array.isArray(raw.events) || !Array.isArray(raw.tasks)) return null;
  const subjects = seed.subjects.map((subject) => {
    const saved = raw.subjects?.find((candidate) => candidate.code === subject.code && isSubjectCode(candidate.code));
    return saved ? { ...subject, ...saved, examDates: subject.examDates, syllabusChapterTotal: subject.syllabusChapterTotal, supplementalSections: subject.supplementalSections } : subject;
  });
  const sourceTasks = raw.tasks.filter((task) => isSubjectCode(task.subjectCode));
  const normalizedTasks = sourceTasks.map((task) => normalizeTask(task)).filter((task): task is StudyTask => Boolean(task));
  if (normalizedTasks.length !== sourceTasks.length) return null;
  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.filter((session) => isSubjectCode(session.subjectCode)).map((session) => normalizeSession(session)).filter((session): session is StudySession => Boolean(session))
    : [];
  const updatedAt = raw.updatedAt ?? seed.updatedAt;
  const sourceEvents = (raw.events ?? []).filter((event) => !event.subjectCode || isSubjectCode(event.subjectCode));
  const sourceEventsById = new Map(sourceEvents.map((event) => [event.id, event]));
  const canonicalEventIds = new Set(seed.events.map((event) => event.id));
  const events = [
    ...seed.events.map((event) => sourceEventsById.has(event.id) ? { ...sourceEventsById.get(event.id), ...event } : event),
    ...sourceEvents.filter((event) => !canonicalEventIds.has(event.id)),
  ];
  const checklistEventIds = new Set(events.filter((event) => event.kind === "checklist").map((event) => event.id));
  const seedTasksById = new Map(seed.tasks.map((task) => [task.id, task]));
  const preservedTasks = normalizedTasks.map((task) => {
    const canonical = seedTasksById.get(task.id);
    const merged = canonical ? { ...canonical, dueDate: task.manuallyScheduled ? task.dueDate : canonical.dueDate, manuallyScheduled: task.manuallyScheduled, status: task.status, completionPercent: task.completionPercent, lastCompletedAt: task.lastCompletedAt, revisitDate: task.revisitDate, confidence: task.confidence } : task;
    return checklistEventIds.has(task.sourceEventId ?? "") ? { ...merged, archived: true } : merged;
  });
  const existingTaskIds = new Set(preservedTasks.map((task) => task.id));
  const missingSeedTasks = seed.tasks.filter((task) => !existingTaskIds.has(task.id));
  const calendarTasks = createCalendarAlignedTasks(events, subjects, updatedAt).filter((task) => !existingTaskIds.has(task.id));
  return {
    ...seed,
    ...raw,
    version: STORAGE_VERSION,
    subjects,
    events,
    tasks: [...preservedTasks, ...missingSeedTasks, ...calendarTasks],
    sessions,
    chapters: normalizeChapters(raw.chapters, seed, subjects, updatedAt),
    checkpoints: Array.isArray(raw.checkpoints)
      ? raw.checkpoints.filter((checkpoint) => isSubjectCode(checkpoint.subjectCode)).map((checkpoint) => normalizeCheckpoint(checkpoint)).filter((checkpoint): checkpoint is ChapterCheckpoint => Boolean(checkpoint))
      : [],
    settings: { ...seed.settings, ...(raw.settings ?? {}) },
    updatedAt,
  };
}

export function loadState(seed: AppState): AppState {
  try {
    const saved = [STORAGE_KEY, PREVIOUS_STORAGE_KEY, LEGACY_STORAGE_KEY, OLDER_STORAGE_KEY, ORIGINAL_STORAGE_KEY]
      .map((key) => localStorage.getItem(key))
      .find((value): value is string => Boolean(value));
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
