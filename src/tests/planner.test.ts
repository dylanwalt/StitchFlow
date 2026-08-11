import { describe, expect, it } from "vitest";
import { seedState } from "../data";
import { addDays, daysUntil, getSubjectProgress, getSubjectSummary, isTaskOverdue, replanTasks, reviewInterval } from "../planner";
import { migrateState, parseImportedState } from "../storage";

describe("planner utilities", () => {
  it("calculates calendar day differences from ISO dates", () => {
    expect(daysUntil("2026-10-01", "2026-08-11")).toBe(51);
    expect(addDays("2026-08-11", 3)).toBe("2026-08-14");
  });

  it("identifies the seeded F102 catch-up gap", () => {
    const f102 = seedState.subjects.find((subject) => subject.code === "F102")!;
    const summary = getSubjectSummary(f102, "2026-08-11", seedState.tasks);
    expect(summary.behind).toBe(true);
    expect(summary.gap).toBe(32);
  });

  it("makes completed learning visible without pretending it is an exam mark", () => {
    const f102 = seedState.subjects.find((subject) => subject.code === "F102")!;
    const before = getSubjectProgress(f102, seedState.tasks, []);
    const tasks = seedState.tasks.map((task) => task.id === "today-f102-catchup" ? { ...task, status: "done" as const } : task);
    const after = getSubjectProgress(f102, tasks, []);
    expect(before.coverageUnits).toBe(4);
    expect(after.coverageUnits).toBe(7);
    expect(after.coveragePercent).toBeGreaterThan(before.coveragePercent);
  });

  it("marks unfinished past tasks as overdue", () => {
    const task = seedState.tasks.find((item) => item.id === "today-f102-catchup")!;
    expect(isTaskOverdue(task, "2026-08-12")).toBe(true);
    expect(isTaskOverdue({ ...task, status: "done" }, "2026-08-12")).toBe(false);
  });

  it("replans movable work while preserving completed, fixed, and historical work", () => {
    const fixed = seedState.tasks.find((task) => task.fixed)!;
    const completed = { ...seedState.tasks[0], status: "done" as const, dueDate: "2026-08-01" };
    const state = { ...seedState, tasks: [...seedState.tasks.filter((task) => task.id !== seedState.tasks[0].id), completed] };
    const planned = replanTasks(state, "2026-08-11");
    expect(planned.find((task) => task.id === fixed.id)?.dueDate).toBe(fixed.dueDate);
    expect(planned.find((task) => task.id === completed.id)?.dueDate).toBe("2026-08-01");
    expect(planned.filter((task) => task.status !== "done" && !task.archived && !task.fixed).every((task) => task.dueDate >= "2026-08-11")).toBe(true);
  });

  it("keeps a practice runway in the final two weeks", () => {
    const f102PaperDates = seedState.tasks.filter((task) => task.paperName?.startsWith("F102")).map((task) => task.dueDate);
    const f108PaperDates = seedState.tasks.filter((task) => task.paperName?.startsWith("F108")).map((task) => task.dueDate);
    expect(f102PaperDates).toEqual(["2026-10-22", "2026-10-29", "2026-11-03"]);
    expect(f108PaperDates).toEqual(["2026-10-30", "2026-11-06", "2026-11-12"]);
  });

  it("uses confidence to schedule a gentle next review", () => {
    expect(reviewInterval("hard")).toBe(1);
    expect(reviewInterval("okay")).toBe(4);
    expect(reviewInterval("solid")).toBe(8);
  });

  it("migrates version one state and safely rejects malformed backups", () => {
    const legacy = {
      ...seedState,
      version: 1,
      tasks: seedState.tasks.map(({ phase, impact, ...task }) => task),
      sessions: [],
    };
    const migrated = migrateState(legacy, seedState);
    expect(migrated?.version).toBe(2);
    expect(migrated?.tasks[0].phase).toBeTruthy();
    expect(parseImportedState("not-json", seedState)).toBeNull();
    expect(parseImportedState(JSON.stringify({ version: 99 }), seedState)).toBeNull();
    expect(parseImportedState(JSON.stringify(seedState), seedState)?.version).toBe(2);
  });
});
