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
  PlanningRole,
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

/**
 * Places pre-reading two days before class. If that lands on a weekend,
 * the preceding Friday keeps the weekend available as an optional buffer.
 */
export function lecturePrepDate(lectureDate: string): string {
  const candidate = addDays(lectureDate, -2);
  const weekday = parseISODate(candidate).getDay();
  return weekday === 6 ? addDays(candidate, -1) : weekday === 0 ? addDays(candidate, -2) : candidate;
}

function createCalendarTask(
  id: string,
  subject: Subject,
  kind: TaskKind,
  title: string,
  dueDate: string,
  estimatedMinutes: number,
  detail: string,
  sourceEventId: string,
  planningRole: PlanningRole,
  archived: boolean,
): StudyTask {
  const task: StudyTask = {
    id,
    subjectCode: subject.code,
    kind,
    title,
    detail,
    dueDate,
    estimatedMinutes,
    status: "todo",
    priority: 1,
    phase: phaseForKind(kind),
    impact: defaultImpact(kind),
    coverageUnits: kind === "learn" ? 1 : 0,
    archived,
    sourceEventId,
    planningRole,
    fixed: false,
    createdAt: "",
  };
  return { ...task, priority: taskPriority(task, subject, toISODate(new Date())) };
}

/**
 * Turns dated lecture and test events into the preparation runway that the
 * daily plan can surface. Undated/TBC assessments stay visible on the
 * calendar but do not create fake date-specific tasks.
 */
export function createCalendarAlignedTasks(
  events: AppState["events"],
  subjects: Subject[],
  createdAt = new Date().toISOString(),
): StudyTask[] {
  const subjectsByCode = new Map(subjects.map((subject) => [subject.code, subject]));
  const referenceDate = createdAt.slice(0, 10);
  const tasks: StudyTask[] = [];

  for (const event of events) {
    if (!event.subjectCode || event.dateConfirmed === false) continue;
    const subject = subjectsByCode.get(event.subjectCode);
    if (!subject) continue;

    if (event.kind === "lecture" && event.chapterRange) {
      const prepDate = lecturePrepDate(event.date);
      tasks.push({
        ...createCalendarTask(
          `calendar-lecture-prep-${event.id}`,
          subject,
          "learn",
          `${subject.code}: pre-read ${event.chapterRange.toLowerCase()} before lecture`,
          prepDate,
          60,
          `Do this two days before the ${formatShortDate(event.date)} lecture (or use the preceding Friday when the two-day point falls on a weekend). Skim for structure, note three questions, and leave the lecture for sense-making rather than first exposure.`,
          event.id,
          "lecture-prep",
          prepDate < referenceDate,
        ),
        createdAt,
      });
    }

    if (event.kind === "test") {
      const testLabel = event.title.replace(/^test\s*/i, "Test ").trim();
      const scope = event.chapterRange ? ` Scope: ${event.chapterRange}.` : "";
      const stages: Array<{ suffix: string; offset: number; kind: TaskKind; minutes: number; title: string; detail: string }> = [
        {
          suffix: "scope",
          offset: -14,
          kind: "learn",
          minutes: 45,
          title: `${subject.code}: map the ${testLabel} scope`,
          detail: `Use the lectures and chapters on the calendar to make a one-page scope map.${scope} Mark what is understood, what needs retrieval, and which question types to practise.`,
        },
        {
          suffix: "practice",
          offset: -7,
          kind: "practice",
          minutes: 60,
          title: `${subject.code}: timed practice for ${testLabel}`,
          detail: `Do one timed question set for ${testLabel}.${scope} Mark it, and turn the top two errors into retrieval questions.`,
        },
        {
          suffix: "recall",
          offset: -2,
          kind: "recall",
          minutes: 45,
          title: `${subject.code}: final recall for ${testLabel}`,
          detail: `Close the notes and retrieve definitions, formulas, and common traps for ${testLabel}.${scope} Keep the final day light enough to protect recall and sleep.`,
        },
      ];
      for (const stage of stages) {
        tasks.push({
          ...createCalendarTask(
            `calendar-test-prep-${event.id}-${stage.suffix}`,
            subject,
            stage.kind,
            stage.title,
            addDays(event.date, stage.offset),
            stage.minutes,
            stage.detail,
            event.id,
            "assessment-prep",
            addDays(event.date, stage.offset) < referenceDate,
          ),
          createdAt,
        });
      }
    }
  }

  return tasks;
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
  const lectureReadinessWeight = task.planningRole === "lecture-prep" ? (task.dueDate < today ? 45 : 100) : 0;
  const assessmentWeight = task.planningRole === "assessment-prep" ? 35 : 0;
  const catchUpWeight = task.kind === "learn" && (task.coverageUnits ?? 0) > 0 ? 18 : 0;
  const paperWeight = task.paperName ? 4 : 0;
  return Math.round(urgency + overdue + dueSoon + gapPressure + kindWeight + fixedWeight + lectureReadinessWeight + assessmentWeight + catchUpWeight + paperWeight);
}

function completedCoverageUnits(subject: Subject, tasks: StudyTask[]): number {
  return subject.currentChapter + tasks
    .filter((task) => task.subjectCode === subject.code && task.status === "done" && !task.archived)
    .reduce((total, task) => total + (task.coverageUnits ?? 0), 0);
}

function completedCount(tasks: StudyTask[], predicate: (task: StudyTask) => boolean): number {
  return tasks.filter((task) => task.status === "done" && !task.archived && predicate(task)).length;
}

export function chapterNumbersFromRange(value: string): number[] {
  const cleaned = value.replace(/sections?\s+\d+/gi, "");
  const numbers: number[] = [];
  for (const token of cleaned.match(/\d+\s*-\s*\d+|\d+/g) ?? []) {
    const range = token.split("-").map((part) => Number(part.trim()));
    if (range.length === 2) {
      const [start, end] = range;
      for (let chapter = Math.min(start, end); chapter <= Math.max(start, end); chapter += 1) numbers.push(chapter);
    } else if (range[0] > 0) {
      numbers.push(range[0]);
    }
  }
  return numbers;
}

function scheduledChapterNumbers(subjectCode: SubjectCode, today: string, events: AppState["events"]): number[] {
  return Array.from(new Set(events
    .filter((event) => event.subjectCode === subjectCode && event.kind === "lecture" && event.date <= today && event.chapterRange)
    .flatMap((event) => chapterNumbersFromRange(event.chapterRange!)))).sort((a, b) => a - b);
}

function weeksOfScheduledCoverage(subjectCode: SubjectCode, today: string, events: AppState["events"], expectedUnits: number): number {
  if (!expectedUnits) return 0;
  const dates = events
    .filter((event) => event.subjectCode === subjectCode && event.kind === "lecture" && event.date <= today && event.chapterRange)
    .map((event) => event.date)
    .sort();
  const spanWeeks = dates.length > 1 ? Math.max(1, Math.ceil((parseISODate(dates[dates.length - 1]).getTime() - parseISODate(dates[0]).getTime()) / 86_400_000 / 7) + 1) : 1;
  return Math.max(1, Math.ceil(expectedUnits / spanWeeks));
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
  events: AppState["events"] = [],
): PlannerSummary {
  const daysToExam = Math.max(0, daysUntil(subject.examDates[0], today));
  const progress = getSubjectProgress(subject, tasks, [], chapters);
  const scheduled = scheduledChapterNumbers(subject.code, today, events);
  const expectedUnits = scheduled.length > 0 ? scheduled.length : progress.targetUnits;
  const delta = progress.coverageUnits - expectedUnits;
  const gap = Math.max(0, -delta);
  const aheadBy = Math.max(0, delta);
  const status = scheduled.length > 0
    ? delta >= 2 ? "ahead" : delta <= -2 ? "behind" : "on-track"
    : gap >= 4 && daysToExam < 100 ? "behind" : "on-track";
  const behind = status === "behind";
  const weeklyCoverage = weeksOfScheduledCoverage(subject.code, today, events, scheduled.length);
  return {
    subjectCode: subject.code,
    status,
    behind,
    gap,
    aheadBy,
    expectedUnits,
    weeksBehind: behind ? Math.max(1, Math.ceil(gap / weeklyCoverage)) : 0,
    daysToExam,
    label: status === "behind" ? `${gap} chapters behind the lecture runway` : status === "ahead" ? `${aheadBy} chapters ahead of the lecture runway` : "on track with the lecture runway",
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
    ...state.events.filter((event) => event.fixed && event.dateConfirmed !== false).map((event) => event.date),
    ...state.tasks.filter((task) => task.fixed && task.status !== "done").map((task) => task.dueDate),
  ]);
  const gaps = new Map(state.subjects.map((subject) => [subject.code, getSubjectSummary(subject, today, state.tasks, state.chapters, state.events).gap]));
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
    const updatedTask = {
      ...task,
      dueDate: nextDate,
      status: task.status === "snoozed" ? "todo" : task.status,
      manuallyScheduled: true,
    };
    return { ...updatedTask, priority: taskPriority(updatedTask, subject, today, gaps.get(task.subjectCode) ?? 0) };
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
