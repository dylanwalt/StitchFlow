import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "../App";
import { seedState } from "../data";
import { addDays, toISODate } from "../planner";
import { STORAGE_KEY } from "../storage";
import { APP_VERSION } from "../version";

function readSavedState() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as typeof seedState;
}

describe("study cockpit interactions", () => {
  it("shows runway status without exposing guided rebalancing yet", () => {
    window.location.hash = "dashboard";
    render(<App />);
    expect(screen.getByRole("heading", { name: "A couple of subjects need attention" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rebalance my plan" })).not.toBeInTheDocument();
    expect(screen.getByText(/guided rebalancing will come later/i)).toBeInTheDocument();
    expect(screen.queryByText("Some ground to cover")).not.toBeInTheDocument();
    expect(screen.getByLabelText(`App version ${APP_VERSION}`)).toHaveTextContent(APP_VERSION);
    expect(screen.getByText("Congratulations, you don't have to write A311!")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Confirm the remaining details" })).not.toBeInTheDocument();
  });

  it("completes a task and persists its revisit date", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Complete F102 catch-up: chapters 5-7" }));
    await waitFor(() => expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.status).toBe("done"));
    expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.revisitDate).toBe(addDays(toISODate(new Date()), 2));
    expect(screen.getByRole("status")).toHaveTextContent("Task updated");
  });

  it("snoozes work without changing another subject", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Snooze F102 catch-up: chapters 5-7" }));
    await waitFor(() => expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.status).toBe("snoozed"));
    expect(readSavedState().tasks.find((task) => task.id === "today-f102-catchup")?.dueDate).toBe(addDays(toISODate(new Date()), 1));
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

  it("surfaces a daily exam lens on the plan", () => {
    window.location.hash = "plan";
    render(<App />);
    expect(screen.getByRole("heading", { name: /F102/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Daily exam lens")).toBeInTheDocument();
    expect(screen.getByText(/Curated priority signal/i)).toBeInTheDocument();
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

  it("keeps notes and flashcards under an individual chapter tab", async () => {
    window.location.hash = "subjects";
    render(<App />);
    fireEvent.click(screen.getByRole("tab", { name: "Chapter 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Add flashcard" }));
    fireEvent.change(screen.getByPlaceholderText("Term or question"), { target: { value: "Morbidity" } });
    fireEvent.change(screen.getByPlaceholderText("Definition or answer"), { target: { value: "The incidence of illness in a population." } });
    fireEvent.change(screen.getByLabelText("Key ideas"), { target: { value: "Chapter-specific notes" } });
    fireEvent.click(screen.getByRole("button", { name: "Save checkpoint" }));
    await waitFor(() => {
      const checkpoint = readSavedState().checkpoints.find((item) => item.subjectCode === "F102" && item.chapterNumber === 1);
      expect(checkpoint?.keyIdeas).toBe("Chapter-specific notes");
      expect(checkpoint?.flashcards[0]?.front).toBe("Morbidity");
    });
  });

  it("supports honest partial progress on a plan item", async () => {
    window.location.hash = "plan";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Mark F102 catch-up: chapters 5-7 50% ready" }));
    await waitFor(() => {
      const task = readSavedState().tasks.find((item) => item.id === "today-f102-catchup");
      expect(task?.status).toBe("in-progress");
      expect(task?.completionPercent).toBe(50);
    });
  });

  it("imports a backup through settings", async () => {
    window.location.hash = "dashboard";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const backup = new File([JSON.stringify(seedState)], "stitchflow-backup.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [backup] } });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Backup restored"));
    expect(readSavedState().version).toBe(5);
  });

  it("shows seven calendar days beside each other and keeps lecture detail selectable", () => {
    window.location.hash = "calendar";
    render(<App />);
    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    expect(screen.getByText("Week view")).toBeInTheDocument();
    expect(screen.getAllByText(/Open space|today/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Show next week" }));
    expect(screen.getByText("This week")).toBeInTheDocument();
  });

  it("shows ASSA exam signals on the subject page", () => {
    window.location.hash = "subjects";
    render(<App />);
    expect(screen.getByRole("heading", { name: "F102 exam lens" })).toBeInTheDocument();
    expect(screen.getAllByText(/Examiner trap:/).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Open ASSA index/ })).toHaveAttribute("href", "https://www.actuarialsociety.org.za/document-category/past-paper/");
    expect(screen.getByText("Official source pack")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /F102 semester 1 paper archive/ })).toHaveAttribute("href", "https://www.actuarialsociety.org.za/document-category/semester-1-f102-life-insurance-fellowship-principles/");
  });
});
