export type SubjectCode = "A311" | "F102" | "F108";

export type TaskKind =
  | "learn"
  | "recall"
  | "practice"
  | "error-review"
  | "milestone";

export type TaskStatus = "todo" | "done" | "snoozed";

export type StudyPhase = "understand" | "retrieve" | "practice" | "review";
export type Confidence = "hard" | "okay" | "solid";
export type SessionKind = "focus" | "past-paper";

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
  color: "blue" | "pink" | "yellow";
  examDates: string[];
  examDurationMinutes: number;
  currentChapter: number;
  targetChapter: number;
  chapterLabel: string;
  description: string;
  progressNote: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
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
  priority: number;
  phase: StudyPhase;
  impact: TaskImpact;
  coverageUnits?: number;
  paperName?: string;
  archived?: boolean;
  sourceEventId?: string;
  fixed?: boolean;
  createdAt: string;
  lastCompletedAt?: string;
  revisitDate?: string;
  confidence?: Confidence;
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
  chapterLabel: string;
  keyIdeas: string;
  formulas: string;
  uncertainty: string;
  examQuestion: string;
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
  checkpoints: ChapterCheckpoint[];
  settings: UserSettings;
  updatedAt: string;
}

export interface PlannerSummary {
  subjectCode: SubjectCode;
  behind: boolean;
  gap: number;
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

export type StudySessionDraft = Omit<StudySession, "id" | "date">;
