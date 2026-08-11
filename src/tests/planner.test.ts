import { describe, expect, it } from "vitest";
import { seedState } from "../data";
import { addDays, daysUntil, getSubjectSummary, isTaskOverdue, replanTasks } from "../planner";
import { parseImportedState } from "../storage";

describe("planner utilities", () => {
  it("calculates calendar day differences from ISO dates", () => {
    expect(daysUntil("2026-10-01", "2026-08-11")).toBe(51);
    expect(addDays("2026-08-11", 3)).toBe("2026-08-14");
  });

  it("identifies the seeded F102 catch-up gap", () => {
    const f102 = seedState.subjects.find((subject) => subject.code === "F102")!;
    const summary = getSubjectSummary(f102, "2026-08-11");
    expect(summary.behind).toBe(true);
    expect(summary.gap).toBe(32);
  });

  it("marks unfinished past tasks as overdue", () => {
    const task = seedState.tasks.find((item) => item.id === "today-f102-catchup")!;
    expect(isTaskOverdue(task, "2026-08-12")).toBe(true);
    expect(isTaskOverdue({ ...task, status: "done" }, "2026-08-12")).toBe(false);
  });

  it("replans movable work while preserving completed and fixed work", () => {
    const fixed = seedState.tasks.find((task) => task.fixed)!;
    const completed = { ...seedState.tasks[0], status: "done" as const, dueDate: "2026-08-01" };
    const state = { ...seedState, tasks: [...seedState.tasks.filter((task) => task.id !== seedState.tasks[0].id), completed] };
    const planned = replanTasks(state, "2026-08-11");
    expect(planned.find((task) => task.id === fixed.id)?.dueDate).toBe(fixed.dueDate);
    expect(planned.find((task) => task.id === completed.id)?.dueDate).toBe("2026-08-01");
    expect(planned.filter((task) => task.status !== "done").every((task) => task.dueDate >= "2026-08-11")).toBe(true);
  });

  it("rejects malformed or incompatible backups", () => {
    expect(parseImportedState("not-json", seedState)).toBeNull();
    expect(parseImportedState(JSON.stringify({ version: 99 }), seedState)).toBeNull();
    expect(parseImportedState(JSON.stringify(seedState), seedState)?.version).toBe(1);
  });
});
