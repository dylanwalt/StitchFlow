import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { seedState } from "../data";
import { STORAGE_KEY } from "../storage";

function readSavedState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as typeof seedState;
}

describe("study cockpit interactions", () => {
  it("completes a task and persists its revisit date", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Complete F102 catch-up: chapters 5-7" }));
    await waitFor(() => expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.status).toBe("done"));
    expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.revisitDate).toBe("2026-08-13");
    expect(screen.getByRole("status")).toHaveTextContent("block has a job");
  });

  it("snoozes work without changing another subject", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Snooze F102 catch-up: chapters 5-7" }));
    await waitFor(() => expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.status).toBe("snoozed"));
    expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.dueDate).toBe("2026-08-12");
    expect(readSavedState().tasks.find((task) => task.id === "today-f108-catchup")?.status).toBe("todo");
  });

  it("logs a focus block from the plan view", async () => {
    window.location.hash = "plan";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Log this block now" }));
    await waitFor(() => expect(readSavedState().sessions).toHaveLength(1));
    expect(readSavedState().sessions[0].kind).toBe("focus");
    expect(screen.getByRole("status")).toHaveTextContent("minutes logged");
  });

  it("saves a short checkpoint and a structured paper record", async () => {
    window.location.hash = "subjects";
    render(<App />);
    fireEvent.change(screen.getByLabelText("Key ideas"), { target: { value: "The core idea in my own words." } });
    fireEvent.click(screen.getByRole("button", { name: "Save checkpoint" }));
    await waitFor(() => expect(readSavedState().checkpoints[0]?.keyIdeas).toBe("The core idea in my own words."));

    fireEvent.change(screen.getByLabelText("Paper name"), { target: { value: "F102 semester one paper" } });
    fireEvent.change(screen.getByLabelText("Score % optional"), { target: { value: "68" } });
    fireEvent.change(screen.getByLabelText("Errors worth revisiting optional"), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Save paper record" }));
    await waitFor(() => expect(readSavedState().sessions[0]?.kind).toBe("past-paper"));
    expect(readSavedState().sessions[0]?.score).toBe(68);
    expect(readSavedState().sessions[0]?.errorCount).toBe(4);
  });

  it("imports a backup through settings", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const backup = new File([JSON.stringify(seedState)], "stitchflow-backup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [backup] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Backup restored"));
    expect(readSavedState().version).toBe(2);
  });
});
