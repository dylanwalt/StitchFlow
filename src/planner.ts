import type {
  AppState,
  PlannerSummary,
  StudyTask,
  Subject,
  SubjectCode,
} from "./types";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
  }).format(parseISODate(value));
}

export function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(parseISODate(value));
}

export function taskPriority(
  task: StudyTask,
  subject: Subject,
  today = toISODate(new Date()),
): number {
  const urgency = Math.max(0, 30 - daysUntil(subject.examDates[0], today));
  const overdue = task.dueDate < today ? 28 : 0;
  const dueSoon = Math.max(0, 14 - daysUntil(task.dueDate, today)) * 2;
  const kindWeight = task.kind === "practice" ? 8 : task.kind === "error-review" ? 7 : 3;
  const fixedWeight = task.fixed ? 8 : 0;
  return Math.round(urgency + overdue + dueSoon + kindWeight + fixedWeight);
}

export function getSubjectSummary(
  subject: Subject,
  today = toISODate(new Date()),
): PlannerSummary {
  const daysToExam = Math.max(0, daysUntil(subject.examDates[0], today));
  const gap = Math.max(0, subject.targetChapter - subject.currentChapter);
  const behind = gap >= 4 && daysToExam < 100;
  return {
    subjectCode: subject.code,
    behind,
    gap,
    daysToExam,
    label: behind ? `${gap} chapter gap` : "on a steady path",
  };
}

function getNextPlanningDate(candidate: string, occupied: Set<string>): string {
  let next = candidate;
  while (occupied.has(next)) next = addDays(next, 1);
  return next;
}

/**
 * Rebalances unfinished, non-fixed work without rewriting completed tasks or fixed events.
 * The algorithm deliberately prioritizes urgency and practice, while keeping the result visible and editable.
 */
export function replanTasks(
  state: AppState,
  today = toISODate(new Date()),
): StudyTask[] {
  const subjects = new Map<SubjectCode, Subject>(
    state.subjects.map((subject) => [subject.code, subject]),
  );
  const occupied = new Set(
    state.tasks
      .filter((task) => task.fixed && task.status !== "done")
      .map((task) => task.dueDate),
  );

  const movable = state.tasks
    .filter((task) => task.status !== "done" && !task.fixed)
    .map((task) => ({
      ...task,
      priority: taskPriority(task, subjects.get(task.subjectCode)!, today),
    }))
    .sort((a, b) => b.priority - a.priority || a.dueDate.localeCompare(b.dueDate));

  const assignments = new Map<string, string>();
  const dailyCount = new Map<string, number>();
  let cursor = today;

  for (const task of movable) {
    let date = getNextPlanningDate(cursor, occupied);
    while ((dailyCount.get(date) ?? 0) >= 3) {
      cursor = addDays(date, 1);
      date = getNextPlanningDate(cursor, occupied);
    }
    assignments.set(task.id, date);
    dailyCount.set(date, (dailyCount.get(date) ?? 0) + 1);
    cursor = date;
  }

  return state.tasks.map((task) => {
    const nextDate = assignments.get(task.id);
    return nextDate
      ? { ...task, dueDate: nextDate, status: "todo", priority: taskPriority(task, subjects.get(task.subjectCode)!, today) }
      : task;
  });
}

export function countCompleted(tasks: StudyTask[]): number {
  return tasks.filter((task) => task.status === "done").length;
}

export function progressPercent(subject: Subject): number {
  if (!subject.targetChapter) return 0;
  return Math.min(100, Math.round((subject.currentChapter / subject.targetChapter) * 100));
}

export function isTaskOverdue(task: StudyTask, today = toISODate(new Date())): boolean {
  return task.status !== "done" && task.dueDate < today;
}
