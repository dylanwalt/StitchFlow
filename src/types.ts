export type SubjectCode = "A311" | "F102" | "F108";

export type TaskKind =
  | "learn"
  | "recall"
  | "practice"
  | "error-review"
  | "milestone";

export type TaskStatus = "todo" | "done" | "snoozed";

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
  sourceEventId?: string;
  fixed?: boolean;
  createdAt: string;
}

export interface StudySession {
  id: string;
  date: string;
  subjectCode: SubjectCode;
  durationMinutes: number;
  taskId?: string;
  note?: string;
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
