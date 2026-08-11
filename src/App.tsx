import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { emptyCheckpoint, seedState } from "./data";
import {
  addDays,
  countCompleted,
  daysUntil,
  formatLongDate,
  formatShortDate,
  getSubjectSummary,
  isTaskOverdue,
  progressPercent,
  toISODate,
  replanTasks,
} from "./planner";
import { exportState, loadState, parseImportedState, saveState } from "./storage";
import type {
  AppState,
  CalendarEvent,
  ChapterCheckpoint,
  StudySession,
  StudyTask,
  Subject,
  SubjectCode,
  TaskKind,
} from "./types";

type View = "dashboard" | "plan" | "calendar" | "subjects";
type IconName = "home" | "plan" | "calendar" | "book" | "spark" | "settings" | "arrow" | "check" | "play" | "pause" | "download" | "upload" | "refresh" | "clock" | "target" | "plus";

const VIEW_LABELS: Record<View, string> = {
  dashboard: "Today",
  plan: "Study plan",
  calendar: "Calendar",
  subjects: "Subjects",
};

const VIEW_ICONS: Record<View, IconName> = {
  dashboard: "home",
  plan: "plan",
  calendar: "calendar",
  subjects: "book",
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    home: "M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z",
    plan: "M5 4.5h14M5 9.5h14M5 14.5h8M5 19.5h5",
    calendar: "M5 3v3M19 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01",
    book: "M5 4.5A2.5 2.5 0 0 1 7.5 2H20v17H7.5A2.5 2.5 0 0 0 5 21.5zM5 4.5v17M5 18.5h15",
    spark: "m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z",
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
  };
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
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

  const setView = (next: View) => {
    window.location.hash = next;
    setViewState(next);
  };
  return [view, setView];
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
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
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, status: task.status === "done" ? "todo" : "done" } : task),
    }));
  }, [updateState]);

  const snoozeTask = useCallback((taskId: string) => {
    updateState((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, dueDate: addDays(task.dueDate < today ? today : task.dueDate, 1), status: "snoozed" } : task),
    }));
    setToast("Moved gently to tomorrow.");
  }, [today, updateState]);

  const replan = useCallback(() => {
    updateState((current) => ({
      ...current,
      tasks: replanTasks(current, today),
      settings: { ...current.settings, lastReplannedAt: new Date().toISOString() },
    }));
    setToast("Your plan was rebalanced around the exams.");
  }, [today, updateState]);

  const logSession = useCallback((subjectCode: SubjectCode, durationMinutes: number, taskId?: string, note?: string) => {
    const session: StudySession = {
      id: `${subjectCode}-${Date.now()}`,
      date: today,
      subjectCode,
      durationMinutes,
      taskId,
      note,
    };
    updateState((current) => ({ ...current, sessions: [...current.sessions, session] }));
    setToast(`${durationMinutes} minutes logged. That counts.`);
  }, [today, updateState]);

  const saveCheckpoint = useCallback((checkpoint: ChapterCheckpoint) => {
    updateState((current) => ({
      ...current,
      checkpoints: [...current.checkpoints.filter((item) => item.id !== checkpoint.id), checkpoint],
    }));
    setToast("Checkpoint saved.");
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
      if (!parsed) {
        setToast("That backup could not be read.");
        return;
      }
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

  const title = VIEW_LABELS[view];

  return (
    <div className="app-shell">
      <Sidebar view={view} setView={setView} onSettings={() => setSettingsOpen(true)} />
      <main className="main-content">
        <Topbar title={title} onSettings={() => setSettingsOpen(true)} />
        {view === "dashboard" && <Dashboard state={state} today={today} setView={setView} completeTask={completeTask} snoozeTask={snoozeTask} replan={replan} />}
        {view === "plan" && <StudyPlan state={state} today={today} completeTask={completeTask} snoozeTask={snoozeTask} replan={replan} logSession={logSession} />}
        {view === "calendar" && <CalendarView events={state.events} today={today} />}
        {view === "subjects" && <SubjectsView state={state} today={today} saveCheckpoint={saveCheckpoint} logSession={logSession} />}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} exportBackup={exportBackup} importBackup={importBackup} resetData={resetData} />}
      {toast && <div className="toast" role="status"><span className="toast-dot" />{toast}</div>}
    </div>
  );
}

function Sidebar({ view, setView, onSettings }: { view: View; setView: (view: View) => void; onSettings: () => void }) {
  return (
    <aside className="sidebar">
      <div className="brand-lockup">
        <div className="brand-mark"><span>✦</span></div>
        <div><strong>StitchFlow</strong><span>study gently, go far</span></div>
      </div>
      <div className="sidebar-label">Your space</div>
      <nav className="main-nav" aria-label="Main navigation">
        {(Object.keys(VIEW_LABELS) as View[]).map((item) => (
          <button key={item} className={`nav-item ${view === item ? "active" : ""}`} onClick={() => setView(item)}>
            <Icon name={VIEW_ICONS[item]} size={18} /><span>{VIEW_LABELS[item]}</span>{item === "dashboard" && <span className="nav-pulse" />}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><Icon name="spark" size={16} /><span>Small steps are still steps.</span></div>
        <button className="settings-link" onClick={onSettings}><Icon name="settings" size={17} /> Settings & backup</button>
        <div className="sidebar-footer">local-first · no account needed</div>
      </div>
    </aside>
  );
}

function Topbar({ title, onSettings }: { title: string; onSettings: () => void }) {
  return (
    <header className="topbar">
      <div className="mobile-brand"><div className="brand-mark small"><span>✦</span></div><strong>StitchFlow</strong></div>
      <div className="breadcrumbs"><span>StitchFlow</span><b>/</b><strong>{title}</strong></div>
      <button className="icon-button top-settings" aria-label="Open settings" onClick={onSettings}><Icon name="settings" size={18} /></button>
    </header>
  );
}

function Dashboard({ state, today, setView, completeTask, snoozeTask, replan }: { state: AppState; today: string; setView: (view: View) => void; completeTask: (id: string) => void; snoozeTask: (id: string) => void; replan: () => void }) {
  const pending = state.tasks.filter((task) => task.status !== "done");
  const topTasks = [...pending].sort((a, b) => {
    const rank = (task: StudyTask) => task.dueDate === today ? 3 : isTaskOverdue(task, today) ? 2 : 1;
    return rank(b) - rank(a) || b.priority - a.priority || a.dueDate.localeCompare(b.dueDate);
  }).slice(0, 4);
  const completed = countCompleted(state.tasks);
  const weekStart = addDays(today, -6);
  const weekSessions = state.sessions.filter((session) => session.date >= weekStart && session.date <= today);
  const weekMinutes = weekSessions.reduce((total, session) => total + session.durationMinutes, 0);
  const behind = state.subjects.map((subject) => getSubjectSummary(subject, today)).filter((summary) => summary.behind);

  return (
    <div className="page dashboard-page">
      <section className="welcome-row">
        <div>
          <p className="eyebrow">{formatLongDate(today)}</p>
          <h1>Let’s find your <em>flow</em>.</h1>
          <p className="lede">A calm little cockpit for the work that matters today.</p>
        </div>
        <button className="button secondary-button" onClick={() => setView("plan")}><Icon name="play" size={15} /> Start a focus block</button>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-main">
          <CompanionCard behind={behind.length > 0} />
          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">Right now</p><h2>Today’s gentle shortlist</h2></div><button className="text-button" onClick={() => setView("plan")}>Open full plan <Icon name="arrow" size={15} /></button></div>
            <div className="task-stack">
              {topTasks.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={completeTask} onSnooze={snoozeTask} />)}
              {topTasks.length === 0 && <EmptyState title="You’re all clear for today." detail="Use the calendar to choose the next small step." />}
            </div>
          </section>
        </div>
        <aside className="dashboard-side">
          <ExamCountdowns subjects={state.subjects} today={today} />
          <section className="mini-card momentum-card">
            <div className="card-kicker"><span>THIS WEEK</span><Icon name="spark" size={15} /></div>
            <div className="momentum-number">{weekMinutes}<small> min</small></div>
            <p className="muted">{completed} tasks completed overall · {weekSessions.length} focus blocks this week</p>
            <div className="week-bars" aria-label="Study sessions in the last seven days">
              {Array.from({ length: 7 }, (_, index) => {
                const date = addDays(today, index - 6);
                const minutes = state.sessions.filter((session) => session.date === date).reduce((sum, session) => sum + session.durationMinutes, 0);
                return <div key={date} className="bar-day"><div className="bar-track"><span style={{ height: `${Math.min(100, Math.max(8, minutes / 2))}%` }} /></div><small>{new Intl.DateTimeFormat("en-ZA", { weekday: "narrow" }).format(new Date(`${date}T12:00:00`))}</small></div>;
              })}
            </div>
          </section>
          <section className="mini-card nudge-card"><div className="nudge-icon">☼</div><div><strong>Try the two-minute start</strong><p>Open the notes, answer one question, and let momentum do the rest.</p></div></section>
          {behind.length > 0 && <section className="behind-card"><div className="behind-icon">↗</div><div><strong>Some ground to cover</strong><p>{behind.map((item) => `${item.subjectCode}: ${item.gap} chapters`).join(" · ")}</p><button className="text-button" onClick={replan}>Rebalance my plan <Icon name="arrow" size={14} /></button></div></section>}
        </aside>
      </section>
      <section className="section-block subject-overview"><div className="section-heading"><div><p className="eyebrow">The bigger picture</p><h2>Three exams, one clear path</h2></div><button className="text-button" onClick={() => setView("subjects")}>View subjects <Icon name="arrow" size={15} /></button></div><div className="subject-grid">{state.subjects.map((subject) => <SubjectProgress key={subject.code} subject={subject} today={today} />)}</div></section>
    </div>
  );
}

function CompanionCard({ behind }: { behind: boolean }) {
  return <section className="companion-card"><div className="companion-copy"><div className="card-kicker"><span>YOUR POCKET COMPANION</span><span className="status-chip"><i /> online</span></div><h2>{behind ? "We can make space for the catch-up." : "You do not have to do it all at once."}</h2><p>{behind ? "We’ll protect the important dates, move the rest into a kinder order, and keep going." : "One focused block. One honest checkpoint. That is enough for today."}</p><div className="companion-actions"><span className="tiny-quote">✦ progress over perfection</span></div></div><Mascot /></section>;
}

function Mascot() {
  return <div className="mascot-wrap" aria-label="A friendly original blue study companion"><div className="mascot-glow" /><svg className="mascot" viewBox="0 0 180 160" role="img"><path className="mascot-ear" d="M35 59C5 54 9 22 31 17c7 13 17 25 28 33" /><path className="mascot-ear right" d="M145 59c30-5 26-37 4-42-7 13-17 25-28 33" /><path className="mascot-body" d="M42 62c0-29 21-44 48-44s48 15 48 44v46c0 27-21 39-48 39s-48-12-48-39z" /><ellipse className="mascot-belly" cx="90" cy="110" rx="25" ry="22" /><circle className="mascot-eye" cx="70" cy="72" r="8" /><circle className="mascot-eye" cx="110" cy="72" r="8" /><circle className="mascot-eye-shine" cx="72" cy="69" r="2" /><circle className="mascot-eye-shine" cx="112" cy="69" r="2" /><path className="mascot-nose" d="M85 84q5-5 10 0" /><path className="mascot-smile" d="M76 93q14 12 28 0" /><path className="mascot-arm" d="M42 101c-15 7-21 15-13 25" /><path className="mascot-arm right" d="M138 101c15 7 21 15 13 25" /><path className="mascot-foot" d="M62 143q-8 9-17 5M118 143q8 9 17 5" /></svg><div className="mascot-star">✦</div></div>;
}

function ExamCountdowns({ subjects, today }: { subjects: Subject[]; today: string }) {
  return <section className="countdown-stack"><div className="card-kicker"><span>EXAM COUNTDOWNS</span><Icon name="target" size={15} /></div>{subjects.map((subject) => { const days = daysUntil(subject.examDates[0], today); return <div className={`countdown-row ${subject.color}`} key={subject.code}><div className="subject-dot" /><div className="countdown-info"><strong>{subject.code}</strong><span>{subject.code === "A311" ? "Paper 1 · 1 Oct" : formatShortDate(subject.examDates[0])}</span></div><div className="countdown-number">{days}<small>d</small></div></div>; })}</section>;
}

function SubjectProgress({ subject, today }: { subject: Subject; today: string }) {
  const percent = subject.code === "A311" ? 64 : progressPercent(subject);
  const summary = getSubjectSummary(subject, today);
  return <div className={`subject-progress-card ${subject.color}`}><div className="subject-card-head"><div><strong>{subject.code}</strong><span>{subject.shortName}</span></div><span className="percent">{percent}%</span></div><div className="progress-line"><span style={{ width: `${percent}%` }} /></div><p>{subject.code === "A311" ? "Revision rhythm" : `Through chapter ${subject.currentChapter} of ${subject.targetChapter}`}</p><span className={`small-status ${summary.behind ? "behind" : ""}`}>{summary.behind ? `Needs a ${summary.gap}-chapter catch-up` : subject.progressNote}</span></div>;
}

function StudyPlan({ state, today, completeTask, snoozeTask, replan, logSession }: { state: AppState; today: string; completeTask: (id: string) => void; snoozeTask: (id: string) => void; replan: () => void; logSession: (subject: SubjectCode, duration: number, taskId?: string, note?: string) => void }) {
  const [filter, setFilter] = useState<SubjectCode | "all">("all");
  const pending = state.tasks.filter((task) => task.status !== "done" && (filter === "all" || task.subjectCode === filter)).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.priority - a.priority);
  const overdueCount = pending.filter((task) => isTaskOverdue(task, today)).length;
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">A plan with breathing room</p><h1>Study plan</h1><p className="lede">The important things, in an order your brain can actually use.</p></div><button className="button primary-button" onClick={replan}><Icon name="refresh" size={16} /> Replan my week</button></section><div className="plan-banner"><div className="plan-banner-icon"><Icon name="spark" size={20} /></div><div><strong>{overdueCount > 0 ? `${overdueCount} tasks need a kinder new home.` : "Your plan is ready for a good day."}</strong><p>{state.settings.lastReplannedAt ? `Last balanced ${formatShortDate(state.settings.lastReplannedAt.slice(0, 10))}.` : "Replanning keeps the exam dates fixed while moving unfinished work forward."}</p></div><span className="plan-banner-tag">editable</span></div><div className="plan-layout"><div><div className="filter-row"><span className="filter-label">Show</span>{(["all", "A311", "F102", "F108"] as const).map((item) => <button key={item} className={`filter-pill ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "Everything" : item}</button>)}</div><div className="plan-list">{pending.map((task) => <TaskRow key={task.id} task={task} today={today} onToggle={completeTask} onSnooze={snoozeTask} expanded />)}{pending.length === 0 && <EmptyState title="Nothing waiting here." detail="A quiet plan is a real plan too." />}</div></div><FocusTimer subjects={state.subjects} logSession={logSession} /></div></div>;
}

function FocusTimer({ subjects, logSession }: { subjects: Subject[]; logSession: (subject: SubjectCode, duration: number, taskId?: string, note?: string) => void }) {
  const [subject, setSubject] = useState<SubjectCode>("F102");
  const [minutes, setMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(1500);
  const [running, setRunning] = useState(false);
  const initialSeconds = minutes * 60;

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setRunning(false);
          logSession(subject, minutes, undefined, "Completed a focus block");
          return initialSeconds;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [initialSeconds, logSession, minutes, running, subject]);

  const chooseMinutes = (value: number) => {
    setMinutes(value);
    setSecondsLeft(value * 60);
    setRunning(false);
  };

  return <section className="focus-card"><div className="card-kicker"><span>FOCUS BLOCK</span><Icon name="clock" size={15} /></div><div className="timer-ring"><div><strong>{formatTimer(secondsLeft)}</strong><span>{running ? "in the zone" : "ready when you are"}</span></div></div><div className="timer-controls"><button className={`timer-play ${running ? "active" : ""}`} onClick={() => setRunning((value) => !value)} aria-label={running ? "Pause timer" : "Start timer"}><Icon name={running ? "pause" : "play"} size={18} /></button><div className="timer-options">{[25, 50, 90].map((value) => <button key={value} className={minutes === value ? "selected" : ""} onClick={() => chooseMinutes(value)}>{value}m</button>)}</div></div><label className="select-label">Working on<select value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode)}>{subjects.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.shortName}</option>)}</select></label><p className="muted center-text">When the timer ends, your session is logged automatically.</p></section>;
}

function TaskRow({ task, today, onToggle, onSnooze, expanded = false }: { task: StudyTask; today: string; onToggle: (id: string) => void; onSnooze: (id: string) => void; expanded?: boolean }) {
  const overdue = isTaskOverdue(task, today);
  return <article className={`task-row ${task.status === "done" ? "completed" : ""} ${overdue ? "overdue" : ""}`}><button className="task-check" onClick={() => onToggle(task.id)} aria-label={`${task.status === "done" ? "Mark incomplete" : "Complete"} ${task.title}`}>{task.status === "done" && <Icon name="check" size={15} />}</button><div className="task-content"><div className="task-meta"><span className={`kind-tag ${task.kind}`}>{task.kind.replace("error-review", "error review")}</span><span>{task.subjectCode}</span>{overdue && <span className="overdue-tag">needs reshuffle</span>}</div><strong>{task.title}</strong>{expanded && task.detail && <p>{task.detail}</p>}</div><div className="task-trailing"><span className="task-date">{task.dueDate === today ? "Today" : formatShortDate(task.dueDate)}</span><span className="task-time"><Icon name="clock" size={13} />{task.estimatedMinutes}m</span><button className="task-snooze" onClick={() => onSnooze(task.id)} aria-label={`Snooze ${task.title}`}>+1d</button></div></article>;
}

function CalendarView({ events, today }: { events: CalendarEvent[]; today: string }) {
  const [filter, setFilter] = useState<SubjectCode | "all">("all");
  const filtered = events.filter((event) => filter === "all" || event.subjectCode === filter).sort((a, b) => a.date.localeCompare(b.date));
  const months = Array.from(new Set(filtered.map((event) => event.date.slice(0, 7))));
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">Milestones without the overwhelm</p><h1>Calendar</h1><p className="lede">A single view of the runway from now to exam day.</p></div><div className="calendar-key"><span><i className="key-dot blue" /> F102</span><span><i className="key-dot pink" /> F108</span><span><i className="key-dot yellow" /> A311</span></div></section><div className="filter-row calendar-filters"><span className="filter-label">Filter</span>{(["all", "A311", "F102", "F108"] as const).map((item) => <button key={item} className={`filter-pill ${filter === item ? "selected" : ""}`} onClick={() => setFilter(item)}>{item === "all" ? "All milestones" : item}</button>)}</div><div className="timeline">{months.map((month) => <section key={month} className="month-group"><div className="month-label"><strong>{new Intl.DateTimeFormat("en-ZA", { month: "long" }).format(new Date(`${month}-01T12:00:00`))}</strong><span>2026</span></div><div className="event-list">{filtered.filter((event) => event.date.startsWith(month)).map((event) => <EventRow key={event.id} event={event} today={today} />)}</div></section>)}</div></div>;
}

function EventRow({ event, today }: { event: CalendarEvent; today: string }) {
  const isPast = event.date < today;
  return <article className={`event-row ${event.subjectCode?.toLowerCase() ?? "neutral"} ${event.kind} ${isPast ? "past" : ""}`}><div className="event-date"><strong>{new Intl.DateTimeFormat("en-ZA", { day: "2-digit" }).format(new Date(`${event.date}T12:00:00`))}</strong><span>{new Intl.DateTimeFormat("en-ZA", { weekday: "short" }).format(new Date(`${event.date}T12:00:00`))}</span></div><div className="event-line" /><div className="event-body"><div className="event-topline"><span className="event-kind">{event.kind}</span>{event.subjectCode && <span className="event-subject">{event.subjectCode}</span>}{event.durationMinutes && <span className="event-duration">{event.durationMinutes / 60}h</span>}</div><strong>{event.title}</strong><p>{event.chapterRange ? `${event.chapterRange} · ` : ""}{event.detail ?? ""}</p></div>{event.kind === "exam" && <span className="event-badge">exam day</span>}</article>;
}

function SubjectsView({ state, today, saveCheckpoint, logSession }: { state: AppState; today: string; saveCheckpoint: (checkpoint: ChapterCheckpoint) => void; logSession: (subject: SubjectCode, duration: number, taskId?: string, note?: string) => void }) {
  const [active, setActive] = useState<SubjectCode>("F102");
  const subject = state.subjects.find((item) => item.code === active)!;
  const checkpoint = state.checkpoints.find((item) => item.subjectCode === active) ?? emptyCheckpoint(active, subject.code === "A311" ? "Last paper" : `Chapter ${subject.currentChapter}`);
  return <div className="page"><section className="page-intro"><div><p className="eyebrow">Know where you are</p><h1>Subjects</h1><p className="lede">Turn every chapter into a small, useful piece of confidence.</p></div><a className="button secondary-button" href="https://www.actuarialsociety.org.za/document-category/past-paper/" target="_blank" rel="noreferrer">ASSA past papers <Icon name="arrow" size={15} /></a></section><div className="subject-tabs">{state.subjects.map((item) => <button key={item.code} className={`subject-tab ${active === item.code ? "active" : ""} ${item.color}`} onClick={() => setActive(item.code)}><span className="subject-tab-dot" /><strong>{item.code}</strong><small>{item.shortName}</small></button>)}</div><section className={`subject-hero ${subject.color}`}><div><div className="hero-code">{subject.code}</div><h2>{subject.name}</h2><p>{subject.description}</p><div className="hero-exam"><Icon name="calendar" size={15} /> Exam {subject.examDates.map(formatShortDate).join(" and ")} · {daysUntil(subject.examDates[0], today)} days</div></div><div className="hero-progress"><div className="progress-circle"><span>{subject.code === "A311" ? "64" : progressPercent(subject)}<small>%</small></span></div><span>{subject.code === "A311" ? "revision rhythm" : `through chapter ${subject.currentChapter}`}</span></div></section><div className="subject-detail-grid"><section className="detail-card"><div className="section-heading compact"><div><p className="eyebrow">A small summary, on purpose</p><h3>Chapter checkpoint</h3></div><span className="soft-tag">5 minutes</span></div><p className="muted">Keep this short enough to trust. It is for returning to, not retyping the chapter.</p><CheckpointForm key={checkpoint.id} checkpoint={checkpoint} onSave={saveCheckpoint} /></section><section className="detail-card"><div className="section-heading compact"><div><p className="eyebrow">Practice is the proof</p><h3>Past-paper rhythm</h3></div><Icon name="target" size={18} /></div><p className="muted">Official ASSA papers show how the knowledge is actually asked. Log the attempt, then keep only the useful errors.</p><div className="practice-stat"><strong>{state.sessions.filter((session) => session.subjectCode === active).length}</strong><span>focus blocks logged for {active}</span></div><button className="button secondary-button full-button" onClick={() => logSession(active, subject.code === "A311" ? 180 : 60, undefined, subject.code === "A311" ? "Past paper attempt" : "Practice block")}> <Icon name="plus" size={15} /> Log a practice block</button><a className="resource-link" href="https://www.actuarialsociety.org.za/exams/" target="_blank" rel="noreferrer"><span>ASSA exam information</span><Icon name="arrow" size={14} /></a></section></div></div>;
}

function CheckpointForm({ checkpoint, onSave }: { checkpoint: ChapterCheckpoint; onSave: (checkpoint: ChapterCheckpoint) => void }) {
  const [draft, setDraft] = useState(checkpoint);
  const update = (key: keyof ChapterCheckpoint, value: string) => setDraft((current) => ({ ...current, [key]: value, updatedAt: new Date().toISOString() }));
  return <form className="checkpoint-form" onSubmit={(event) => { event.preventDefault(); onSave(draft); }}><label>Key ideas<textarea value={draft.keyIdeas} onChange={(event) => update("keyIdeas", event.target.value)} placeholder="What is the idea in your own words?" /></label><label>Formulas / terms<textarea value={draft.formulas} onChange={(event) => update("formulas", event.target.value)} placeholder="Only the things worth returning to" /></label><div className="two-field"><label>One uncertainty<textarea value={draft.uncertainty} onChange={(event) => update("uncertainty", event.target.value)} placeholder="What should I ask or revisit?" /></label><label>One exam question<textarea value={draft.examQuestion} onChange={(event) => update("examQuestion", event.target.value)} placeholder="How might this be tested?" /></label></div><button className="button primary-button" type="submit"><Icon name="check" size={15} /> Save checkpoint</button></form>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="empty-state"><div className="empty-orbit">✦</div><strong>{title}</strong><p>{detail}</p></div>;
}

function SettingsModal({ onClose, exportBackup, importBackup, resetData }: { onClose: () => void; exportBackup: () => void; importBackup: (event: ChangeEvent<HTMLInputElement>) => void; resetData: () => void }) {
  const importRef = useRef<HTMLInputElement>(null);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="modal-header"><div><p className="eyebrow">Your data stays with you</p><h2 id="settings-title">Settings & backup</h2></div><button className="icon-button" onClick={onClose} aria-label="Close settings">×</button></div><div className="settings-callout"><Icon name="spark" size={17} /><p>StitchFlow stores progress in this browser. Export a backup when you want a second copy or move to another device.</p></div><div className="settings-actions"><button className="settings-action" onClick={exportBackup}><Icon name="download" size={18} /><span><strong>Export backup</strong><small>Download your full progress as JSON</small></span></button><button className="settings-action" onClick={() => importRef.current?.click()}><Icon name="upload" size={18} /><span><strong>Import backup</strong><small>Restore a previous StitchFlow file</small></span></button><input ref={importRef} hidden type="file" accept="application/json" onChange={importBackup} /></div><div className="settings-divider" /><button className="reset-link" onClick={resetData}>Reset to starter plan</button><p className="settings-footnote">No account, analytics, Supabase, or external database is connected.</p></section></div>;
}

export default App;
