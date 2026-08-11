import type {
  AppState,
  ChapterMetrics,
  ChapterProgress,
  Confidence,
  PlannerSummary,
  StudyPhase,
  StudyTask,
  Subject,
  SubjectCode,
  SubjectProgress,
  TaskImpact,
  TaskKind,
} from "./types";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const DAILY_SOFT_CAP_MINUTES = 150;

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function addDays(dateString: string, days: number): string {
  const date = parseISODate(dateString);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}

export function daysUntil(examDate: string, today = toISODate(new Date())): number {
  const difference = parseISODate(examDate).getTime() - parseISODate(today).getTime();
  return Math.ceil(difference / 86_400_000);
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", { day: "numeric", month: "short" }).format(parseISODate(value));
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(value));
}

export function phaseForKind(kind: TaskKind): StudyPhase {
  if (kind === "learn") return "understand";
  if (kind === "recall") return "retrieve";
  if (kind === "practice") return "practice";
  if (kind === "error-review") return "review";
  return "understand";
}

export function defaultImpact(kind: TaskKind): TaskImpact {
  switch (kind) {
    case "learn":
      return { coverage: 1, retrieval: 0, practice: 0, description: "Adds one coverage block to the subject runway." };
    case "recall":
      return { coverage: 0, retrieval: 1, practice: 0, description: "Strengthens retrieval: recalling before looking." };
    case "practice":
      return { coverage: 0, retrieval: 1, practice: 1, description: "Builds timed exam practice and exposes gaps." };
    case "error-review":
      return { coverage: 0, retrieval: 1, practice: 1, description: "Turns past mistakes into the next useful questions." };
    default:
      return { coverage: 1, retrieval: 0, practice: 0, description: "Moves the next milestone into reach." };
  }
}

export function getChapterMetrics(subjectCode: SubjectCode, chapters: ChapterProgress[]): ChapterMetrics {
  const subjectChapters = chapters.filter((chapter) => chapter.subjectCode === subjectCode);
  const total = subjectChapters.length;
  const readThrough = subjectChapters.filter((chapter) => chapter.readThrough).length;
  const summarized = subjectChapters.filter((chapter) => chapter.summarized).length;
  const confident = subjectChapters.filter((chapter) => chapter.confident).length;
  const reviewed = subjectChapters.filter((chapter) => chapter.reviewed).length;
  const completedChecks = subjectChapters.reduce((sum, chapter) => sum + Number(chapter.readThrough) + Number(chapter.summarized) + Number(chapter.confident) + Number(chapter.reviewed), 0);
  return { total, readThrough, summarized, confident, reviewed, completionPercent: total ? Math.round((completedChecks / (total * 4)) * 100) : 0 };
}

export function taskPriority(
  task: StudyTask,
  subject: Subject,
  today = toISODate(new Date()),
  gap = Math.max(0, subject.targetChapter - subject.currentChapter),
): number {
  const days = Math.max(0, daysUntil(subject.examDates[0], today));
  const urgency = Math.max(0, 45 - days / 2);
  const overdue = task.dueDate < today ? 24 : 0;
  const dueSoon = Math.max(0, 12 - Math.max(0, daysUntil(task.dueDate, today))) * 2;
  const gapPressure = subject.targetChapter > 0 ? (gap / subject.targetChapter) * 24 : 0;
  const kindWeight = task.kind === "practice" ? 14 : task.kind === "error-review" ? 12 : task.kind === "recall" ? 9 : 5;
  const fixedWeight = task.fixed ? 8 : 0;
  return Math.round(urgency + overdue + dueSoon + gapPressure + kindWeight + fixedWeight);
}

function completedCoverageUnits(subject: Subject, tasks: StudyTask[]): number {
  return subject.currentChapter + tasks
    .filter((task) => task.subjectCode === subject.code && task.status === "done" && !task.archived)
    .reduce((total, task) => total + (task.coverageUnits ?? 0), 0);
}

function completedCount(tasks: StudyTask[], predicate: (task: StudyTask) => boolean): number {
  return tasks.filter((task) => task.status === "done" && !task.archived && predicate(task)).length;
}

export function getSubjectProgress(subject: Subject, tasks: StudyTask[], sessions: AppState["sessions"] = [], chapters: ChapterProgress[] = []): SubjectProgress {
  const subjectTasks = tasks.filter((task) => task.subjectCode === subject.code);
  const subjectSessions = sessions.filter((session) => session.subjectCode === subject.code);
  const chapterMetrics = getChapterMetrics(subject.code, chapters);
  const retrievalTasks = subjectTasks.filter((task) => task.kind === "recall" || task.kind === "practice" || task.kind === "error-review");
  const practiceTasks = subjectTasks.filter((task) => task.kind === "practice" || task.kind === "error-review");
  const plannedBlocks = subjectTasks.filter((task) => !task.archived && task.status !== "done").length + subjectTasks.filter((task) => !task.archived && task.status === "done").length;
  const completedBlocks = subjectTasks.filter((task) => task.status === "done" && !task.archived).length + subjectSessions.length;

  if (chapterMetrics.total > 0) {
    const taskPracticePercent = practiceTasks.length ? Math.round((completedCount(subjectTasks, (task) => practiceTasks.includes(task)) / practiceTasks.length) * 100) : 0;
    return {
      subjectCode: subject.code,
      coveragePercent: Math.round((chapterMetrics.readThrough / chapterMetrics.total) * 100),
      coverageUnits: chapterMetrics.readThrough,
      targetUnits: chapterMetrics.total,
      retrievalPercent: Math.round((chapterMetrics.confident / chapterMetrics.total) * 100),
      practicePercent: taskPracticePercent,
      completedBlocks,
      plannedBlocks,
      label: `Read through ${chapterMetrics.readThrough} of ${chapterMetrics.total}`,
    };
  }

  if (subject.code === "A311") {
    const plannedPapers = Math.max(1, subjectTasks.filter((task) => task.kind === "practice" && task.fixed).length);
    const papersDone = subjectTasks.filter((task) => task.kind === "practice" && task.status === "done").length + subjectSessions.filter((session) => session.kind === "past-paper").length;
    return {
      subjectCode: subject.code,
      coveragePercent: Math.min(100, Math.round((papersDone / plannedPapers) * 100)),
      coverageUnits: papersDone,
      targetUnits: plannedPapers,
      retrievalPercent: Math.min(100, Math.round((papersDone / plannedPapers) * 100)),
      practicePercent: Math.min(100, Math.round((papersDone / plannedPapers) * 100)),
      completedBlocks,
      plannedBlocks,
      label: `${papersDone} paper block${papersDone === 1 ? "" : "s"} logged`,
    };
  }

  const coverageUnits = Math.min(subject.targetChapter, completedCoverageUnits(subject, tasks));
  return {
    subjectCode: subject.code,
    coveragePercent: subject.targetChapter ? Math.round((coverageUnits / subject.targetChapter) * 100) : 0,
    coverageUnits,
    targetUnits: subject.targetChapter,
    retrievalPercent: retrievalTasks.length ? Math.round((completedCount(subjectTasks, (task) => retrievalTasks.includes(task)) / retrievalTasks.length) * 100) : 0,
    practicePercent: practiceTasks.length ? Math.round((completedCount(subjectTasks, (task) => practiceTasks.includes(task)) / practiceTasks.length) * 100) : 0,
    completedBlocks,
    plannedBlocks,
    label: `Through chapter ${coverageUnits} of ${subject.targetChapter}`,
  };
}

export function getSubjectSummary(
  subject: Subject,
  today = toISODate(new Date()),
  tasks: StudyTask[] = [],
  chapters: ChapterProgress[] = [],
): PlannerSummary {
  const daysToExam = Math.max(0, daysUntil(subject.examDates[0], today));
  const progress = getSubjectProgress(subject, tasks, [], chapters);
  const gap = subject.code === "A311" ? 0 : Math.max(0, progress.targetUnits - progress.coverageUnits);
  const behind = subject.code !== "A311" && gap >= 4 && daysToExam < 100;
  return {
    subjectCode: subject.code,
    behind,
    gap,
    daysToExam,
    label: behind ? `${gap} chapter gap` : subject.code === "A311" ? "revision mode" : "on a steady path",
  };
}

function getNextPlanningDate(candidate: string, occupied: Set<string>): string {
  let next = candidate;
  while (occupied.has(next)) next = addDays(next, 1);
  return next;
}

/**
 * Rebalances unfinished, movable work around fixed events and a soft daily capacity.
 * It uses the actual subject gap, exam urgency, and task phase; it never moves completed work.
 */
export function replanTasks(state: AppState, today = toISODate(new Date())): StudyTask[] {
  const subjects = new Map<SubjectCode, Subject>(state.subjects.map((subject) => [subject.code, subject]));
  const occupied = new Set([
    ...state.events.filter((event) => event.fixed).map((event) => event.date),
    ...state.tasks.filter((task) => task.fixed && task.status !== "done").map((task) => task.dueDate),
  ]);
  const gaps = new Map(state.subjects.map((subject) => [subject.code, getSubjectSummary(subject, today, state.tasks, state.chapters).gap]));
  const movable = state.tasks
    .filter((task) => task.status !== "done" && !task.fixed && !task.archived)
    .map((task) => {
      const subject = subjects.get(task.subjectCode)!;
      return { ...task, priority: taskPriority(task, subject, today, gaps.get(task.subjectCode) ?? 0) };
    })
    .sort((a, b) => b.priority - a.priority || a.dueDate.localeCompare(b.dueDate));

  const assignments = new Map<string, string>();
  const dailyMinutes = new Map<string, number>();
  let cursor = today;

  for (const task of movable) {
    const subject = subjects.get(task.subjectCode)!;
    const deadline = addDays(subject.examDates[0], -1);
    let date = getNextPlanningDate(task.dueDate < today ? today : cursor, occupied);
    let guard = 0;
    while (
      guard < 120 &&
      (date > deadline || ((dailyMinutes.get(date) ?? 0) > 0 && (dailyMinutes.get(date) ?? 0) + task.estimatedMinutes > DAILY_SOFT_CAP_MINUTES))
    ) {
      date = getNextPlanningDate(addDays(date, 1), occupied);
      guard += 1;
    }
    if (date > deadline) date = deadline;
    assignments.set(task.id, date);
    dailyMinutes.set(date, (dailyMinutes.get(date) ?? 0) + task.estimatedMinutes);
    cursor = date;
  }

  return state.tasks.map((task) => {
    const nextDate = assignments.get(task.id);
    if (!nextDate) return task;
    const subject = subjects.get(task.subjectCode)!;
    return {
      ...task,
      dueDate: nextDate,
      status: task.status === "snoozed" ? "todo" : task.status,
      priority: taskPriority(task, subject, today, gaps.get(task.subjectCode) ?? 0),
    };
  });
}

export function countCompleted(tasks: StudyTask[]): number {
  return tasks.filter((task) => task.status === "done" && !task.archived).length;
}

export function progressPercent(subject: Subject, tasks: StudyTask[] = [], sessions: AppState["sessions"] = []): number {
  return getSubjectProgress(subject, tasks, sessions).coveragePercent;
}

export function isTaskOverdue(task: StudyTask, today = toISODate(new Date())): boolean {
  return task.status !== "done" && !task.archived && task.dueDate < today;
}

export function reviewInterval(confidence: Confidence): number {
  return confidence === "hard" ? 1 : confidence === "okay" ? 4 : 8;
}
