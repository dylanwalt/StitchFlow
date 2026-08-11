import { useCallback, useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import { emptyCheckpoint, seedState } from "./data";
import {
  addDays,
  countCompleted,
  daysUntil,
  formatLongDate,
  formatShortDate,
  getSubjectProgress,
  getSubjectSummary,
  isTaskOverdue,
  replanTasks,
  reviewInterval,
  toISODate,
} from "./planner";
import { exportState, loadState, parseImportedState, saveState } from "./storage";
import type {
  AppState,
  CalendarEvent,
  ChapterCheckpoint,
  Confidence,
  StudySessionDraft,
  StudyTask,
  Subject,
  SubjectCode,
} from "./types";

type View = "dashboard" | "plan" | "calendar" | "subjects";
type IconName = "home" | "plan" | "calendar" | "book" | "spark" | "settings" | "arrow" | "check" | "play" | "pause" | "download" | "upload" | "refresh" | "clock" | "target" | "plus" | "info" | "heart" | "list";

const VIEW_LABELS: Record<View, string> = { dashboard: "Today", plan: "Study plan", calendar: "Calendar", subjects: "Subjects" };
const VIEW_ICONS: Record<View, IconName> = { dashboard: "home", plan: "plan", calendar: "calendar", subjects: "book" };

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z",
    plan: "M5 4.5h14M5 9.5h14M5 14.5h8M5 19.5h5",
    calendar: "M5 3v3M19 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",
    book: "M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5zM5 4.5v17M5 18.5h15",
    spark: "m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6zM19 16l.7 2.3L19 19l-2.3-.7L19 16z",
    settings: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-6v2M12 19.5v2M3.5 12h2M18.5 12h2M5.9 5.9l1.4 1.4M16.7 16.7l1.4 1.4M18.1 5.9l-1.4 1.4M7.3 16.7l-1.4 1.4",
    arrow: "M5 12h14M13 6l6 6-6 6",
    check: "m5 12 4 4L19 6",
    play: "m8 5 11 7-11 7z",
    pause: "M8 5v14M16 5v14",
    download: "M12 3v12M7 10l5 5 5-5M5 20h14",
    upload: "M12 15V3M7 8l5-5 5 5M5 20h14",
    refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
    clock: "M12 6v6l4 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    target: "M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z",
    plus: "M12 5v14M5 12h14",
    info: "M12 10v6M12 6h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
    heart: "M20.8 8.7c0 5.5-8.8 10.3-8.8 10.3S3.2 14.2 3.2 8.7A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}

function readView(): View {
  const value = window.location.hash.replace("#", "") as View;
  return value in VIEW_LABELS ? value : "dashboard";
}

function useHashView(): [View, (view: View) => void] {
  const [view, setViewState] = useState<View>(readView);
  useEffect(() => {
    const sync = () => setViewState(readView());
    window.addEventListener("hashchange", sync);
    if (!window.location.hash) window.location.hash = "dashboard";
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  return [view, (next) => { window.location.hash = next; setViewState(next); }];
}

function formatTimer(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

function App() {
  const [view, setView] = useHashView();
  const [state, setState] = useState<AppState>(() => loadState(seedState));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const today = toISODate(new Date());

  useEffect(() => saveState(state), [state]);
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateState = useCallback((updater: (current: AppState) => AppState) => {
    setState((current) => ({ ...updater(current), updatedAt: new Date().toISOString() }));
  }, []);

  const completeTask = useCallback((taskId: string) => {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        if (task.status === "done") return { ...task, status: "todo", revisitDate: undefined };
        const revisitDays = task.phase === "understand" ? 2 : task.phase === "retrieve" ? 4 : 7;
        return { ...task, status: "done", lastCompletedAt: today, revisitDate: addDays(today, revisitDays) };
      }),
    }));
    setToast("Nice. That block has a job, and now it is done.");
  }, [today, updateState]);

  const snoozeTask = useCallback((taskId: string) => {
    updateState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId && !task.fixed ? { ...task, dueDate: addDays(task.dueDate < today ? today : task.dueDate, 1), status: "snoozed" } : task) }));
    setToast("Moved gently to tomorrow.");
  }, [today, updateState]);

  const revisitTask = useCallback((taskId: string) => {
    updateState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, dueDate: today, status: "todo", phase: "retrieve", revisitDate: undefined } : task) }));
    setToast("Back into the plan: answer from memory first.");
  }, [today, updateState]);

  const reviewTask = useCallback((taskId: string, confidence: Confidence) => {
    updateState((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === taskId ? { ...task, confidence, revisitDate: addDays(today, reviewInterval(confidence)) } : task) }));
    setToast(confidence === "hard" ? "Good signal. It will return tomorrow." : "Review scheduled without a streak to protect.");
  }, [today, updateState]);

  const replan = useCallback(() => {
    updateState((current) => ({ ...current, tasks: replanTasks(current, today), settings: { ...current.settings, lastReplannedAt: new Date().toISOString() } }));
    setToast("Your plan was rebalanced around exams, fixed dates, and real study capacity.");
  }, [today, updateState]);

  const logSession = useCallback((draft: StudySessionDraft) => {
    const session = { ...draft, id: `${draft.subjectCode}-${Date.now()}`, date: today };
    updateState((current) => ({ ...current, sessions: [...current.sessions, session] }));
    setToast(`${draft.durationMinutes} minutes logged. That counts.`);
  }, [today, updateState]);

  const saveCheckpoint = useCallback((checkpoint: ChapterCheckpoint) => {
    updateState((current) => ({ ...current, checkpoints: [...current.checkpoints.filter((item) => item.id !== checkpoint.id), checkpoint] }));
    setToast("Short checkpoint saved.");
  }, [updateState]);

  const exportBackup = useCallback(() => {
    const blob = new Blob([exportState(state)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stitchflow-backup-${today}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Backup downloaded.");
  }, [state, today]);

  const importBackup = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseImportedState(String(reader.result), seedState);
      if (!parsed) { setToast("That backup could not be read safely."); return; }
      setState(parsed);
      setToast("Backup restored.");
    };
    reader.readAsText(file);
    event.target.value = "";
  }, []);

  const resetData = useCallback(() => {
    if (!window.confirm("Reset your local StitchFlow progress back to the starter plan?")) return;
    setState(seedState);
    setToast("Starter plan restored.");
  }, []);

  return <div className="app-shell">
    <Sidebar view={view} setView={setView} onSettings={() => setSettingsOpen(true)} />
    <main className="main-content">
      <Topbar title={VIEW_LABELS[view]} onSettings={() => setSettingsOpen(true)} />
      {view === "dashboard" && <Dashboard state={state} today={today} setView={setView} completeTask={completeTask} snoozeTask={snoozeTask} replan={replan} revisitTask={revisitTask} reviewTask={reviewTask} />}
      {view === "plan" && <StudyPlan state={state} today={today} completeTask={completeTask} snoozeTask={snoozeTask} replan={replan} logSession={logSession} />}
      {view === "calendar" && <CalendarView events={state.events} today={today} />}
      {view === "subjects" && <SubjectsView state={state} today={today} saveCheckpoint={saveCheckpoint} logSession={logSession} />}
    </main>
    {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} exportBackup={exportBackup} importBackup={importBackup} resetData={resetData} />}
    {toast && <div className="toast" role="status"><span className="toast-dot" />{toast}</div>}
  </div>;
}

function Sidebar({ view, setView, onSettings }: { view: View; setView: (view: View) => void; onSettings: () => void }) {
  return <aside className="sidebar">
    <div className="brand-lockup"><div className="brand-mark"><span>✦</span></div><div><strong>StitchFlow</strong><span>study gently, go far</span></div></div>
    <div className="sidebar-label">Your space</div>
    <nav className="main-nav" aria-label="Main navigation">{(Object.keys(VIEW_LABELS) as View[]).map((item) => <button key={item} className={`nav-item ${view === item ? "active" : ""}`} onClick={() => setView(item)}><Icon name={VIEW_ICONS[item]} size={18} /><span>{VIEW_LABELS[item]}</span>{item === "dashboard" && <span className="nav-pulse" />}</button>)}</nav>
    <div className="sidebar-bottom"><div className="sidebar-note"><Icon name="heart" size={16} /><span>Small steps are still steps.</span></div><button className="settings-link" onClick={onSettings}><Icon name="settings" size={17} /> Settings & backup</button><div className="sidebar-footer">local-first · no account needed</div></div>
  </aside>;
}

function Topbar({ title, onSettings }: { title: string; onSettings: () => void }) {
  return <header className="topbar"><div className="mobile-brand"><div className="brand-mark small"><span>✦</span></div><strong>StitchFlow</strong></div><div className="breadcrumbs"><span>StitchFlow</span><b>/</b><strong>{title}</strong></div><button className="icon-button top-settings" aria-label="Open settings" onClick={onSettings}><Icon name="settings" size={18} /></button></header>;
}

function Dashboard({ state, today, setView, completeTask, snoozeTask, replan, revisitTask, reviewTask }: { state: AppState; today: string; setView: (view: View) => void; completeTask: (id: string) => void; snoozeTask: (id: string) => void; replan: () => void; revisitTask: (id: string) => void; reviewTask: (id: string, confidence: Confidence) => void }) {
  const pending = state.tasks.filter((task) => task.status !== "done" && !task.archived);
  const topTasks = [...pending].sort((a, b) => (a.dueDate === today ? -1 : 1) - (b.dueDate === today ? -1 : 1) || b.priority - a.priority || a.dueDate.localeCompare(b.dueDate)).slice(0, 3);
  const reviewDue = state.tasks.filter((task) => task.status === "done" && task.revisitDate && task.revisitDate <= today && !task.archived).slice(0, 2);
  const weekStart = addDays(today, -6);
  const weekSessions = state.sessions.filter((session) => session.date >= weekStart && session.date <= today);
  const weekMinutes = weekSessions.reduce((total, session) => total + session.durationMinutes, 0);
  const behind = state.subjects.map((subject) => getSubjectSummary(subject, today, state.tasks)).filter((summary) => summary.behind);

  return <div className="page dashboard-page">
    <section className="welcome-row"><div><p className="eyebrow">{formatLongDate(today)}</p><h1>Let&apos;s find your <em>flow</em>.</h1><p className="lede">A calm cockpit for the next useful block, not the whole mountain.</p></div><button className="button secondary-button" onClick={() => setView("plan")}><Icon name="play" size={15} /> Start a focus block</button></section>
    <section className="dashboard-grid"><div className="dashboard-main">
      <CompanionCard behind={behind.length > 0} reviewDue={reviewDue.length > 0} />
      <StudyLoop />
      <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Right now</p><h2>Today&apos;s gentle shortlist</h2></div><button className="text-button" onClick={() => setView("plan")}>Open full plan <Icon name="arrow" size={15} /></button></div><p className="section-explainer">Each block has a job. Finish one and you add a visible piece to the subject&apos;s study path.</p><div className="task-stack">{topTasks.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={completeTask} onSnooze={snoozeTask} expanded />)}{topTasks.length === 0 && <EmptyState title="You&apos;re all clear for today." detail="Use the calendar to choose the next small step." />}</div></section>
      {reviewDue.length > 0 && <ReviewQueue tasks={reviewDue} onRevisit={revisitTask} onReview={reviewTask} />}
    </div><aside className="dashboard-side"><ExamCountdowns subjects={state.subjects} today={today} /><WeeklyPulses state={state} today={today} /><section className="mini-card momentum-card"><div className="card-kicker"><span>THIS WEEK</span><Icon name="spark" size={15} /></div><div className="momentum-number">{weekMinutes}<small> min</small></div><p className="muted">{countCompleted(state.tasks)} blocks completed overall · {weekSessions.length} focus sessions this week</p><div className="week-bars" aria-label="Study sessions in the last seven days">{Array.from({ length: 7 }, (_, index) => { const date = addDays(today, index - 6); const minutes = state.sessions.filter((session) => session.date === date).reduce((sum, session) => sum + session.durationMinutes, 0); return <div key={date} className="bar-day"><div className="bar-track"><span style={{ height: `${Math.min(100, Math.max(8, minutes / 2))}%` }} /></div><small>{new Intl.DateTimeFormat("en-ZA", { weekday: "narrow" }).format(new Date(`${date}T12:00:00`))}</small></div>; })}</div></section><section className="mini-card nudge-card"><div className="nudge-icon"><Icon name="heart" size={17} /></div><div><strong>Choose your energy</strong><p>Low energy: do the first block only. More space: add a recall or practice block. There is no daily quota.</p></div></section>{behind.length > 0 && <section className="behind-card"><div className="behind-icon">↗</div><div><strong>Some ground to cover</strong><p>{behind.map((item) => `${item.subjectCode}: ${item.gap} chapters`).join(" · ")}</p><button className="text-button" onClick={replan}>Rebalance my plan <Icon name="arrow" size={14} /></button></div></section>}</aside></section>
    <section className="section-block subject-overview"><div className="section-heading"><div><p className="eyebrow">The bigger picture</p><h2>Three exams, one clear path</h2></div><button className="text-button" onClick={() => setView("subjects")}>View subjects <Icon name="arrow" size={15} /></button></div><div className="subject-grid">{state.subjects.map((subject) => <SubjectProgress key={subject.code} subject={subject} state={state} today={today} />)}</div></section>
  </div>;
}

function CompanionCard({ behind, reviewDue }: { behind: boolean; reviewDue: boolean }) {
  const mood = behind ? "focus" : reviewDue ? "reset" : "hello";
  return <section className="companion-card"><div className="companion-copy"><div className="card-kicker"><span>YOUR POCKET COMPANION</span><span className="status-chip"><i /> here with you</span></div><h2>{behind ? "We can make space for the catch-up." : reviewDue ? "A small revisit will make today's work stick." : "You do not have to do it all at once."}</h2><p>{behind ? "We'll protect the important dates, move the rest into a kinder order, and keep the first block small." : "One focused block, one honest checkpoint, and a little retrieval is enough to move forward."}</p><div className="companion-actions"><span className="tiny-quote">✦ progress over perfection</span></div></div><Mascot mood={mood} /></section>;
}

function Mascot({ mood = "hello", mini = false }: { mood?: "hello" | "focus" | "reset" | "celebrate"; mini?: boolean }) {
  return <div className={`mascot-wrap ${mini ? "mini" : ""}`} aria-label="A friendly original blue study companion"><div className="mascot-glow" /><svg className="mascot" viewBox="0 0 180 160" role="img"><path className="mascot-ear" d="M35 59C5 54 9 22 31 17c7 13 17 25 28 33" /><path className="mascot-ear right" d="M145 59c30-5 26-37 4-42-7 13-17 25-28 33" /><path className="mascot-body" d="M42 62c0-29 21-44 48-44s48 15 48 44v46c0 27-21 39-48 39s-48-12-48-39z" /><ellipse className="mascot-belly" cx="90" cy="110" rx="25" ry="22" /><circle className="mascot-eye" cx="70" cy="72" r="8" /><circle className="mascot-eye" cx="110" cy="72" r="8" /><circle className="mascot-eye-shine" cx="72" cy="69" r="2" /><circle className="mascot-eye-shine" cx="112" cy="69" r="2" /><path className="mascot-nose" d="M85 84q5-5 10 0" /><path className="mascot-smile" d={mood === "focus" ? "M76 95q14 3 28 0" : "M76 93q14 12 28 0"} /><path className="mascot-arm" d={mood === "celebrate" ? "M42 101c-19-16-22-26-14-32" : "M42 101c-15 7-21 15-13 25"} /><path className="mascot-arm right" d={mood === "celebrate" ? "M138 101c19-16 22-26 14-32" : "M138 101c15 7 21 15 13 25"} /><path className="mascot-foot" d="M62 143q-8 9-17 5M118 143q8 9 17 5" /></svg><div className="mascot-star">{mood === "celebrate" ? "✦ ✦" : "✦"}</div></div>;
}

function StudyLoop() {
  const steps = [{ label: "Understand", text: "Map the idea" }, { label: "Retrieve", text: "Close the notes" }, { label: "Practise", text: "Answer exam-style" }, { label: "Review errors", text: "Keep only the lesson" }, { label: "Revisit", text: "Return later" }];
  return <section className="study-loop"><div className="study-loop-head"><div><p className="eyebrow">The study loop</p><strong>Every block moves one skill forward</strong></div><Icon name="list" size={20} /></div><div className="loop-steps">{steps.map((step, index) => <div className="loop-step" key={step.label}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.text}</small></div></div>)}</div></section>;
}

function ExamCountdowns({ subjects, today }: { subjects: Subject[]; today: string }) {
  return <section className="countdown-stack"><div className="card-kicker"><span>EXAM COUNTDOWNS</span><Icon name="target" size={15} /></div>{subjects.map((subject) => { const days = daysUntil(subject.examDates[0], today); return <div className={`countdown-row ${subject.color}`} key={subject.code}><div className="subject-dot" /><div className="countdown-info"><strong>{subject.code}</strong><span>{subject.code === "A311" ? "Papers 1-2 · 1-2 Oct" : formatShortDate(subject.examDates[0])}</span></div><div className="countdown-number">{days}<small>d</small></div></div>; })}</section>;
}

function WeeklyPulses({ state, today }: { state: AppState; today: string }) {
  return <section className="weekly-pulses"><div className="card-kicker"><span>STUDY PATH</span><Icon name="target" size={15} /></div><p className="pulse-note">Planning coverage, not predicting marks.</p><div className="pulse-grid">{state.subjects.map((subject) => { const progress = getSubjectProgress(subject, state.tasks, state.sessions); const weekEnd = addDays(today, 6); const weekTasks = state.tasks.filter((task) => task.subjectCode === subject.code && !task.archived && task.dueDate >= today && task.dueDate <= weekEnd); const ratio = subject.code === "A311" ? progress.practicePercent : progress.coveragePercent; return <div className={`pulse-card ${subject.color}`} key={subject.code}><div className="pulse-dial" style={{ "--dial": `${ratio}%` } as CSSProperties}><strong>{subject.code === "A311" ? "R" : `${ratio}%`}</strong></div><div><b>{subject.code}</b><span>{weekTasks.length} planned block{weekTasks.length === 1 ? "" : "s"}</span><small>{progress.label}</small></div></div>; })}</div></section>;
}

function SubjectProgress({ subject, state, today }: { subject: Subject; state: AppState; today: string }) {
  const progress = getSubjectProgress(subject, state.tasks, state.sessions);
  const summary = getSubjectSummary(subject, today, state.tasks);
  return <div className={`subject-progress-card ${subject.color}`}><div className="subject-card-head"><div><strong>{subject.code}</strong><span>{subject.shortName}</span></div><span className="percent">{subject.code === "A311" ? "REVISION" : `${progress.coveragePercent}% path`}</span></div><div className="progress-line"><span style={{ width: `${progress.coveragePercent}%` }} /></div><p>{subject.code === "A311" ? progress.label : progress.label}</p><span className={`small-status ${summary.behind ? "behind" : ""}`}>{summary.behind ? `Needs a ${summary.gap}-chapter catch-up` : subject.progressNote}</span></div>;
}

function ReviewQueue({ tasks, onRevisit, onReview }: { tasks: StudyTask[]; onRevisit: (id: string) => void; onReview: (id: string, confidence: Confidence) => void }) {
  return <section className="review-queue"><div className="section-heading compact"><div><p className="eyebrow">Spaced review</p><h2>Ready to revisit</h2></div><span className="soft-tag">no streaks</span></div><p className="muted">A short return helps the idea stay available. Choose how it felt and StitchFlow will schedule the next gentle revisit.</p>{tasks.map((task) => <div className="review-row" key={task.id}><div><strong>{task.subjectCode} · {task.title}</strong><span>Due {formatShortDate(task.revisitDate!)}</span></div><div className="review-actions"><button className="button mini-button" onClick={() => onRevisit(task.id)}>Revisit</button><button className="confidence-button hard" onClick={() => onReview(task.id, "hard")}>Hard</button><button className="confidence-button" onClick={() => onReview(task.id, "okay")}>Okay</button><button className="confidence-button solid" onClick={() => onReview(task.id, "solid")}>Solid</button></div></div>)}</section>;
}

function StudyPlan({ state, today, completeTask, snoozeTask, replan, logSession }: { state: AppState; today: string; completeTask: (id: string) => void; snoozeTask: (id: string) => void; replan: () => void; logSession: (draft: StudySessionDraft) => void }) {
  const [filter, setFilter] = useState<SubjectCode | "all">("all");
  const pending = state.tasks.filter((task) => task.status !== "done" && !task.archived && (filter === "all" || task.subjectCode === filter)).sort((a, b) => (a.dueDate === today ? -1 : 1) - (b.dueDate === today ? -1 : 1) || b.priority - a.priority || a.dueDate.localeCompare(b.dueDate));
  const overdueCount = pending.filter((task) => isTaskOverdue(task, today)).length;
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">A plan with breathing room</p><h1>Study plan</h1><p className="lede">The important things, in an order your brain can actually use.</p></div><button className="button primary-button" onClick={replan}><Icon name="refresh" size={16} /> Replan my week</button></section><div className="plan-banner"><div className="plan-banner-icon"><Icon name="spark" size={20} /></div><div><strong>{overdueCount > 0 ? `${overdueCount} old blocks can be given a kinder new home.` : "Your plan is ready for a good day."}</strong><p>{state.settings.lastReplannedAt ? `Last balanced ${formatShortDate(state.settings.lastReplannedAt.slice(0, 10))}.` : "Replanning protects exams, lectures, and Friday A311 practice while moving unfinished work forward."}</p></div><span className="plan-banner-tag">editable</span></div><div className="plan-guidance"><span className="guidance-number">01</span><div><strong>Pick the first block, not the perfect day.</strong><p>Understand first, then retrieve without notes. Past-paper blocks are already held in the runway so the F100s do not lose their final two weeks.</p></div></div><div className="plan-layout"><div><div className="filter-row"><span className="filter-label">Show</span>{(["all", "A311", "F102", "F108"] as const).map((item) => <button key={item} className={`filter-pill ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "Everything" : item}</button>)}</div><div className="plan-list">{pending.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={completeTask} onSnooze={snoozeTask} expanded />)}{pending.length === 0 && <EmptyState title="Nothing waiting here." detail="A quiet plan is a real plan too." />}</div></div><FocusTimer subjects={state.subjects} tasks={pending} logSession={logSession} /></div></div>;
}

function FocusTimer({ subjects, tasks, logSession }: { subjects: Subject[]; tasks: StudyTask[]; logSession: (draft: StudySessionDraft) => void }) {
  const [subject, setSubject] = useState<SubjectCode>(tasks[0]?.subjectCode ?? "F102");
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(1500);
  const [running, setRunning] = useState(false);
  const selectedTask = tasks.find((task) => task.id === taskId);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSecondsLeft((current) => {
      if (current <= 1) {
        window.clearInterval(timer);
        setRunning(false);
        logSession({ subjectCode: selectedTask?.subjectCode ?? subject, durationMinutes: minutes, kind: "focus", taskId: selectedTask?.id, note: selectedTask ? `Focus block: ${selectedTask.title}` : "Completed a focus block" });
        return minutes * 60;
      }
      return current - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [logSession, minutes, running, selectedTask, subject]);

  const chooseMinutes = (value: number) => { setMinutes(value); setSecondsLeft(value * 60); setRunning(false); };
  const chooseTask = (id: string) => { setTaskId(id); const task = tasks.find((item) => item.id === id); if (task) setSubject(task.subjectCode); };
  const activeSubject = selectedTask?.subjectCode ?? subject;

   return <section className="focus-card"><div className="card-kicker"><span>FOCUS BLOCK</span><Icon name="clock" size={15} /></div><div className="timer-companion"><Mascot mood={running ? "focus" : "hello"} mini /><span>{running ? "You're in the zone." : "Ready when you are."}</span></div><div className="timer-ring"><div><strong>{formatTimer(secondsLeft)}</strong><span>{running ? "in the zone" : "start small"}</span></div></div><div className="timer-controls"><button className={`timer-play ${running ? "active" : ""}`} onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause timer" : "Start timer"}><Icon name={running ? "pause" : "play"} size={18} /></button><div className="timer-options">{[25, 50, 90].map((value) => <button key={value} className={minutes === value ? "selected" : ""} onClick={() => chooseMinutes(value)}>{value}m</button>)}</div></div><label className="select-label">This block<select value={taskId} onChange={(event) => chooseTask(event.target.value)}><option value="">Choose a subject without a task</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.subjectCode} · {task.title}</option>)}</select></label>{selectedTask && <div className="focus-why"><Icon name="info" size={15} /><span>{selectedTask.impact.description}</span></div>}<label className="select-label">Subject<select value={activeSubject} onChange={(event) => setSubject(event.target.value as SubjectCode)}>{subjects.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.shortName}</option>)}</select></label>{!running && <button className="button secondary-button full-button" onClick={() => logSession({ subjectCode: activeSubject, durationMinutes: minutes, kind: "focus", taskId: selectedTask?.id, note: selectedTask ? `Focus block: ${selectedTask.title}` : "Manual focus block" })}><Icon name="check" size={15} /> Log this block now</button>}<p className="muted center-text">When the timer ends, the session is logged automatically.</p></section>;
}

function TaskRow({ task, today, onToggle, onSnooze, expanded = false }: { task: StudyTask; today: string; onToggle: (id: string) => void; onSnooze?: (id: string) => void; expanded?: boolean }) {
  const overdue = isTaskOverdue(task, today);
  return <article className={`task-row ${task.status === "done" ? "completed" : ""} ${overdue ? "overdue" : ""}`}><button className="task-check" onClick={() => onToggle(task.id)} aria-label={`${task.status === "done" ? "Mark incomplete" : "Complete"} ${task.title}`}>{task.status === "done" && <Icon name="check" size={15} />}</button><div className="task-content"><div className="task-meta"><span className={`kind-tag ${task.phase}`}>{task.phase}</span><span>{task.subjectCode}</span>{task.fixed && <span className="fixed-tag">fixed</span>}{overdue && <span className="overdue-tag">needs reshuffle</span>}</div><strong>{task.title}</strong>{expanded && task.detail && <p>{task.detail}</p>}{expanded && <div className="task-impact"><Icon name="info" size={14} /><span>{task.impact.description}</span>{task.coverageUnits ? <b>+{task.coverageUnits} chapter{task.coverageUnits === 1 ? "" : "s"} on completion</b> : null}</div>}</div><div className="task-trailing"><span className="task-date">{task.dueDate === today ? "Today" : formatShortDate(task.dueDate)}</span><span className="task-time"><Icon name="clock" size={13} />{task.estimatedMinutes}m</span>{onSnooze && !task.fixed && <button className="task-snooze" onClick={() => onSnooze(task.id)} aria-label={`Snooze ${task.title}`}>+1d</button>}</div></article>;
}

function CalendarView({ events, today }: { events: CalendarEvent[]; today: string }) {
  const [filter, setFilter] = useState<SubjectCode | "all">("all");
  const filtered = events.filter((event) => filter === "all" || event.subjectCode === filter).sort((a, b) => a.date.localeCompare(b.date));
  const months = Array.from(new Set(filtered.map((event) => event.date.slice(0, 7))));
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">Milestones without the overwhelm</p><h1>Calendar</h1><p className="lede">A single runway from lecture milestones to past-paper season and exam day.</p></div><div className="calendar-key"><span><i className="key-dot blue" /> F102</span><span><i className="key-dot pink" /> F108</span><span><i className="key-dot yellow" /> A311</span></div></section><div className="filter-row calendar-filters"><span className="filter-label">Filter</span>{(["all", "A311", "F102", "F108"] as const).map((item) => <button key={item} className={`filter-pill ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "All milestones" : item}</button>)}</div><div className="timeline">{months.map((month) => <section key={month} className="month-group"><div className="month-label"><strong>{new Intl.DateTimeFormat("en-ZA", { month: "long" }).format(new Date(`${month}-01T12:00:00`))}</strong><span>2026</span></div><div className="event-list">{filtered.filter((event) => event.date.startsWith(month)).map((event) => <EventRow key={event.id} event={event} today={today} />)}</div></section>)}</div></div>;
}

function EventRow({ event, today }: { event: CalendarEvent; today: string }) {
  const isPast = event.date < today;
  return <article className={`event-row ${event.subjectCode?.toLowerCase() ?? "neutral"} ${event.kind} ${isPast ? "past" : ""}`}><div className="event-date"><strong>{new Intl.DateTimeFormat("en-ZA", { day: "2-digit" }).format(new Date(`${event.date}T12:00:00`))}</strong><span>{new Intl.DateTimeFormat("en-ZA", { weekday: "short" }).format(new Date(`${event.date}T12:00:00`))}</span></div><div className="event-line" /><div className="event-body"><div className="event-topline"><span className="event-kind">{event.kind}</span>{event.subjectCode && <span className="event-subject">{event.subjectCode}</span>}{event.durationMinutes && <span className="event-duration">{event.durationMinutes / 60}h</span>}</div><strong>{event.title}</strong><p>{event.chapterRange ? `${event.chapterRange} · ` : ""}{event.detail ?? ""}</p></div>{event.kind === "exam" && <span className="event-badge">exam day</span>}</article>;
}

function SubjectsView({ state, today, saveCheckpoint, logSession }: { state: AppState; today: string; saveCheckpoint: (checkpoint: ChapterCheckpoint) => void; logSession: (draft: StudySessionDraft) => void }) {
  const [active, setActive] = useState<SubjectCode>("F102");
  const subject = state.subjects.find((item) => item.code === active)!;
  const progress = getSubjectProgress(subject, state.tasks, state.sessions);
  const checkpoint = state.checkpoints.find((item) => item.subjectCode === active) ?? emptyCheckpoint(active, subject.code === "A311" ? "Last paper" : `Chapter ${progress.coverageUnits}`);
  const papers = state.sessions.filter((session) => session.subjectCode === active && session.kind === "past-paper").slice(-4).reverse();
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">Know where you are</p><h1>Subjects</h1><p className="lede">Short checkpoints and exam-style records, instead of long summaries that become another textbook.</p></div><a className="button secondary-button" href="https://www.actuarialsociety.org.za/document-category/past-paper/" target="_blank" rel="noreferrer">ASSA past papers <Icon name="arrow" size={15} /></a></section><div className="subject-tabs">{state.subjects.map((item) => <button key={item.code} className={`subject-tab ${active === item.code ? "active" : ""} ${item.color}`} onClick={() => setActive(item.code)}><span className="subject-tab-dot" /><strong>{item.code}</strong><small>{item.shortName}</small></button>)}</div><section className={`subject-hero ${subject.color}`}><div><div className="hero-code">{subject.code}</div><h2>{subject.name}</h2><p>{subject.description}</p><div className="hero-exam"><Icon name="calendar" size={15} /> Exam {subject.examDates.map(formatShortDate).join(" and ")} · {daysUntil(subject.examDates[0], today)} days</div></div><div className="hero-progress"><div className="progress-circle"><span>{subject.code === "A311" ? "R" : progress.coveragePercent}<small>{subject.code === "A311" ? "" : "%"}</small></span></div><span>{subject.code === "A311" ? "revision mode" : progress.label}</span></div></section><div className="metric-strip"><div><strong>{subject.code === "A311" ? progress.label : `${progress.coveragePercent}%`}</strong><span>coverage path</span></div><div><strong>{progress.retrievalPercent}%</strong><span>retrieval tasks</span></div><div><strong>{progress.practicePercent}%</strong><span>practice tasks</span></div></div><div className="subject-detail-grid"><section className="detail-card"><div className="section-heading compact"><div><p className="eyebrow">A small summary, on purpose</p><h3>Chapter checkpoint</h3></div><span className="soft-tag">5 minutes</span></div><p className="muted">Keep this short enough to trust. It is for returning to, not retyping the chapter.</p><CheckpointForm key={checkpoint.id} checkpoint={checkpoint} onSave={saveCheckpoint} /></section><section className="detail-card"><div className="section-heading compact"><div><p className="eyebrow">Practice is the proof</p><h3>Past-paper record</h3></div><Icon name="target" size={18} /></div><p className="muted">Log the attempt, score if you have one, the errors that matter, and the next action. This creates feedback instead of just more hours.</p><PaperLogForm key={active} subjectCode={active} today={today} onSave={logSession} /><a className="resource-link" href="https://www.actuarialsociety.org.za/exams/" target="_blank" rel="noreferrer"><span>ASSA exam information</span><Icon name="arrow" size={14} /></a></section></div>{papers.length > 0 && <section className="paper-history detail-card"><div className="section-heading compact"><div><p className="eyebrow">Evidence you can use</p><h3>Recent paper records</h3></div><span className="soft-tag">{papers.length} logged</span></div>{papers.map((paper) => <div className="paper-row" key={paper.id}><div><strong>{paper.paperName || "Past paper"}</strong><span>{paper.paperDate ? formatShortDate(paper.paperDate) : formatShortDate(paper.date)} · {paper.attemptedMinutes ?? paper.durationMinutes} min</span></div><div className="paper-stats"><b>{paper.score === undefined ? "—" : `${paper.score}%`}</b><span>{paper.errorCount === undefined ? "No error count" : `${paper.errorCount} errors`}</span></div></div>)}</section>}</div>;
}

function CheckpointForm({ checkpoint, onSave }: { checkpoint: ChapterCheckpoint; onSave: (checkpoint: ChapterCheckpoint) => void }) {
  const [draft, setDraft] = useState(checkpoint);
  const update = (key: keyof ChapterCheckpoint, value: string) => setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  return <form className="checkpoint-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><label>Key ideas<textarea value={draft.keyIdeas} onChange={(event) => update("keyIdeas", event.target.value)} placeholder="What is the idea in your own words?" /></label><label>Formulas / terms<textarea value={draft.formulas} onChange={(event) => update("formulas", event.target.value)} placeholder="Only the things worth returning to" /></label><div className="two-field"><label>One uncertainty<textarea value={draft.uncertainty} onChange={(event) => update("uncertainty", event.target.value)} placeholder="What should I ask or revisit?" /></label><label>One exam question<textarea value={draft.examQuestion} onChange={(event) => update("examQuestion", event.target.value)} placeholder="How might this be tested?" /></label></div><button className="button primary-button" type="submit"><Icon name="check" size={15} /> Save checkpoint</button></form>;
}

function PaperLogForm({ subjectCode, today, onSave }: { subjectCode: SubjectCode; today: string; onSave: (draft: StudySessionDraft) => void }) {
  const [paperName, setPaperName] = useState(`${subjectCode} official past paper`);
  const [paperDate, setPaperDate] = useState(today);
  const [attemptedMinutes, setAttemptedMinutes] = useState("180");
  const [score, setScore] = useState("");
  const [errorCount, setErrorCount] = useState("");
  const [nextAction, setNextAction] = useState("");
  return <form className="paper-form" onSubmit={(event) => { event.preventDefault(); onSave({ subjectCode, durationMinutes: Number(attemptedMinutes) || 0, kind: "past-paper", paperName, paperDate, attemptedMinutes: Number(attemptedMinutes) || 0, score: score === "" ? undefined : Number(score), errorCount: errorCount === "" ? undefined : Number(errorCount), nextAction }); }}><label>Paper name<input value={paperName} onChange={(event) => setPaperName(event.target.value)} /></label><div className="two-field"><label>Attempt date<input type="date" value={paperDate} onChange={(event) => setPaperDate(event.target.value)} /></label><label>Minutes attempted<input type="number" min="0" value={attemptedMinutes} onChange={(event) => setAttemptedMinutes(event.target.value)} /></label></div><div className="two-field"><label>Score % <span className="optional">optional</span><input type="number" min="0" max="100" value={score} onChange={(event) => setScore(event.target.value)} placeholder="—" /></label><label>Errors worth revisiting <span className="optional">optional</span><input type="number" min="0" value={errorCount} onChange={(event) => setErrorCount(event.target.value)} placeholder="—" /></label></div><label>Next action<textarea value={nextAction} onChange={(event) => setNextAction(event.target.value)} placeholder="e.g. retrieve reserving assumptions before paper 2" /></label><button className="button primary-button full-button" type="submit"><Icon name="plus" size={15} /> Save paper record</button></form>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) { return <div className="empty-state"><div className="empty-orbit">✦</div><strong>{title}</strong><p>{detail}</p></div>; }

function SettingsModal({ onClose, exportBackup, importBackup, resetData }: { onClose: () => void; exportBackup: () => void; importBackup: (event: ChangeEvent<HTMLInputElement>) => void; resetData: () => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><div><p className="eyebrow">Your data stays with you</p><h2 id="settings-title">Settings & backup</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></div><div className="settings-callout"><Icon name="heart" size={17} /><p>StitchFlow stores progress in this browser. Export a backup when you want a second copy or move to another device.</p></div><div className="settings-actions"><button className="settings-action" onClick={exportBackup}><Icon name="download" size={18} /><span><strong>Export backup</strong><small>Download your full progress as JSON</small></span></button><button className="settings-action" onClick={() => importRef.current?.click()}><Icon name="upload" size={18} /><span><strong>Import backup</strong><small>Restore a previous StitchFlow file</small></span></button><input ref={importRef} hidden type="file" accept="application/json" onChange={importBackup} /></div><div className="settings-divider" /><button className="reset-link" onClick={resetData}>Reset to starter plan</button><p className="settings-footnote">No account, analytics, Supabase, or external database is connected.</p></section></div>;
}

export default App;
