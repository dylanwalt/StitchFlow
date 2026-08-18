export type SubjectCode = "F102" | "F108";

export type TaskKind =
  | "learn"
  | "recall"
  | "practice"
  | "error-review"
  | "milestone";

export type TaskStatus = "todo" | "in-progress" | "done" | "snoozed";
export type TaskCompletionPercent = 50 | 80 | 100;

export type StudyPhase = "understand" | "retrieve" | "practice" | "review";
export type Confidence = "hard" | "okay" | "solid";
export type SessionKind = "focus" | "past-paper";
export type ChapterCheck = "readThrough" | "summarized" | "confident" | "reviewed";
export type ScheduleStatus = "ahead" | "on-track" | "behind";
export type PlanningRole = "lecture-prep" | "assessment-prep";
export type PaperMode = "question-drill" | "timed-sit-down";

export interface TaskImpact {
  coverage: number;
  retrieval: number;
  practice: number;
  description: string;
}

export type CalendarEventKind =
  | "lecture"
  | "test"
  | "assignment"
  | "exam"
  | "checklist"
  | "practice";

export interface Subject {
  code: SubjectCode;
  name: string;
  shortName: string;
  color: "blue" | "pink";
  examDates: string[];
  examDurationMinutes: number;
  currentChapter: number;
  targetChapter: number;
  syllabusChapterTotal: number;
  chapterLabel: string;
  supplementalSections: string[];
  description: string;
  progressNote: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  dateConfirmed?: boolean;
  subjectCode?: SubjectCode;
  kind: CalendarEventKind;
  title: string;
  detail?: string;
  chapterRange?: string;
  durationMinutes?: number;
  fixed?: boolean;
}

export interface StudyTask {
  id: string;
  subjectCode: SubjectCode;
  kind: TaskKind;
  title: string;
  detail?: string;
  dueDate: string;
  estimatedMinutes: number;
  status: TaskStatus;
  completionPercent?: TaskCompletionPercent;
  priority: number;
  phase: StudyPhase;
  impact: TaskImpact;
  coverageUnits?: number;
  chapterRange?: string;
  paperName?: string;
  archived?: boolean;
  manuallyScheduled?: boolean;
  sourceEventId?: string;
  planningRole?: PlanningRole;
  fixed?: boolean;
  createdAt: string;
  lastCompletedAt?: string;
  revisitDate?: string;
  confidence?: Confidence;
  paperMode?: PaperMode;
}

export interface StudySession {
  id: string;
  date: string;
  subjectCode: SubjectCode;
  durationMinutes: number;
  kind: SessionKind;
  taskId?: string;
  note?: string;
  paperName?: string;
  paperDate?: string;
  score?: number;
  attemptedMinutes?: number;
  errorCount?: number;
  nextAction?: string;
  confidence?: Confidence;
}

export interface ChapterCheckpoint {
  id: string;
  subjectCode: SubjectCode;
  chapterNumber: number;
  chapterLabel: string;
  keyIdeas: string;
  formulas: string;
  uncertainty: string;
  examQuestion: string;
  flashcards: Flashcard[];
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  front: string;
  back: string;
}

export interface ChapterProgress {
  id: string;
  subjectCode: SubjectCode;
  chapterNumber: number;
  readThrough: boolean;
  summarized: boolean;
  confident: boolean;
  reviewed: boolean;
  updatedAt: string;
}

export interface UserSettings {
  userName: string;
  lastReplannedAt?: string;
  theme: "light";
}

export interface AppState {
  version: number;
  subjects: Subject[];
  events: CalendarEvent[];
  tasks: StudyTask[];
  sessions: StudySession[];
  chapters: ChapterProgress[];
  checkpoints: ChapterCheckpoint[];
  settings: UserSettings;
  updatedAt: string;
}

export interface PlannerSummary {
  subjectCode: SubjectCode;
  status: ScheduleStatus;
  behind: boolean;
  gap: number;
  aheadBy: number;
  expectedUnits: number;
  weeksBehind: number;
  daysToExam: number;
  label: string;
}

export interface SubjectProgress {
  subjectCode: SubjectCode;
  coveragePercent: number;
  coverageUnits: number;
  targetUnits: number;
  retrievalPercent: number;
  practicePercent: number;
  completedBlocks: number;
  plannedBlocks: number;
  label: string;
}

export interface ChapterMetrics {
  total: number;
  readThrough: number;
  summarized: number;
  confident: number;
  reviewed: number;
  completionPercent: number;
}

export type StudySessionDraft = Omit<StudySession, "id" | "date">;
