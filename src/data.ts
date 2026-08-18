import type {
  AppState,
  CalendarEvent,
  ChapterCheckpoint,
  ChapterProgress,
  StudyTask,
  Subject,
  SubjectCode,
} from "./types";
import { createCalendarAlignedTasks, defaultImpact, lecturePrepDate, phaseForKind, taskPriority } from "./planner";

const CREATED_AT = "2026-08-11T08:00:00+02:00";

export const subjects: Subject[] = [
  {
    code: "F102",
    name: "Life Insurance Principles",
    shortName: "Life insurance",
    color: "blue",
    examDates: ["2026-11-05"],
    examDurationMinutes: 180,
    currentChapter: 4,
    targetChapter: 36,
    syllabusChapterTotal: 36,
    chapterLabel: "Chapter progress",
    supplementalSections: ["Glossary"],
    description: "Build understanding first, then convert it into timed answers.",
    progressNote: "Annotations are complete through chapter 4.",
  },
  {
    code: "F108",
    name: "Health, Social & Employee Benefits",
    shortName: "Benefits",
    color: "pink",
    examDates: ["2026-11-16"],
    examDurationMinutes: 180,
    currentChapter: 8,
    targetChapter: 23,
    syllabusChapterTotal: 23,
    chapterLabel: "Chapter progress",
    supplementalSections: ["Glossary", "Acronyms"],
    description: "Keep the core reading moving while protecting time for practice.",
    progressNote: "Annotations are complete through chapter 8.",
  },
];

function makeEvent(
  id: string,
  date: string,
  kind: CalendarEvent["kind"],
  title: string,
  subjectCode?: SubjectCode,
  detail?: string,
  chapterRange?: string,
  durationMinutes?: number,
  fixed = false,
  dateConfirmed = true,
): CalendarEvent {
  return { id, date, dateConfirmed, kind, title, subjectCode, detail, chapterRange, durationMinutes, fixed };
}

const lectureEvents: CalendarEvent[] = [
  makeEvent("f102-jul-13", "2026-07-13", "lecture", "Regular time", "F102", "Life assurance products", "Chapters 1-3"),
  makeEvent("f102-jul-20", "2026-07-20", "lecture", "Regular time", "F102", "Health and care products", "Chapters 5-7"),
  makeEvent("f102-jul-27", "2026-07-27", "lecture", "Regular time", "F102", "With-profits products and methods of distributing profits", "Chapters 8-10"),
  makeEvent("f102-aug-03", "2026-08-03", "lecture", "Regular time", "F102", "Management of unit-linked contracts", "Chapters 4, 16, 17"),
  makeEvent("f102-aug-17", "2026-08-17", "lecture", "Regular time", "F102", "Risks and product design", "Chapters 13-15, 20"),
  makeEvent("f102-aug-20", "2026-08-20", "lecture", "09:00-12:00", "F102", "Catch-up lecture", "Chapters 11-12", 180),
  makeEvent("f102-aug-24", "2026-08-24", "lecture", "Regular time", "F102", "Setting assumptions and embedded value", "Chapter 19 section 2, 21, 22"),
  makeEvent("f102-aug-31", "2026-08-31", "lecture", "Regular time", "F102", "Reserves, capital requirements and investments", "Chapters 23, 24, 33"),
  makeEvent("f102-sep-14", "2026-09-14", "lecture", "Regular time", "F102", "Data and models", "Chapters 18, 19, 32"),
  makeEvent("f102-sep-28", "2026-09-28", "lecture", "Regular time", "F102", "Risk management, reinsurance and underwriting", "Chapters 29, 30, 31"),
  makeEvent("f102-oct-05", "2026-10-05", "lecture", "Regular time", "F102", "Pricing for health and care", "Chapter 28"),
  makeEvent("f102-oct-16", "2026-10-16", "lecture", "14:00-17:00", "F102", "Surrenders, alterations, guarantees and options", "Chapters 25-27"),
  makeEvent("f102-oct-19", "2026-10-19", "lecture", "Regular time", "F102", "Monitoring experience and the big picture", "Chapters 33, 34-36"),
  makeEvent("f108-jul-16", "2026-07-16", "lecture", "09:00-12:00", "F108", "Social security system and the role of the state", "Chapters 2-3", 180),
  makeEvent("f108-jul-23", "2026-07-23", "lecture", "09:00-12:00", "F108", "The role of the employer and the regulatory, tax and professional environment", "Chapters 4-5", 180),
  makeEvent("f108-jul-30", "2026-07-30", "lecture", "09:00-12:00", "F108", "The environment and social and employee benefits", "Chapters 6-7", 180),
  makeEvent("f108-aug-06", "2026-08-06", "lecture", "09:00-12:00", "F108", "Health and care products and benefit design", "Chapters 8-9", 180),
  makeEvent("f108-aug-13", "2026-08-13", "lecture", "09:00-12:00", "F108", "Morbidity risks, data, assumption setting and modelling", "Chapters 12-14", 180),
  makeEvent("f108-aug-14", "2026-08-14", "lecture", "09:00-12:00", "F108", "Risks and mortality risks", "Chapters 10-11", 180),
  makeEvent("f108-aug-27", "2026-08-27", "lecture", "09:00-12:00", "F108", "Investments", "Chapters 16-17", 180),
  makeEvent("f108-sep-03", "2026-09-03", "lecture", "09:00-12:00", "F108", "Financing and funding; purposes, principles and users of valuations", "Chapters 18, 20", 180),
  makeEvent("f108-sep-17", "2026-09-17", "lecture", "09:00-12:00", "F108", "Pricing", "Chapter 15", 180),
  makeEvent("f108-oct-01", "2026-10-01", "lecture", "09:00-12:00", "F108", "Reserving in health and care", "Chapters 20, 22", 180),
  makeEvent("f108-oct-08", "2026-10-08", "lecture", "09:00-12:00", "F108", "Actuarial funding methods and reserving for retirement funds (1)", "Chapter 21", 180),
  makeEvent("f108-oct-15", "2026-10-15", "lecture", "09:00-12:00", "F108", "Actuarial funding methods and reserving for retirement funds (2)", "Chapter 21", 180),
  makeEvent("f108-oct-22", "2026-10-22", "lecture", "09:00-12:00", "F108", "Risk management and monitoring experience", "Chapters 19, 23", 180),
];

const fixedEvents: CalendarEvent[] = [
  makeEvent("f102-test-1", "2026-09-07", "test", "Class test 1", "F102", "Class test · chapters 1-17, chapter 19 section 2, chapters 20-24, and chapter 33", "Chapters 1-17 · Chapter 19 section 2 · Chapters 20-24 · Chapter 33", 180, true),
  makeEvent("f108-test-1", "2026-09-10", "test", "Class test 1", "F108", "Class test · chapters 1-14, chapters 16-18, and chapter 20", "Chapters 1-14 · Chapters 16-18 · Chapter 20", 180, true),
  makeEvent("f102-test-2", "2026-09-30", "test", "Test 2", "F102", "September assessment · date to be confirmed", undefined, 180, true, false),
  makeEvent("f108-test-2", "2026-09-30", "test", "Test 2", "F108", "September assessment · date to be confirmed", undefined, 180, true, false),
  makeEvent("f102-exam", "2026-11-05", "exam", "F102 exam", "F102", "Three-hour typed exam", undefined, 180, true),
  makeEvent("f108-exam", "2026-11-16", "exam", "F108 exam", "F108", "Three-hour typed exam", undefined, 180, true),
  makeEvent("f108-assignment-1", "2026-07-23", "assignment", "Take-home assignment 1", "F108", "Completed", "Chapters 4-5", undefined, true),
  makeEvent("f102-assignment-1", "2026-08-03", "assignment", "Assignment 1", "F102", "Completed", "Chapters 4, 16, 17", undefined, true),
  makeEvent("f108-assignment-2", "2026-10-01", "assignment", "Take-home assignment 2", "F108", "Due alongside the lecture block", "Chapters 20, 22", undefined, true),
  makeEvent("f102-assignment-2", "2026-10-05", "assignment", "Assignment 2", "F102", "Due before lecture", "Chapter 28", undefined, true),
];

function makeTask(
  id: string,
  subjectCode: SubjectCode,
  kind: StudyTask["kind"],
  title: string,
  dueDate: string,
  estimatedMinutes: number,
  detail: string,
  fixed = false,
  sourceEventId?: string,
  coverageUnits = 0,
  paperName?: string,
  archived = false,
): StudyTask {
  return {
    id,
    subjectCode,
    kind,
    title,
    detail,
    dueDate,
    estimatedMinutes,
    status: "todo",
    priority: 1,
    phase: phaseForKind(kind),
    impact: defaultImpact(kind),
    coverageUnits,
    paperName,
    archived,
    fixed,
    sourceEventId,
    createdAt: CREATED_AT,
  };
}

const lecturePrepEvents: CalendarEvent[] = lectureEvents.map((event) =>
  makeEvent(
    `prep-${event.id}`,
    lecturePrepDate(event.date),
    "checklist",
    `Pre-reading · ${event.subjectCode}`,
    event.subjectCode,
    `Complete two days before this lecture: ${event.detail ?? "skim the assigned reading and write three questions"}.`,
    event.chapterRange,
  ),
);

const immediateTasks: StudyTask[] = [
  makeTask("today-f102-catchup", "F102", "learn", "F102 catch-up: chapters 5-7", "2026-08-11", 75, "First pass only: map the idea, answer the within-chapter question, and leave one short checkpoint. Do not rewrite the chapter.", false, undefined, 3),
  makeTask("today-f108-catchup", "F108", "learn", "F108 catch-up: chapters 10-11", "2026-08-11", 75, "First pass only: understand the map, mark one uncertainty, and move on before annotations become a second textbook.", false, undefined, 2),
  makeTask("tomorrow-f102-recall", "F102", "recall", "F102: retrieve chapters 1-4 from memory", "2026-08-12", 30, "Close the notes first. Write the structure and key formulas, then check only what you missed."),
  makeTask("tomorrow-f108-checkpoint", "F108", "recall", "F108: write a five-minute chapter checkpoint", "2026-08-12", 25, "Capture key ideas, formulas or terms, one uncertainty, and one exam-style question."),
].map((task) => task.id === "today-f102-catchup"
  ? { ...task, chapterRange: "Chapters 5-7" }
  : task.id === "today-f108-catchup"
    ? { ...task, chapterRange: "Chapters 10-11" }
    : task);

const pastPaperTasks: StudyTask[] = [
  makeTask("f102-paper-drill-1", "F102", "practice", "F102 older ASSA papers: question drill 1", "2026-08-24", 60, "Choose a question from any older paper in the official archive after the relevant chapter. Practise the answer shape, then log the error that should return later.", false, undefined, 0, "F102 older ASSA papers", false),
  makeTask("f102-paper-drill-2", "F102", "practice", "F102 older ASSA papers: question drill 2", "2026-09-14", 60, "Use another older official paper as a chapter-linked question set. This is retrieval practice, not a full mock.", false, undefined, 0, "F102 older ASSA papers", false),
  makeTask("f102-paper-drill-3", "F102", "practice", "F102 older ASSA papers: question drill 3", "2026-10-05", 60, "Work through another older-paper section and turn the top three misses into short recall prompts.", false, undefined, 0, "F102 older ASSA papers", false),
  makeTask("f102-paper-1", "F102", "practice", "F102 recent ASSA paper: full 3-hour sit-down 1", "2026-10-19", 180, "Use one of the newest available official papers under exam conditions. Mark it afterwards and schedule the biggest errors for review.", false, undefined, 0, "F102 recent ASSA papers", false),
  makeTask("f102-paper-2", "F102", "practice", "F102 recent ASSA paper: full 3-hour sit-down 2", "2026-10-27", 180, "Complete another recent paper as a complete three-hour sitting. Protect the final hour for marking and error capture later.", false, undefined, 0, "F102 recent ASSA papers", false),
  makeTask("f102-paper-3", "F102", "practice", "F102 recent ASSA paper: final full 3-hour sit-down", "2026-11-02", 180, "Make this the last full mock before the 5 November exam. Review errors without starting a new topic marathon.", false, undefined, 0, "F102 recent ASSA papers", false),
  makeTask("f108-paper-drill-1", "F108", "practice", "F108 older ASSA papers: question drill 1", "2026-08-27", 60, "Choose a question from an older F108, F101, or F104 archive paper after the relevant chapter. Practise the answer shape and record one gap.", false, undefined, 0, "F108 older ASSA papers", false),
  makeTask("f108-paper-drill-2", "F108", "practice", "F108 older ASSA papers: question drill 2", "2026-09-17", 60, "Use another older official paper as a chapter-linked drill. Keep it short enough to support lecture and test readiness.", false, undefined, 0, "F108 older ASSA papers", false),
  makeTask("f108-paper-drill-3", "F108", "practice", "F108 older ASSA papers: question drill 3", "2026-10-01", 60, "Work through another older-paper section and turn the top three misses into retrieval prompts.", false, undefined, 0, "F108 older ASSA papers", false),
  makeTask("f108-paper-1", "F108", "practice", "F108 recent ASSA paper: full 3-hour sit-down 1", "2026-10-26", 180, "Use one of the newest available F108 papers under exam conditions. Mark it afterwards and carry the biggest errors into review.", false, undefined, 0, "F108 recent ASSA papers", false),
  makeTask("f108-paper-2", "F108", "practice", "F108 recent ASSA paper: full 3-hour sit-down 2", "2026-11-04", 180, "Complete another recent paper as a complete three-hour sitting, then review the topics that cost time.", false, undefined, 0, "F108 recent ASSA papers", false),
  makeTask("f108-paper-3", "F108", "practice", "F108 recent ASSA paper: final full 3-hour sit-down", "2026-11-10", 180, "Make this the last full mock before the 16 November exam. Finish by planning light recall and rest.", false, undefined, 0, "F108 recent ASSA papers", false),
].map((task) => ({
  ...task,
  paperMode: task.paperName?.includes("older") ? "question-drill" : "timed-sit-down",
}));

export const seedState: AppState = {
  version: 5,
  subjects,
  events: [...lectureEvents, ...fixedEvents, ...lecturePrepEvents],
  tasks: [...immediateTasks, ...createCalendarAlignedTasks([...lectureEvents, ...fixedEvents], subjects, CREATED_AT), ...pastPaperTasks].map((task) => ({
    ...task,
    priority: taskPriority(task, subjects.find((subject) => subject.code === task.subjectCode)!, "2026-08-11"),
  })),
  sessions: [],
  chapters: [
    ...createChapterProgress("F102", 36, CREATED_AT).map((chapter) => chapter.chapterNumber <= 4 ? { ...chapter, readThrough: true } : chapter),
    ...createChapterProgress("F108", 23, CREATED_AT).map((chapter) => chapter.chapterNumber <= 8 ? { ...chapter, readThrough: true } : chapter),
  ],
  checkpoints: [],
  settings: {
    userName: "study buddy",
    theme: "light",
  },
  updatedAt: CREATED_AT,
};

export function createChapterProgress(subjectCode: SubjectCode, total: number, updatedAt = new Date().toISOString()): ChapterProgress[] {
  return Array.from({ length: Math.max(0, total) }, (_, index) => ({
    id: `${subjectCode}-chapter-${index + 1}`,
    subjectCode,
    chapterNumber: index + 1,
    readThrough: false,
    summarized: false,
    confident: false,
    reviewed: false,
    updatedAt,
  }));
}

export const emptyCheckpoint = (subjectCode: SubjectCode, chapterLabel: string, chapterNumber = 1): ChapterCheckpoint => ({
  id: `${subjectCode}-chapter-${chapterNumber}`,
  subjectCode,
  chapterNumber,
  chapterLabel,
  keyIdeas: "",
  formulas: "",
  uncertainty: "",
  examQuestion: "",
  flashcards: [],
  updatedAt: new Date().toISOString(),
});
